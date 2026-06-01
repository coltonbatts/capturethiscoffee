create extension if not exists pgcrypto;

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
create index if not exists production_roster_production_idx on production_roster(production_id);
create index if not exists orders_production_status_idx on orders(production_id, status);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
before update on orders
for each row
execute function set_updated_at();

alter table clients enable row level security;
alter table people enable row level security;
alter table client_people enable row level security;
alter table productions enable row level security;
alter table production_roster enable row level security;
alter table orders enable row level security;

drop policy if exists "Internal staff can manage clients" on clients;
create policy "Internal staff can manage clients"
on clients for all
to authenticated
using (true)
with check (true);

drop policy if exists "Internal staff can manage people" on people;
create policy "Internal staff can manage people"
on people for all
to authenticated
using (true)
with check (true);

drop policy if exists "Internal staff can manage client people" on client_people;
create policy "Internal staff can manage client people"
on client_people for all
to authenticated
using (true)
with check (true);

drop policy if exists "Internal staff can manage productions" on productions;
create policy "Internal staff can manage productions"
on productions for all
to authenticated
using (true)
with check (true);

drop policy if exists "Internal staff can manage production roster" on production_roster;
create policy "Internal staff can manage production roster"
on production_roster for all
to authenticated
using (true)
with check (true);

drop policy if exists "Internal staff can manage orders" on orders;
create policy "Internal staff can manage orders"
on orders for all
to authenticated
using (true)
with check (true);
