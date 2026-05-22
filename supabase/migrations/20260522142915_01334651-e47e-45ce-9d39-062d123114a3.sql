
-- Move btree_gist out of public
create schema if not exists extensions;
alter extension btree_gist set schema extensions;

-- Fix search_path on gen_booking_reference
create or replace function public.gen_booking_reference()
returns text
language sql
stable
set search_path = public
as $$
  select 'KX-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
$$;

-- Lock down execute on SECURITY DEFINER helpers
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
-- has_role is used in RLS USING clauses; authenticated needs EXECUTE
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

revoke execute on function public.create_booking(uuid, timestamptz, timestamptz, uuid[], int, int, int) from public, anon;
grant execute on function public.create_booking(uuid, timestamptz, timestamptz, uuid[], int, int, int) to authenticated;
