CREATE OR REPLACE FUNCTION public.create_booking(_venue_id uuid, _starts_at timestamp with time zone, _ends_at timestamp with time zone, _resource_ids uuid[], _players integer, _total_pence integer, _service_fee_pence integer)
 RETURNS TABLE(id uuid, reference text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _uid uuid := auth.uid();
  _ref text;
  _booking_id uuid;
  _rid uuid;
  _venue_published boolean;
  _dow int;
  _start_min int;
  _end_min int;
  _duration_min int;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if _ends_at <= _starts_at then raise exception 'Invalid time range'; end if;
  if _starts_at <= now() then raise exception 'Cannot book a time in the past'; end if;
  if array_length(_resource_ids,1) is null then
    raise exception 'At least one resource required';
  end if;

  select v.is_published into _venue_published from public.venues v where v.id = _venue_id;
  if _venue_published is null then raise exception 'Venue not found'; end if;
  if not _venue_published then raise exception 'Venue not bookable'; end if;

  if exists (
    select 1 from unnest(_resource_ids) rid
    left join public.resources r on r.id = rid
    where r.id is null or r.venue_id <> _venue_id or not r.is_active
  ) then raise exception 'Invalid resource selection'; end if;

  _dow := extract(dow from _starts_at at time zone 'UTC')::int;
  _start_min := (extract(hour from _starts_at at time zone 'UTC')::int * 60)
              + extract(minute from _starts_at at time zone 'UTC')::int;
  _end_min := (extract(hour from _ends_at at time zone 'UTC')::int * 60)
            + extract(minute from _ends_at at time zone 'UTC')::int;
  _duration_min := ((extract(epoch from (_ends_at - _starts_at)))/60)::int;

  if not exists (
    select 1 from public.opening_hours oh
    where oh.venue_id = _venue_id
      and oh.day_of_week = _dow
      and _start_min >= oh.open_min
      and _end_min   <= oh.close_min
  ) then
    raise exception 'Outside opening hours';
  end if;

  if not exists (
    select 1 from public.pricing_rules pr
    where pr.venue_id = _venue_id
      and pr.day_of_week = _dow
      and _start_min >= pr.start_min
      and _start_min <  pr.end_min
      and _duration_min >= pr.min_duration_min
  ) then
    raise exception 'No price configured for that time';
  end if;

  if exists (
    select 1 from public.blackouts bo
    where bo.venue_id = _venue_id
      and (bo.resource_id is null or bo.resource_id = any(_resource_ids))
      and tstzrange(bo.starts_at, bo.ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)')
  ) then raise exception 'Time blocked by venue'; end if;

  _ref := public.gen_booking_reference();

  insert into public.bookings (
    user_id, venue_id, status, starts_at, ends_at,
    players, total_pence, service_fee_pence, reference
  ) values (
    _uid, _venue_id, 'confirmed', _starts_at, _ends_at,
    coalesce(_players,2), coalesce(_total_pence,0), coalesce(_service_fee_pence,0), _ref
  ) returning bookings.id into _booking_id;

  foreach _rid in array _resource_ids loop
    insert into public.booking_resources (booking_id, resource_id, status, starts_at, ends_at)
    values (_booking_id, _rid, 'confirmed', _starts_at, _ends_at);
  end loop;

  id := _booking_id;
  reference := _ref;
  return next;
exception
  when exclusion_violation then
    raise exception 'One of the selected courts was just booked. Please pick another slot.'
      using errcode = 'P0001';
end $function$;