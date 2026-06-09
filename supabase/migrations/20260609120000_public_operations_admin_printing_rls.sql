-- Public event-day operations with protected setup/admin and trusted printing.

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    auth.role() = 'service_role'
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false)
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'staff')
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'staff', false);
$$;

alter table public.clients enable row level security;
alter table public.people enable row level security;
alter table public.client_people enable row level security;
alter table public.productions enable row level security;
alter table public.production_roster enable row level security;
alter table public.orders enable row level security;
alter table public.printer_devices enable row level security;
alter table public.label_print_jobs enable row level security;
alter table public.label_print_attempts enable row level security;

revoke all on public.clients from anon;
revoke all on public.people from anon;
revoke all on public.client_people from anon;
revoke all on public.productions from anon;
revoke all on public.production_roster from anon;
revoke all on public.orders from anon;
revoke all on public.printer_devices from anon;
revoke all on public.label_print_jobs from anon;
revoke all on public.label_print_attempts from anon;

grant select on public.clients to anon;
grant select on public.people to anon;
grant select on public.productions to anon;
grant select on public.production_roster to anon;
grant select on public.orders to anon;
grant update (
  drink_type,
  size,
  temperature,
  milk_type,
  sweetener,
  caffeine,
  special_notes,
  vendor,
  status,
  updated_at
) on public.orders to anon;

grant all on public.clients to authenticated;
grant all on public.people to authenticated;
grant all on public.client_people to authenticated;
grant all on public.productions to authenticated;
grant all on public.production_roster to authenticated;
grant all on public.orders to authenticated;
grant all on public.printer_devices to authenticated;
grant all on public.label_print_jobs to authenticated;
grant all on public.label_print_attempts to authenticated;

drop policy if exists "Internal staff can manage clients" on public.clients;
drop policy if exists "Staff can manage clients" on public.clients;
drop policy if exists "Authenticated users can manage clients" on public.clients;
drop policy if exists "Public can read active clients" on public.clients;
drop policy if exists "Admins can manage clients" on public.clients;
create policy "Public can read active clients"
on public.clients for select
to anon, authenticated
using (active = true or public.current_user_is_admin());
create policy "Admins can manage clients"
on public.clients for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Internal staff can manage people" on public.people;
drop policy if exists "Staff can manage people" on public.people;
drop policy if exists "Authenticated users can manage people" on public.people;
drop policy if exists "Public can read active people" on public.people;
drop policy if exists "Admins can manage people" on public.people;
create policy "Public can read active people"
on public.people for select
to anon, authenticated
using (active = true or public.current_user_is_admin());
create policy "Admins can manage people"
on public.people for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Internal staff can manage client people" on public.client_people;
drop policy if exists "Staff can manage client people" on public.client_people;
drop policy if exists "Authenticated users can manage client people" on public.client_people;
drop policy if exists "Admins can manage client people" on public.client_people;
create policy "Admins can manage client people"
on public.client_people for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Internal staff can manage productions" on public.productions;
drop policy if exists "Staff can manage productions" on public.productions;
drop policy if exists "Authenticated users can manage productions" on public.productions;
drop policy if exists "Public can read visible productions" on public.productions;
drop policy if exists "Admins can manage productions" on public.productions;
create policy "Public can read visible productions"
on public.productions for select
to anon, authenticated
using (status in ('planning', 'active') or public.current_user_is_admin());
create policy "Admins can manage productions"
on public.productions for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Internal staff can manage production roster" on public.production_roster;
drop policy if exists "Staff can manage production roster" on public.production_roster;
drop policy if exists "Authenticated users can manage production roster" on public.production_roster;
drop policy if exists "Public can read roster for visible productions" on public.production_roster;
drop policy if exists "Admins can manage production roster" on public.production_roster;
create policy "Public can read roster for visible productions"
on public.production_roster for select
to anon, authenticated
using (
  exists (
    select 1
    from public.productions p
    where p.id = production_roster.production_id
      and p.status in ('planning', 'active')
  )
  or public.current_user_is_admin()
);
create policy "Admins can manage production roster"
on public.production_roster for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Internal staff can manage orders" on public.orders;
drop policy if exists "Staff can manage orders" on public.orders;
drop policy if exists "Authenticated users can manage orders" on public.orders;
drop policy if exists "Public can read orders for visible productions" on public.orders;
drop policy if exists "Public can update operational order fields" on public.orders;
drop policy if exists "Admins can manage orders" on public.orders;
create policy "Public can read orders for visible productions"
on public.orders for select
to anon, authenticated
using (
  exists (
    select 1
    from public.productions p
    where p.id = orders.production_id
      and p.status in ('planning', 'active')
  )
  or public.current_user_is_admin()
);
create policy "Public can update operational order fields"
on public.orders for update
to anon
using (
  exists (
    select 1
    from public.productions p
    where p.id = orders.production_id
      and p.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.productions p
    where p.id = orders.production_id
      and p.status = 'active'
  )
);
create policy "Admins can manage orders"
on public.orders for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Staff can manage printer devices" on public.printer_devices;
drop policy if exists "Authenticated users can manage printer devices" on public.printer_devices;
drop policy if exists "Admins can manage printer devices" on public.printer_devices;
create policy "Admins can manage printer devices"
on public.printer_devices for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Staff can manage label print jobs" on public.label_print_jobs;
drop policy if exists "Authenticated users can manage label print jobs" on public.label_print_jobs;
drop policy if exists "Admins can manage label print jobs" on public.label_print_jobs;
create policy "Admins can manage label print jobs"
on public.label_print_jobs for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Staff can manage label print attempts" on public.label_print_attempts;
drop policy if exists "Authenticated users can manage label print attempts" on public.label_print_attempts;
drop policy if exists "Admins can manage label print attempts" on public.label_print_attempts;
create policy "Admins can manage label print attempts"
on public.label_print_attempts for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Public can read person photos" on storage.objects;
drop policy if exists "Staff can manage person photos" on storage.objects;
drop policy if exists "Authenticated users can manage person photos" on storage.objects;
drop policy if exists "Admins can manage person photos" on storage.objects;
create policy "Admins can manage person photos"
on storage.objects for all
to authenticated
using (bucket_id = 'person-photos' and public.current_user_is_admin())
with check (bucket_id = 'person-photos' and public.current_user_is_admin());

create or replace function public.complete_label_print_job(
  p_job_id uuid,
  p_attempt_id uuid default null
)
returns public.label_print_jobs
language plpgsql
set search_path = ''
as $$
declare
  v_job public.label_print_jobs;
begin
  if public.current_user_is_admin() is not true then
    raise exception 'Admin access required';
  end if;

  select *
  into v_job
  from public.label_print_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Label print job not found';
  end if;

  if v_job.status in ('printed', 'cancelled') then
    return v_job;
  end if;

  if p_attempt_id is not null then
    update public.label_print_attempts
    set status = 'succeeded',
        finished_at = coalesce(finished_at, pg_catalog.now()),
        error_code = null,
        error_message = null
    where id = p_attempt_id
      and job_id = p_job_id;
  end if;

  update public.label_print_jobs
  set status = 'printed',
      printed_at = pg_catalog.now(),
      error_message = null
  where id = p_job_id
  returning * into v_job;

  if v_job.order_id is not null then
    update public.orders
    set label_printed = true
    where id = v_job.order_id;
  end if;

  return v_job;
end;
$$;
