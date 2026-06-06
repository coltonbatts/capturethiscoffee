-- Private shared demo mode: any signed-in Supabase user can use the app.
-- Anonymous users stay blocked by RLS and revoked grants.

drop policy if exists "Staff can manage clients" on public.clients;
create policy "Authenticated users can manage clients"
on public.clients for all
to authenticated
using (true)
with check (true);

drop policy if exists "Staff can manage people" on public.people;
create policy "Authenticated users can manage people"
on public.people for all
to authenticated
using (true)
with check (true);

drop policy if exists "Staff can manage client people" on public.client_people;
create policy "Authenticated users can manage client people"
on public.client_people for all
to authenticated
using (true)
with check (true);

drop policy if exists "Staff can manage productions" on public.productions;
create policy "Authenticated users can manage productions"
on public.productions for all
to authenticated
using (true)
with check (true);

drop policy if exists "Staff can manage production roster" on public.production_roster;
create policy "Authenticated users can manage production roster"
on public.production_roster for all
to authenticated
using (true)
with check (true);

drop policy if exists "Staff can manage orders" on public.orders;
create policy "Authenticated users can manage orders"
on public.orders for all
to authenticated
using (true)
with check (true);

drop policy if exists "Staff can manage person photos" on storage.objects;
create policy "Authenticated users can manage person photos"
on storage.objects for all
to authenticated
using (bucket_id = 'person-photos')
with check (bucket_id = 'person-photos');

drop policy if exists "Staff can manage printer devices" on public.printer_devices;
create policy "Authenticated users can manage printer devices"
on public.printer_devices for all
to authenticated
using (true)
with check (true);

drop policy if exists "Staff can manage label print jobs" on public.label_print_jobs;
create policy "Authenticated users can manage label print jobs"
on public.label_print_jobs for all
to authenticated
using (true)
with check (true);

drop policy if exists "Staff can manage label print attempts" on public.label_print_attempts;
create policy "Authenticated users can manage label print attempts"
on public.label_print_attempts for all
to authenticated
using (true)
with check (true);

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
  if auth.uid() is null then
    raise exception 'Authentication required';
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
