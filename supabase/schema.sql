create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type person_type as enum ('client_contact', 'agency', 'crew', 'guest');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type order_status as enum (
    'not_asked',
    'confirmed',
    'ordered',
    'picked_up',
    'delivered',
    'no_order'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type production_status as enum ('planning', 'active', 'complete');
exception
  when duplicate_object then null;
end $$;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type person_type not null default 'crew',
  role text,
  department text,
  company text,
  photo_url text,
  usual_order text,
  dietary_notes text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists client_people (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  relationship_notes text,
  active boolean not null default true,
  unique (client_id, person_id)
);

create table if not exists productions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid not null references clients(id),
  shoot_date date,
  location text,
  runner_name text,
  notes text,
  status production_status not null default 'planning',
  created_at timestamptz not null default now()
);

create table if not exists production_share_tokens (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions(id) on delete cascade,
  token_hash text not null unique,
  label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists production_roster (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions(id) on delete cascade,
  person_id uuid not null references people(id),
  group_label text,
  on_set_today boolean not null default true,
  sort_order integer not null default 0,
  unique (production_id, person_id)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions(id) on delete cascade,
  roster_id uuid not null references production_roster(id) on delete cascade,
  person_id uuid not null references people(id),
  drink_type text,
  size text,
  temperature text,
  milk_type text,
  sweetener text,
  caffeine text,
  special_notes text,
  vendor text,
  status order_status not null default 'not_asked',
  label_printed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_id, roster_id)
);

create index if not exists clients_active_idx on clients(active);
create index if not exists people_name_idx on people using gin (to_tsvector('english', name));
create index if not exists productions_client_idx on productions(client_id);
create index if not exists production_share_tokens_production_idx on production_share_tokens(production_id);
create index if not exists production_roster_production_idx on production_roster(production_id);
create index if not exists orders_production_status_idx on orders(production_id, status);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'person-photos',
  'person-photos',
  false,
  8388608,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
before update on orders
for each row
execute function set_updated_at();

alter table clients enable row level security;
alter table people enable row level security;
alter table client_people enable row level security;
alter table productions enable row level security;
alter table production_share_tokens enable row level security;
alter table production_roster enable row level security;
alter table orders enable row level security;

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

revoke all on public.clients from anon;
revoke all on public.people from anon;
revoke all on public.client_people from anon;
revoke all on public.productions from anon;
revoke all on public.production_share_tokens from anon;
revoke all on public.production_roster from anon;
revoke all on public.orders from anon;

grant all on public.clients to authenticated;
grant all on public.people to authenticated;
grant all on public.client_people to authenticated;
grant all on public.productions to authenticated;
grant all on public.production_share_tokens to authenticated;
grant all on public.production_roster to authenticated;
grant all on public.orders to authenticated;

drop policy if exists "Internal staff can manage clients" on clients;
drop policy if exists "Staff can manage clients" on clients;
drop policy if exists "Authenticated users can manage clients" on clients;
drop policy if exists "Public can read active clients" on clients;
drop policy if exists "Admins can manage clients" on clients;
create policy "Admins can manage clients"
on clients for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Internal staff can manage people" on people;
drop policy if exists "Staff can manage people" on people;
drop policy if exists "Authenticated users can manage people" on people;
drop policy if exists "Public can read active people" on people;
drop policy if exists "Admins can manage people" on people;
create policy "Admins can manage people"
on people for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Internal staff can manage client people" on client_people;
drop policy if exists "Staff can manage client people" on client_people;
drop policy if exists "Authenticated users can manage client people" on client_people;
drop policy if exists "Admins can manage client people" on client_people;
create policy "Admins can manage client people"
on client_people for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Internal staff can manage productions" on productions;
drop policy if exists "Staff can manage productions" on productions;
drop policy if exists "Authenticated users can manage productions" on productions;
drop policy if exists "Public can read visible productions" on productions;
drop policy if exists "Admins can manage productions" on productions;
create policy "Admins can manage productions"
on productions for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can manage production share tokens" on production_share_tokens;
create policy "Admins can manage production share tokens"
on production_share_tokens for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Internal staff can manage production roster" on production_roster;
drop policy if exists "Staff can manage production roster" on production_roster;
drop policy if exists "Authenticated users can manage production roster" on production_roster;
drop policy if exists "Public can read roster for visible productions" on production_roster;
drop policy if exists "Admins can manage production roster" on production_roster;
create policy "Admins can manage production roster"
on production_roster for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Internal staff can manage orders" on orders;
drop policy if exists "Staff can manage orders" on orders;
drop policy if exists "Authenticated users can manage orders" on orders;
drop policy if exists "Public can read orders for visible productions" on orders;
drop policy if exists "Public can update operational order fields" on orders;
drop policy if exists "Admins can manage orders" on orders;
create policy "Admins can manage orders"
on orders for all
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

create or replace function public.create_production_share_token(
  p_production_id uuid,
  p_expires_at timestamptz default null,
  p_label text default null
)
returns text
language plpgsql
security definer
set search_path = extensions, public, pg_catalog
as $$
declare
  v_token text;
begin
  if public.current_user_is_admin() is not true then
    raise exception 'Admin access required';
  end if;

  if not exists (
    select 1
    from public.productions
    where id = p_production_id
  ) then
    raise exception 'Production not found';
  end if;

  v_token := pg_catalog.encode(gen_random_bytes(32), 'hex');

  insert into public.production_share_tokens (
    production_id,
    token_hash,
    label,
    expires_at
  )
  values (
    p_production_id,
    pg_catalog.encode(digest(v_token, 'sha256'), 'hex'),
    nullif(pg_catalog.trim(p_label), ''),
    p_expires_at
  );

  return v_token;
end;
$$;

revoke all on function public.create_production_share_token(uuid, timestamptz, text) from public;
grant execute on function public.create_production_share_token(uuid, timestamptz, text) to authenticated;
