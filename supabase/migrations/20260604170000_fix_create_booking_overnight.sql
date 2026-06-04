-- Fix create_booking to allow overnight (post-midnight) slots.
--
-- Previous logic computed _dow / _start_min / _end_min from the raw UTC timestamp,
-- then required both to match a SAME-DAY opening_hours row.  A slot at 00:30 on
-- Friday (dow=5, startMin=30) therefore never matched a Thursday overnight rule
-- (open_min=1080, close_min=1620) → "Outside opening hours".
--
-- Overnight rules may be stored in two forms created by the JS normalisation layer:
--   Form A (raw):        open_min=1080, close_min=120  (close_min < open_min)
--   Form B (normalised): open_min=1080, close_min=1620 (close_min > 1440)
--
-- Fix: after failing a same-day check, also try the PREVIOUS calendar day's
-- overnight rule by shifting start/end by +1440 before comparing.

CREATE OR REPLACE FUNCTION public.create_booking(
  _venue_id         uuid,
  _starts_at        timestamp with time zone,
  _ends_at          timestamp with time zone,
  _resource_ids     uuid[],
  _players          integer,
  _total_pence      integer,
  _service_fee_pence integer
)
RETURNS TABLE(id uuid, reference text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _uid              uuid := auth.uid();
  _ref              text;
  _booking_id       uuid;
  _rid              uuid;
  _venue_published  boolean;
  _dow              int;
  _prev_dow         int;
  _start_min        int;
  _end_min          int;
  _duration_min     int;
  _is_overnight     boolean;
  _oh_cur_open      int;
  _oh_cur_close     int;
  _oh_prev_open     int;
  _oh_prev_close    int;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if _ends_at <= _starts_at then raise exception 'Invalid time range'; end if;
  if _starts_at <= now() then raise exception 'Cannot confirm a booking in the past'; end if;
  if array_length(_resource_ids, 1) is null then
    raise exception 'At least one resource required';
  end if;

  select v.is_published into _venue_published
    from public.venues v where v.id = _venue_id;
  if _venue_published is null then raise exception 'Venue not found'; end if;
  if not _venue_published    then raise exception 'Venue not bookable'; end if;

  if exists (
    select 1 from unnest(_resource_ids) rid
    left join public.resources r on r.id = rid
    where r.id is null or r.venue_id <> _venue_id or not r.is_active
  ) then raise exception 'Invalid resource selection'; end if;

  -- ── Time decomposition ───────────────────────────────────────────────────────
  _dow          := extract(dow from _starts_at at time zone 'UTC')::int;
  _prev_dow     := (_dow + 6) % 7;
  _start_min    := (extract(hour   from _starts_at at time zone 'UTC')::int * 60)
                 +  extract(minute from _starts_at at time zone 'UTC')::int;
  _end_min      := (extract(hour   from _ends_at   at time zone 'UTC')::int * 60)
                 +  extract(minute from _ends_at   at time zone 'UTC')::int;
  _duration_min := ((extract(epoch from (_ends_at - _starts_at)) / 60))::int;

  -- ── Diagnostic logging (visible in Supabase logs) ───────────────────────────
  select oh.open_min, oh.close_min into _oh_cur_open,  _oh_cur_close
    from public.opening_hours oh
    where oh.venue_id = _venue_id and oh.day_of_week = _dow
    limit 1;

  select oh.open_min, oh.close_min into _oh_prev_open, _oh_prev_close
    from public.opening_hours oh
    where oh.venue_id = _venue_id and oh.day_of_week = _prev_dow
    limit 1;

  raise notice '[create_booking] startsAt=% dow=% prevDow=% startMin=% endMin=% durationMin=%',
    _starts_at, _dow, _prev_dow, _start_min, _end_min, _duration_min;
  raise notice '[create_booking] current-day  opening_hours: open=% close=%', _oh_cur_open,  _oh_cur_close;
  raise notice '[create_booking] previous-day opening_hours: open=% close=%', _oh_prev_open, _oh_prev_close;

  -- ── Opening-hours validation ─────────────────────────────────────────────────
  -- Overnight rules are stored with close_min > open_min (Form B: close_min > 1440)
  -- or as raw minutes (Form A: close_min < open_min).
  -- For a post-midnight UTC start (e.g. 00:30 on day D), we shift start/end by
  -- +1440 and match against the PREVIOUS day's overnight rule.
  --
  -- Helper inline expression to normalise a rule's close side:
  --   norm_close(open, close) = close + 1440  when close < open  (Form A)
  --                           = close          otherwise          (Form B or normal)
  if not exists (
    select 1 from public.opening_hours oh
    where oh.venue_id = _venue_id
      and (
        -- ① Same-day match (normal or within-day overnight rule)
        (   oh.day_of_week = _dow
        and _start_min >= oh.open_min
        and _end_min   <= case when oh.close_min < oh.open_min
                               then oh.close_min + 1440
                               else oh.close_min end
        )
        or
        -- ② Post-midnight match: slot belongs to previous day's overnight session.
        --   Shift start/end +1440 so they compare in the same units as the rule.
        (   oh.day_of_week = _prev_dow
        and (oh.close_min < oh.open_min or oh.close_min > 1440)
        and (_start_min + 1440) >= oh.open_min
        and (_end_min   + 1440) <= case when oh.close_min < oh.open_min
                                        then oh.close_min + 1440
                                        else oh.close_min end
        )
      )
  ) then
    raise notice '[create_booking] REJECTED — no opening_hours rule matched';
    raise exception 'Outside opening hours';
  end if;

  -- Determine for logging whether this was treated as an overnight slot
  _is_overnight := not exists (
    select 1 from public.opening_hours oh
    where oh.venue_id = _venue_id
      and oh.day_of_week = _dow
      and _start_min >= oh.open_min
      and _end_min   <= case when oh.close_min < oh.open_min
                             then oh.close_min + 1440
                             else oh.close_min end
  );
  raise notice '[create_booking] isOvernightSlot=% normStartMin=% normEndMin=%',
    _is_overnight,
    case when _is_overnight then _start_min + 1440 else _start_min end,
    case when _is_overnight then _end_min   + 1440 else _end_min   end;

  -- ── Pricing validation ───────────────────────────────────────────────────────
  if not exists (
    select 1 from public.pricing_rules pr
    where pr.venue_id = _venue_id
      and (
        -- ① Same-day pricing rule
        (   pr.day_of_week = _dow
        and _start_min >= pr.start_min
        and (_start_min + _duration_min) <= case when pr.end_min < pr.start_min
                                                 then pr.end_min + 1440
                                                 else pr.end_min end
        and _duration_min >= pr.min_duration_min
        )
        or
        -- ② Post-midnight: prev-day overnight pricing rule
        (   pr.day_of_week = _prev_dow
        and (pr.end_min < pr.start_min or pr.end_min > 1440)
        and (_start_min + 1440) >= pr.start_min
        and (_start_min + 1440 + _duration_min) <= case when pr.end_min < pr.start_min
                                                        then pr.end_min + 1440
                                                        else pr.end_min end
        and _duration_min >= pr.min_duration_min
        )
      )
  ) then
    raise exception 'No price configured for that time';
  end if;

  -- ── Blackout check ───────────────────────────────────────────────────────────
  if exists (
    select 1 from public.blackouts bo
    where bo.venue_id = _venue_id
      and (bo.resource_id is null or bo.resource_id = any(_resource_ids))
      and tstzrange(bo.starts_at, bo.ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)')
  ) then raise exception 'Time blocked by venue'; end if;

  -- ── Insert booking ───────────────────────────────────────────────────────────
  _ref := public.gen_booking_reference();

  insert into public.bookings (
    user_id, venue_id, status, starts_at, ends_at,
    players, total_pence, service_fee_pence, reference
  ) values (
    _uid, _venue_id, 'confirmed', _starts_at, _ends_at,
    coalesce(_players, 2), coalesce(_total_pence, 0), coalesce(_service_fee_pence, 0), _ref
  ) returning bookings.id into _booking_id;

  foreach _rid in array _resource_ids loop
    insert into public.booking_resources (booking_id, resource_id, status, starts_at, ends_at)
    values (_booking_id, _rid, 'confirmed', _starts_at, _ends_at);
  end loop;

  id        := _booking_id;
  reference := _ref;
  return next;
exception
  when exclusion_violation then
    raise exception 'One of the selected courts was just booked. Please pick another slot.'
      using errcode = 'P0001';
end $function$;
