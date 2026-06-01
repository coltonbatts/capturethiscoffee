-- Fix mutable search_path on set_updated_at (Supabase security linter)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

-- Drop permissive staff policies
drop policy if exists "Internal staff can manage clients" on public.clients;
drop policy if exists "Internal staff can manage people" on public.people;
drop policy if exists "Internal staff can manage client people" on public.client_people;
drop policy if exists "Internal staff can manage productions" on public.productions;
drop policy if exists "Internal staff can manage production roster" on public.production_roster;
drop policy if exists "Internal staff can manage orders" on public.orders;

-- Deny anon: no RLS policies for anon; revoke table grants
revoke all on public.clients from anon;
revoke all on public.people from anon;
revoke all on public.client_people from anon;
revoke all on public.productions from anon;
revoke all on public.production_roster from anon;
revoke all on public.orders from anon;

-- Staff-only policies (app_metadata.staff must be set in Supabase Auth)
drop policy if exists "Staff can manage clients" on public.clients;
create policy "Staff can manage clients"
on public.clients for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true)
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true);

drop policy if exists "Staff can manage people" on public.people;
create policy "Staff can manage people"
on public.people for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true)
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true);

drop policy if exists "Staff can manage client people" on public.client_people;
create policy "Staff can manage client people"
on public.client_people for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true)
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true);

drop policy if exists "Staff can manage productions" on public.productions;
create policy "Staff can manage productions"
on public.productions for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true)
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true);

drop policy if exists "Staff can manage production roster" on public.production_roster;
create policy "Staff can manage production roster"
on public.production_roster for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true)
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true);

drop policy if exists "Staff can manage orders" on public.orders;
create policy "Staff can manage orders"
on public.orders for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true)
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true);
