-- One-off prod fix (2026-07-02): bring production up to date for share-token runner access.
-- Paste the whole file into the Supabase SQL editor and run once. Every statement is idempotent.
--
-- What it does:
--   1. Ensures current_user_is_admin() exists (dependency of the policies below).
--   2. Applies migrations/20260624120000_production_share_tokens.sql verbatim.
--   3. Applies migrations/20260624130000_drop_print_station_tables.sql verbatim.

-- ─── 1. Admin-check function (from schema.sql) ──────────────────────────────

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

-- ─── 2. Production share tokens (migration 20260624120000) ──────────────────

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.production_share_tokens (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  token_hash text not null unique,
  label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists production_share_tokens_production_idx
on public.production_share_tokens(production_id);

alter table public.production_share_tokens enable row level security;

revoke all on public.clients from anon;
revoke all on public.people from anon;
revoke all on public.client_people from anon;
revoke all on public.productions from anon;
revoke all on public.production_roster from anon;
revoke all on public.orders from anon;
revoke all on public.production_share_tokens from anon;

grant all on public.clients to authenticated;
grant all on public.people to authenticated;
grant all on public.client_people to authenticated;
grant all on public.productions to authenticated;
grant all on public.production_roster to authenticated;
grant all on public.orders to authenticated;
grant all on public.production_share_tokens to authenticated;

drop policy if exists "Public can read active clients" on public.clients;
drop policy if exists "Public can read active people" on public.people;
drop policy if exists "Public can read visible productions" on public.productions;
drop policy if exists "Public can read roster for visible productions" on public.production_roster;
drop policy if exists "Public can read orders for visible productions" on public.orders;
drop policy if exists "Public can update operational order fields" on public.orders;

drop policy if exists "Admins can manage clients" on public.clients;
create policy "Admins can manage clients"
on public.clients for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can manage people" on public.people;
create policy "Admins can manage people"
on public.people for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can manage client people" on public.client_people;
create policy "Admins can manage client people"
on public.client_people for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can manage productions" on public.productions;
create policy "Admins can manage productions"
on public.productions for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can manage production roster" on public.production_roster;
create policy "Admins can manage production roster"
on public.production_roster for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can manage orders" on public.orders;
create policy "Admins can manage orders"
on public.orders for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can manage production share tokens" on public.production_share_tokens;
create policy "Admins can manage production share tokens"
on public.production_share_tokens for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

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
    nullif(pg_catalog.btrim(p_label), ''),
    p_expires_at
  );

  return v_token;
end;
$$;

revoke all on function public.create_production_share_token(uuid, timestamptz, text) from public;
grant execute on function public.create_production_share_token(uuid, timestamptz, text) to authenticated;

-- ─── 3. Remove obsolete print-station tables (migration 20260624130000) ─────

drop function if exists public.complete_label_print_job(uuid, uuid);

drop table if exists public.label_print_attempts cascade;
drop table if exists public.label_print_jobs cascade;
drop table if exists public.printer_devices cascade;
