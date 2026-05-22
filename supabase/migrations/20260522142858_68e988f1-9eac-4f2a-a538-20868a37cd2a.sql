
-- Extensions
create extension if not exists btree_gist;

-- =========================================
-- Roles
-- =========================================
create type public.app_role as enum ('customer', 'vendor', 'admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users read own roles"
  on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Admins manage roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- Profiles
-- =========================================
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles viewable by everyone"
  on public.profiles for select using (true);

create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = user_id);

create policy "Users insert own profile"
  on public.profiles for insert with check (auth.uid() = user_id);

-- Timestamp helper
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- New-user trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================
-- Venues
-- =========================================
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  slug text unique not null,
  name text not null,
  activity text not null,                -- 'padel' | 'snooker' | 'pool' | 'darts' | 'golf-sim'
  type text not null check (type in ('Indoor','Outdoor')),
  address text,
  city text,
  lat double precision,
  lng double precision,
  cover_image text,
  description text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.venues (activity);
create index on public.venues (vendor_id);
alter table public.venues enable row level security;
create trigger venues_updated_at before update on public.venues
  for each row execute function public.tg_set_updated_at();

create policy "Public can view published venues"
  on public.venues for select
  using (is_published or vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "Vendors insert own venues"
  on public.venues for insert
  with check (vendor_id = auth.uid() and public.has_role(auth.uid(),'vendor'));

create policy "Vendors update own venues"
  on public.venues for update
  using (vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "Vendors delete own venues"
  on public.venues for delete
  using (vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- =========================================
-- Venue images
-- =========================================
create table public.venue_images (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  url text not null,
  sort_order int not null default 0
);
create index on public.venue_images (venue_id);
alter table public.venue_images enable row level security;

create policy "Public view venue images of published venues"
  on public.venue_images for select
  using (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.is_published or v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create policy "Vendors manage own venue images"
  on public.venue_images for all
  using (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))))
  with check (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

-- =========================================
-- Resources (courts/tables/lanes/sims)
-- =========================================
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('court','table','lane','sim','board')),
  is_active boolean not null default true,
  sort_order int not null default 0
);
create index on public.resources (venue_id);
alter table public.resources enable row level security;

create policy "Public view resources of published venues"
  on public.resources for select
  using (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.is_published or v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create policy "Vendors manage own resources"
  on public.resources for all
  using (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))))
  with check (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

-- =========================================
-- Opening hours
-- =========================================
create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  open_min int not null check (open_min between 0 and 1440),
  close_min int not null check (close_min between 0 and 1440),
  check (close_min > open_min)
);
create index on public.opening_hours (venue_id);
alter table public.opening_hours enable row level security;

create policy "Public view opening hours"
  on public.opening_hours for select
  using (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.is_published or v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create policy "Vendors manage opening hours"
  on public.opening_hours for all
  using (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))))
  with check (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

-- =========================================
-- Pricing rules
-- =========================================
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_min int not null check (start_min between 0 and 1440),
  end_min int not null check (end_min between 0 and 1440),
  price_per_hour_pence int not null check (price_per_hour_pence >= 0),
  min_duration_min int not null default 60,
  slot_step_min int not null default 30,
  check (end_min > start_min)
);
create index on public.pricing_rules (venue_id);
alter table public.pricing_rules enable row level security;

create policy "Public view pricing"
  on public.pricing_rules for select
  using (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.is_published or v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create policy "Vendors manage pricing"
  on public.pricing_rules for all
  using (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))))
  with check (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

-- =========================================
-- Blackouts
-- =========================================
create table public.blackouts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);
create index on public.blackouts (venue_id, starts_at, ends_at);
alter table public.blackouts enable row level security;

create policy "Public view blackouts"
  on public.blackouts for select
  using (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.is_published or v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create policy "Vendors manage blackouts"
  on public.blackouts for all
  using (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))))
  with check (exists (select 1 from public.venues v where v.id = venue_id
                 and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

-- =========================================
-- Bookings
-- =========================================
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete restrict,
  status text not null default 'confirmed' check (status in ('pending','confirmed','cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  players int not null default 2,
  total_pence int not null default 0,
  service_fee_pence int not null default 0,
  reference text unique not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.bookings (user_id);
create index on public.bookings (venue_id, starts_at);
alter table public.bookings enable row level security;

create policy "Users view own bookings"
  on public.bookings for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.venues v where v.id = venue_id
               and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin')))
  );

create policy "Users insert own bookings"
  on public.bookings for insert
  with check (user_id = auth.uid());

create policy "Users update own bookings"
  on public.bookings for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.venues v where v.id = venue_id
               and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin')))
  );

-- =========================================
-- Booking resources with overlap-exclusion
-- =========================================
create table public.booking_resources (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete restrict,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  primary key (booking_id, resource_id),
  check (ends_at > starts_at)
);
create index on public.booking_resources (resource_id, starts_at, ends_at);

-- The crown jewel: prevent overlapping confirmed bookings of the same resource
alter table public.booking_resources
  add constraint booking_resources_no_overlap
  exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'confirmed');

alter table public.booking_resources enable row level security;

create policy "View booking resources for own bookings or own venues"
  on public.booking_resources for select
  using (
    exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid())
    or exists (
      select 1 from public.bookings b
      join public.venues v on v.id = b.venue_id
      where b.id = booking_id
        and (v.vendor_id = auth.uid() or public.has_role(auth.uid(),'admin'))
    )
  );

-- =========================================
-- Reference generator
-- =========================================
create or replace function public.gen_booking_reference()
returns text language sql as $$
  select 'KX-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
$$;

-- =========================================
-- create_booking() — atomic
-- =========================================
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
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;
  if _ends_at <= _starts_at then
    raise exception 'Invalid time range';
  end if;
  if array_length(_resource_ids,1) is null then
    raise exception 'At least one resource required';
  end if;

  select is_published into _venue_published from public.venues where id = _venue_id;
  if _venue_published is null then
    raise exception 'Venue not found';
  end if;
  if not _venue_published then
    raise exception 'Venue not bookable';
  end if;

  -- Ensure all resources belong to venue and are active
  if exists (
    select 1 from unnest(_resource_ids) rid
    left join public.resources r on r.id = rid
    where r.id is null or r.venue_id <> _venue_id or not r.is_active
  ) then
    raise exception 'Invalid resource selection';
  end if;

  -- Reject if blackout covers any resource in the window
  if exists (
    select 1 from public.blackouts bo
    where bo.venue_id = _venue_id
      and (bo.resource_id is null or bo.resource_id = any(_resource_ids))
      and tstzrange(bo.starts_at, bo.ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)')
  ) then
    raise exception 'Time blocked by venue';
  end if;

  _ref := public.gen_booking_reference();

  insert into public.bookings (
    user_id, venue_id, status, starts_at, ends_at,
    players, total_pence, service_fee_pence, reference
  ) values (
    _uid, _venue_id, 'confirmed', _starts_at, _ends_at,
    coalesce(_players,2), coalesce(_total_pence,0), coalesce(_service_fee_pence,0), _ref
  ) returning bookings.id into _booking_id;

  -- Insert booking_resources rows; EXCLUDE constraint enforces no overlap
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

grant execute on function public.create_booking(uuid, timestamptz, timestamptz, uuid[], int, int, int) to authenticated;
