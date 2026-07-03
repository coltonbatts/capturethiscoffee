-- Any signed-in Supabase user has full access. Anonymous users stay blocked
-- by RLS and revoked grants; runner access still goes through token-scoped
-- service-role API routes. public.current_user_is_admin() stays defined so
-- access can be re-tightened later without touching old migrations.

drop policy if exists "Admins can manage clients" on public.clients;
drop policy if exists "Authenticated users can manage clients" on public.clients;
create policy "Authenticated users can manage clients"
on public.clients for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can manage people" on public.people;
drop policy if exists "Authenticated users can manage people" on public.people;
create policy "Authenticated users can manage people"
on public.people for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can manage client people" on public.client_people;
drop policy if exists "Authenticated users can manage client people" on public.client_people;
create policy "Authenticated users can manage client people"
on public.client_people for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can manage productions" on public.productions;
drop policy if exists "Authenticated users can manage productions" on public.productions;
create policy "Authenticated users can manage productions"
on public.productions for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can manage production share tokens" on public.production_share_tokens;
drop policy if exists "Authenticated users can manage production share tokens" on public.production_share_tokens;
create policy "Authenticated users can manage production share tokens"
on public.production_share_tokens for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can manage production roster" on public.production_roster;
drop policy if exists "Authenticated users can manage production roster" on public.production_roster;
create policy "Authenticated users can manage production roster"
on public.production_roster for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can manage orders" on public.orders;
drop policy if exists "Authenticated users can manage orders" on public.orders;
create policy "Authenticated users can manage orders"
on public.orders for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can manage person photos" on storage.objects;
drop policy if exists "Authenticated users can manage person photos" on storage.objects;
create policy "Authenticated users can manage person photos"
on storage.objects for all
to authenticated
using (bucket_id = 'person-photos')
with check (bucket_id = 'person-photos');

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
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception 'Authentication required';
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
