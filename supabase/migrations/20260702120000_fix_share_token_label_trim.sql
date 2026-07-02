-- Fix create_production_share_token: `trim` is SQL-standard syntax, not a
-- real pg_catalog function name, so `pg_catalog.trim(text)` fails to resolve
-- at runtime. The underlying function is `btrim`.

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
