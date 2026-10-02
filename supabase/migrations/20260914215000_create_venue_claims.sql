create table public.venue_claims (
  id uuid primary key default gen_random_uuid(),
  venue_name text not null,
  claimant_name text not null,
  email text not null,
  phone text,
  role text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.venue_claims enable row level security;

create policy "Admins can view venue claims"
  on public.venue_claims
  for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage venue claims"
  on public.venue_claims
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
