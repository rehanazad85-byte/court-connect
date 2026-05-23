
-- 1) Self-service vendor claim (SECURITY DEFINER so users can grant themselves the role
--    without opening up user_roles INSERT to everyone).
create or replace function public.claim_vendor_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.user_roles (user_id, role)
  values (_uid, 'vendor')
  on conflict (user_id, role) do nothing;
end $$;

revoke execute on function public.claim_vendor_role() from public, anon;
grant execute on function public.claim_vendor_role() to authenticated;

-- 2) Harden create_booking: validate opening hours + pricing window (per dow).
--    Replaces the existing function with the same signature.
create or replace function public.create_booking(
  _venue_id uuid,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _resource_ids uuid[],
  _players int,
  _total_pence int,
  _service_fee_pence int
) returns table (id uuid, reference text)
language plpgsql
security definer
set search_path = public
as $$
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
  if array_length(_resource_ids,1) is null then
    raise exception 'At least one resource required';
  end if;

  select is_published into _venue_published from public.venues where id = _venue_id;
  if _venue_published is null then raise exception 'Venue not found'; end if;
  if not _venue_published then raise exception 'Venue not bookable'; end if;

  -- Resources must belong to venue and be active
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

  -- Must be inside an opening_hours window
  if not exists (
    select 1 from public.opening_hours oh
    where oh.venue_id = _venue_id
      and oh.day_of_week = _dow
      and _start_min >= oh.open_min
      and _end_min   <= oh.close_min
  ) then
    raise exception 'Outside opening hours';
  end if;

  -- Must match a pricing rule and meet its min duration
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

  -- Blackouts
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

  return query select _booking_id, _ref;
exception
  when exclusion_violation then
    raise exception 'One of the selected courts was just booked. Please pick another slot.'
      using errcode = 'P0001';
end $$;

revoke execute on function public.create_booking(uuid, timestamptz, timestamptz, uuid[], int, int, int) from public, anon;
grant execute on function public.create_booking(uuid, timestamptz, timestamptz, uuid[], int, int, int) to authenticated;

-- 3) Secure cancel_booking: also flips booking_resources to 'cancelled' so the EXCLUDE
--    partial index frees the slot (the table has no UPDATE policy by design).
create or replace function public.cancel_booking(_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _row public.bookings;
  _is_vendor boolean;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;

  select * into _row from public.bookings where id = _booking_id;
  if _row.id is null then raise exception 'Booking not found'; end if;

  select exists(
    select 1 from public.venues v
    where v.id = _row.venue_id
      and (v.vendor_id = _uid or public.has_role(_uid,'admin'))
  ) into _is_vendor;

  if _row.user_id <> _uid and not _is_vendor then
    raise exception 'Not allowed';
  end if;

  if _row.status = 'cancelled' then return; end if;

  -- Customers must cancel ≥1h before; vendors/admins can override.
  if _row.user_id = _uid and not _is_vendor
     and _row.starts_at - now() < interval '1 hour' then
    raise exception 'Cannot cancel within 1 hour of start';
  end if;

  update public.bookings set status = 'cancelled' where id = _booking_id;
  update public.booking_resources set status = 'cancelled' where booking_id = _booking_id;
end $$;

revoke execute on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;
