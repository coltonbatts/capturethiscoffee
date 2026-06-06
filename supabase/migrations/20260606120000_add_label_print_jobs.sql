create table if not exists public.printer_devices (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  model text,
  transport text not null,
  native_identifier text,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_user_id, transport, native_identifier)
);

create table if not exists public.label_print_jobs (
  id uuid primary key default gen_random_uuid(),
  production_id uuid references public.productions(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  created_by uuid not null references auth.users(id),
  assigned_to uuid references auth.users(id),
  status text not null default 'queued'
    check (status in ('queued', 'claimed', 'printing', 'printed', 'failed', 'cancelled')),
  priority integer not null default 0,
  payload jsonb not null,
  rendered_png_path text,
  printer_family text not null default 'niimbot_m2',
  copies integer not null default 1 check (copies > 0 and copies <= 20),
  claimed_at timestamptz,
  printed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.label_print_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.label_print_jobs(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id),
  device_id uuid references public.printer_devices(id) on delete set null,
  status text not null check (status in ('started', 'succeeded', 'failed', 'cancelled')),
  transport text not null check (transport in ('ios_ble', 'laptop_browser', 'laptop_usb', 'bridge')),
  printer_name text,
  printer_identifier text,
  sdk_version text,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists printer_devices_staff_idx
on public.printer_devices(staff_user_id, last_seen_at desc);

create index if not exists label_print_jobs_queue_idx
on public.label_print_jobs(status, priority desc, created_at asc);

create index if not exists label_print_jobs_production_idx
on public.label_print_jobs(production_id, status, created_at desc);

create index if not exists label_print_jobs_order_idx
on public.label_print_jobs(order_id, created_at desc);

create index if not exists label_print_attempts_job_idx
on public.label_print_attempts(job_id, started_at desc);

drop trigger if exists printer_devices_set_updated_at on public.printer_devices;
create trigger printer_devices_set_updated_at
before update on public.printer_devices
for each row
execute function public.set_updated_at();

drop trigger if exists label_print_jobs_set_updated_at on public.label_print_jobs;
create trigger label_print_jobs_set_updated_at
before update on public.label_print_jobs
for each row
execute function public.set_updated_at();

alter table public.printer_devices enable row level security;
alter table public.label_print_jobs enable row level security;
alter table public.label_print_attempts enable row level security;

revoke all on public.printer_devices from anon;
revoke all on public.label_print_jobs from anon;
revoke all on public.label_print_attempts from anon;

drop policy if exists "Staff can manage printer devices" on public.printer_devices;
create policy "Staff can manage printer devices"
on public.printer_devices for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true)
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true);

drop policy if exists "Staff can manage label print jobs" on public.label_print_jobs;
create policy "Staff can manage label print jobs"
on public.label_print_jobs for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true)
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true);

drop policy if exists "Staff can manage label print attempts" on public.label_print_attempts;
create policy "Staff can manage label print attempts"
on public.label_print_attempts for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true)
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true);

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
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) is not true then
    raise exception 'Staff access required';
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
