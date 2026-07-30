-- Build 13 versioned label templates and irreversible day closeout.
--
-- Published template versions are immutable data, not executable code. The
-- validator below accepts only the bounded primitive schema implemented by the
-- web and iOS renderers. Existing productions intentionally retain a null
-- template reference; resolution treats that state as bundled Grid 01 v1.
create table if not exists public.label_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z][a-z0-9-]{1,47}$'),
  display_name text not null
    check (
      pg_catalog.length(pg_catalog.btrim(display_name)) between 1 and 80
    ),
  description text
    check (pg_catalog.length(description) <= 500),
  created_at timestamptz not null default pg_catalog.now(),
  created_by uuid,
  updated_at timestamptz not null default pg_catalog.now(),
  updated_by uuid
);

create table if not exists public.label_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null
    references public.label_templates(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  definition jsonb not null,
  definition_checksum text not null
    check (definition_checksum ~ '^[0-9a-f]{64}$'),
  changelog text
    check (pg_catalog.length(changelog) <= 1000),
  created_at timestamptz not null default pg_catalog.now(),
  created_by uuid,
  updated_at timestamptz not null default pg_catalog.now(),
  updated_by uuid,
  published_at timestamptz,
  published_by uuid,
  unique (template_id, version),
  check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status = 'published' and published_at is not null)
  )
);

create unique index if not exists label_template_versions_one_draft_idx
on public.label_template_versions(template_id)
where status = 'draft';

create index if not exists label_template_versions_published_idx
on public.label_template_versions(template_id, version desc)
where status = 'published';

create table if not exists public.label_template_settings (
  id smallint primary key default 1 check (id = 1),
  default_version_id uuid
    references public.label_template_versions(id) on delete restrict,
  updated_at timestamptz not null default pg_catalog.now(),
  updated_by uuid
);

alter table public.productions
  add column if not exists label_template_version_id uuid
    references public.label_template_versions(id) on delete restrict;
alter table public.productions
  add column if not exists completed_at timestamptz;
alter table public.productions
  add column if not exists completed_by uuid;

create index if not exists productions_label_template_version_idx
on public.productions(label_template_version_id);

create or replace function public.label_template_checksum(p_definition jsonb)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(p_definition::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.label_template_keys_allowed(
  p_value jsonb,
  p_allowed text[]
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    pg_catalog.jsonb_typeof(p_value) = 'object'
    and not exists (
      select 1
      from pg_catalog.jsonb_object_keys(p_value) as keys(key)
      where not (keys.key = any (p_allowed))
    );
$$;

create or replace function public.label_template_number(
  p_value jsonb,
  p_key text,
  p_required boolean,
  p_min numeric,
  p_max numeric
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_number numeric;
begin
  if not (p_value ? p_key) then
    if p_required then
      raise exception 'Template number "%" is required', p_key
        using errcode = '22023';
    end if;
    return null;
  end if;

  if pg_catalog.jsonb_typeof(p_value -> p_key) is distinct from 'number' then
    raise exception 'Template value "%" must be a number', p_key
      using errcode = '22023';
  end if;
  v_number := (p_value ->> p_key)::numeric;
  if v_number < p_min or v_number > p_max then
    raise exception 'Template number "%" is outside its allowed range', p_key
      using errcode = '22023';
  end if;
  return v_number;
end;
$$;

create or replace function public.create_label_template_draft(
  p_template_id uuid default null,
  p_slug text default null,
  p_display_name text default null,
  p_description text default null,
  p_definition jsonb default null,
  p_changelog text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template public.label_templates%rowtype;
  v_definition jsonb;
  v_version integer;
  v_draft public.label_template_versions%rowtype;
  v_slug text;
  v_display_name text;
begin
  perform public.setup_require_authenticated();

  if p_template_id is null then
    v_slug := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
    v_display_name := pg_catalog.btrim(coalesce(p_display_name, ''));
    if v_slug !~ '^[a-z][a-z0-9-]{1,47}$' then
      raise exception 'Template slug must be 2-48 lowercase letters, numbers, or hyphens and begin with a letter'
        using errcode = '22023';
    end if;
    if pg_catalog.length(v_display_name) not between 1 and 80 then
      raise exception 'Template display name must be 1-80 characters'
        using errcode = '22023';
    end if;
    if p_definition is null then
      raise exception 'A new template requires a definition'
        using errcode = '22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_slug, 1300)
    );
    insert into public.label_templates (
      slug,
      display_name,
      description,
      created_by,
      updated_by
    )
    values (
      v_slug,
      v_display_name,
      nullif(pg_catalog.btrim(p_description), ''),
      auth.uid(),
      auth.uid()
    )
    returning * into v_template;
    v_version := 1;
    v_definition := p_definition;
  else
    select *
    into v_template
    from public.label_templates
    where id = p_template_id
    for update;
    if not found then
      raise exception 'Label template not found'
        using errcode = 'P0002';
    end if;
    if exists (
      select 1
      from public.label_template_versions version
      where version.template_id = v_template.id
        and version.status = 'draft'
    ) then
      raise exception 'This label template already has a draft'
        using errcode = '23505';
    end if;
    update public.label_templates
    set
      display_name = case
        when p_display_name is null then display_name
        else pg_catalog.btrim(p_display_name)
      end,
      description = case
        when p_description is null then description
        else nullif(pg_catalog.btrim(p_description), '')
      end
    where id = v_template.id
    returning * into v_template;

    select coalesce(
      p_definition,
      (
        select version.definition
        from public.label_template_versions version
        where version.template_id = v_template.id
          and version.status = 'published'
        order by version.version desc
        limit 1
      )
    )
    into v_definition;
    if v_definition is null then
      raise exception 'Template draft requires a definition'
        using errcode = '22023';
    end if;
    select coalesce(pg_catalog.max(version.version), 0) + 1
    into v_version
    from public.label_template_versions version
    where version.template_id = v_template.id;
  end if;

  if pg_catalog.length(coalesce(p_description, '')) > 500
    or pg_catalog.length(coalesce(p_changelog, '')) > 1000
  then
    raise exception 'Template metadata is too long'
      using errcode = '22001';
  end if;
  perform public.validate_label_template_definition(v_definition);

  insert into public.label_template_versions (
    template_id,
    version,
    status,
    definition,
    definition_checksum,
    changelog,
    created_by,
    updated_by
  )
  values (
    v_template.id,
    v_version,
    'draft',
    v_definition,
    public.label_template_checksum(v_definition),
    nullif(pg_catalog.btrim(p_changelog), ''),
    auth.uid(),
    auth.uid()
  )
  returning * into v_draft;

  return pg_catalog.to_jsonb(v_draft)
    || pg_catalog.jsonb_build_object(
      'template_slug', v_template.slug,
      'template_name', v_template.display_name
    );
end;
$$;

create or replace function public.update_label_template_draft(
  p_version_id uuid,
  p_definition jsonb,
  p_display_name text default null,
  p_description text default null,
  p_changelog text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template public.label_templates%rowtype;
  v_draft public.label_template_versions%rowtype;
begin
  perform public.setup_require_authenticated();
  perform public.validate_label_template_definition(p_definition);

  select version.*
  into v_draft
  from public.label_template_versions version
  where version.id = p_version_id
  for update;
  if not found then
    raise exception 'Label template version not found'
      using errcode = 'P0002';
  end if;
  if v_draft.status <> 'draft' then
    raise exception 'Only draft template versions can be edited'
      using errcode = '55000';
  end if;
  if pg_catalog.length(coalesce(p_display_name, '')) > 80
    or pg_catalog.length(coalesce(p_description, '')) > 500
    or pg_catalog.length(coalesce(p_changelog, '')) > 1000
  then
    raise exception 'Template metadata is too long'
      using errcode = '22001';
  end if;

  update public.label_templates
  set
    display_name = case
      when p_display_name is null then display_name
      else pg_catalog.btrim(p_display_name)
    end,
    description = case
      when p_description is null then description
      else nullif(pg_catalog.btrim(p_description), '')
    end
  where id = v_draft.template_id
  returning * into v_template;

  update public.label_template_versions
  set
    definition = p_definition,
    definition_checksum = public.label_template_checksum(p_definition),
    changelog = case
      when p_changelog is null then changelog
      else nullif(pg_catalog.btrim(p_changelog), '')
    end
  where id = p_version_id
  returning * into v_draft;

  return pg_catalog.to_jsonb(v_draft)
    || pg_catalog.jsonb_build_object(
      'template_slug', v_template.slug,
      'template_name', v_template.display_name
    );
end;
$$;

create or replace function public.publish_label_template_version(
  p_version_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template public.label_templates%rowtype;
  v_version public.label_template_versions%rowtype;
begin
  perform public.setup_require_authenticated();

  select version.*
  into v_version
  from public.label_template_versions version
  where version.id = p_version_id
  for update;
  if not found then
    raise exception 'Label template version not found'
      using errcode = 'P0002';
  end if;
  if v_version.status <> 'draft' then
    raise exception 'Only a draft can be published'
      using errcode = '55000';
  end if;
  perform public.validate_label_template_definition(v_version.definition);

  update public.label_template_versions
  set
    status = 'published',
    published_at = pg_catalog.now(),
    published_by = auth.uid(),
    definition_checksum = public.label_template_checksum(v_version.definition)
  where id = p_version_id
  returning * into v_version;
  select *
  into v_template
  from public.label_templates
  where id = v_version.template_id;

  return pg_catalog.to_jsonb(v_version)
    || pg_catalog.jsonb_build_object(
      'template_slug', v_template.slug,
      'template_name', v_template.display_name
    );
end;
$$;

create or replace function public.set_default_label_template_version(
  p_version_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_settings public.label_template_settings%rowtype;
begin
  perform public.setup_require_authenticated();
  if not exists (
    select 1
    from public.label_template_versions version
    where version.id = p_version_id
      and version.status = 'published'
  ) then
    raise exception 'Default label template must be published'
      using errcode = '22023';
  end if;

  insert into public.label_template_settings (
    id,
    default_version_id,
    updated_by
  )
  values (1, p_version_id, auth.uid())
  on conflict (id) do update
  set default_version_id = excluded.default_version_id
  returning * into v_settings;
  return pg_catalog.to_jsonb(v_settings);
end;
$$;

create or replace function public.assign_label_template_to_production(
  p_production_id uuid,
  p_version_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_production public.productions%rowtype;
begin
  perform public.setup_require_authenticated();
  select *
  into v_production
  from public.productions
  where id = p_production_id
  for update;
  if not found then
    raise exception 'Production not found'
      using errcode = 'P0002';
  end if;
  if v_production.status <> 'planning'::public.production_status then
    raise exception 'Label template can change only in Planning'
      using errcode = '55000';
  end if;
  if not exists (
    select 1
    from public.label_template_versions version
    where version.id = p_version_id
      and version.status = 'published'
  ) then
    raise exception 'Production label template must be published'
      using errcode = '22023';
  end if;

  update public.productions
  set label_template_version_id = p_version_id
  where id = p_production_id
  returning * into v_production;
  return pg_catalog.to_jsonb(v_production);
end;
$$;

create or replace function public.resolve_label_template_for_production(
  p_production_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_production public.productions%rowtype;
  v_template public.label_templates%rowtype;
  v_version public.label_template_versions%rowtype;
  v_legacy_fallback boolean;
begin
  perform public.setup_require_authenticated();
  select *
  into v_production
  from public.productions
  where id = p_production_id;
  if not found then
    raise exception 'Production not found'
      using errcode = 'P0002';
  end if;

  v_legacy_fallback := v_production.label_template_version_id is null;
  if v_legacy_fallback then
    select version.*
    into v_version
    from public.label_template_versions version
    join public.label_templates template on template.id = version.template_id
    where template.slug = 'grid-01'
      and version.version = 1
      and version.status = 'published';
  else
    select version.*
    into v_version
    from public.label_template_versions version
    where version.id = v_production.label_template_version_id
      and version.status = 'published';
  end if;
  if not found then
    raise exception 'Published production label template not found'
      using errcode = '55000';
  end if;
  select *
  into v_template
  from public.label_templates
  where id = v_version.template_id;

  return pg_catalog.jsonb_build_object(
    'production_id', v_production.id,
    'id', v_version.id,
    'template_id', v_template.id,
    'template_slug', v_template.slug,
    'template_name', v_template.display_name,
    'version', v_version.version,
    'definition', v_version.definition,
    'definition_checksum', v_version.definition_checksum,
    'legacy_fallback', v_legacy_fallback
  );
end;
$$;

create or replace function public.complete_production_day(
  p_production_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_production public.productions%rowtype;
begin
  perform public.setup_require_authenticated();
  select *
  into v_production
  from public.productions
  where id = p_production_id
  for update;
  if not found then
    raise exception 'Production not found'
      using errcode = 'P0002';
  end if;
  if v_production.status <> 'active'::public.production_status then
    raise exception 'Only an Active production can be completed'
      using errcode = '22023';
  end if;

  update public.productions
  set status = 'complete'::public.production_status
  where id = p_production_id
  returning * into v_production;

  return pg_catalog.jsonb_build_object(
    'production', pg_catalog.to_jsonb(v_production),
    'not_asked', 0,
    'captured_unprinted', 0
  );
end;
$$;

create or replace function public.set_label_template_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug
    and exists (
      select 1
      from public.label_template_versions version
      where version.template_id = old.id
        and version.status = 'published'
    )
  then
    raise exception 'Published label template slugs are immutable'
      using errcode = '55000';
  end if;
  new.updated_at := pg_catalog.now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.enforce_label_template_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expected_checksum text;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'published' then
    raise exception 'Published label template versions are immutable'
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;

  perform public.validate_label_template_definition(new.definition);
  v_expected_checksum := public.label_template_checksum(new.definition);
  if new.definition_checksum <> v_expected_checksum then
    raise exception 'Label template checksum does not match its definition'
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'New template versions must begin as drafts'
      using errcode = '22023';
  end if;
  if tg_op = 'UPDATE'
    and new.status <> old.status
    and not (old.status = 'draft' and new.status = 'published')
  then
    raise exception 'Template status may only move from draft to published'
      using errcode = '22023';
  end if;
  if tg_op = 'UPDATE'
    and (
      new.template_id is distinct from old.template_id
      or new.version is distinct from old.version
      or new.created_at is distinct from old.created_at
      or new.created_by is distinct from old.created_by
    )
  then
    raise exception 'Template version identity and creation facts are immutable'
      using errcode = '55000';
  end if;
  if tg_op = 'INSERT' then
    new.created_at := pg_catalog.now();
    new.created_by := auth.uid();
  end if;
  if new.status = 'draft' then
    new.published_at := null;
    new.published_by := null;
  elsif tg_op = 'UPDATE' and old.status = 'draft' then
    new.published_at := pg_catalog.now();
    new.published_by := auth.uid();
  end if;
  new.updated_at := pg_catalog.now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.enforce_label_template_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Default label template settings cannot be deleted'
      using errcode = '55000';
  end if;
  if new.id <> 1 then
    raise exception 'There is exactly one label template settings row'
      using errcode = '22023';
  end if;
  if new.default_version_id is null
    or not exists (
      select 1
      from public.label_template_versions version
      where version.id = new.default_version_id
        and version.status = 'published'
    )
  then
    raise exception 'Default label template must be a published version'
      using errcode = '22023';
  end if;
  new.updated_at := pg_catalog.now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.enforce_production_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_default_version_id uuid;
  v_not_asked integer;
  v_unprinted integer;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'planning'::public.production_status then
      raise exception 'New productions must begin in Planning'
        using errcode = '22023';
    end if;
    if new.label_template_version_id is null then
      select settings.default_version_id
      into v_default_version_id
      from public.label_template_settings settings
      where settings.id = 1;
      if v_default_version_id is null then
        raise exception 'Published default label template is not configured'
          using errcode = '55000';
      end if;
      new.label_template_version_id := v_default_version_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.status <> 'planning'::public.production_status then
      raise exception 'Only Planning productions can be deleted'
        using errcode = '55000';
    end if;
    return old;
  else
    if new.status <> old.status
      and not (
        (old.status = 'planning'::public.production_status
          and new.status = 'active'::public.production_status)
        or (old.status = 'active'::public.production_status
          and new.status = 'complete'::public.production_status)
      )
    then
      raise exception 'Production status must move Planning to Active to Complete'
        using errcode = '22023';
    end if;
    if new.label_template_version_id is distinct from old.label_template_version_id
      and old.status <> 'planning'::public.production_status
    then
      raise exception 'Label template is frozen after Planning'
        using errcode = '55000';
    end if;
    if old.status = 'complete'::public.production_status then
      new.completed_at := old.completed_at;
      new.completed_by := old.completed_by;
    end if;
  end if;

  if new.label_template_version_id is not null
    and not exists (
      select 1
      from public.label_template_versions version
      where version.id = new.label_template_version_id
        and version.status = 'published'
    )
  then
    raise exception 'Productions can use only published label templates'
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'active'::public.production_status
    and new.status = 'complete'::public.production_status
  then
    select
      pg_catalog.count(*) filter (
        where roster.on_set_today is true
          and orders.status = 'not_asked'::public.order_status
      )::integer,
      pg_catalog.count(*) filter (
        where roster.on_set_today is true
          and orders.status not in (
            'not_asked'::public.order_status,
            'no_order'::public.order_status
          )
          and orders.label_printed is false
      )::integer
    into v_not_asked, v_unprinted
    from public.production_roster roster
    join public.orders orders
      on orders.roster_id = roster.id
      and orders.production_id = roster.production_id
      and orders.person_id = roster.person_id
    where roster.production_id = old.id;

    if v_not_asked <> 0 or v_unprinted <> 0 then
      raise exception
        'Complete requires zero on-set Not asked and zero captured unprinted orders'
        using
          errcode = '23514',
          detail = pg_catalog.format(
            'not_asked=%s captured_unprinted=%s',
            v_not_asked,
            v_unprinted
          );
    end if;
    new.completed_at := pg_catalog.now();
    new.completed_by := auth.uid();
  elsif new.status <> 'complete'::public.production_status then
    new.completed_at := null;
    new.completed_by := null;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_production_child_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_production_id uuid;
  v_status public.production_status;
  v_found_parent boolean := false;
begin
  for v_production_id, v_status in
    select production.id, production.status
    from public.productions production
    where production.id = any (
      case
        when tg_op = 'INSERT' then array[new.production_id]
        when tg_op = 'DELETE' then array[old.production_id]
        else array[old.production_id, new.production_id]
      end
    )
    order by production.id
    for update
  loop
    v_found_parent := true;
    if v_status = 'complete'::public.production_status then
      raise exception 'Completed production roster and orders are immutable'
        using errcode = '55000';
    end if;
  end loop;

  -- A missing parent means a permitted Planning-production cascade is already
  -- removing this child. Direct orphan writes remain blocked by foreign keys.
  if not v_found_parent then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.validate_label_template_definition(
  p_definition jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_element jsonb;
  v_segment jsonb;
  v_type text;
  v_x numeric;
  v_y numeric;
  v_width numeric;
  v_height numeric;
  v_cx numeric;
  v_cy numeric;
  v_radius numeric;
  v_radius_x numeric;
  v_radius_y numeric;
  v_font_size numeric;
  v_min_font_size numeric;
  v_segments integer;
begin
  if p_definition is null
    or pg_catalog.jsonb_typeof(p_definition) <> 'object'
  then
    raise exception 'Template definition must be a JSON object'
      using errcode = '22023';
  end if;
  if pg_catalog.octet_length(p_definition::text) > 65536 then
    raise exception 'Template definition exceeds 64 KiB'
      using errcode = '22001';
  end if;
  if p_definition::text ~* '(https?://|javascript:|data:|<script|<svg|<iframe)'
  then
    raise exception 'Template definitions cannot contain URLs or executable content'
      using errcode = '22023';
  end if;
  if not public.label_template_keys_allowed(
    p_definition,
    array['schemaVersion', 'pixelWidth', 'pixelHeight', 'background', 'elements']
  ) then
    raise exception 'Template definition contains an unsupported root key'
      using errcode = '22023';
  end if;
  if p_definition -> 'schemaVersion' is distinct from '1'::jsonb
    or p_definition -> 'pixelWidth' is distinct from '591'::jsonb
    or p_definition -> 'pixelHeight' is distinct from '354'::jsonb
    or not coalesce(
      p_definition ->> 'background' in ('#000000', '#ffffff'),
      false
    )
  then
    raise exception 'Template canvas must be schema 1, 591x354, black or white'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_definition -> 'elements') is distinct from 'array'
  then
    raise exception 'Template elements must be an array'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_definition -> 'elements') < 1
    or pg_catalog.jsonb_array_length(p_definition -> 'elements') > 96
  then
    raise exception 'Template definition must contain between 1 and 96 elements'
      using errcode = '22023';
  end if;

  for v_element in
    select value
    from pg_catalog.jsonb_array_elements(p_definition -> 'elements')
  loop
      if pg_catalog.jsonb_typeof(v_element) is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_element -> 'type') is distinct from 'string'
    then
      raise exception 'Every template element needs a string type'
        using errcode = '22023';
    end if;
    v_type := v_element ->> 'type';

    if v_type = 'text' then
      if not public.label_template_keys_allowed(
        v_element,
        array[
          'type', 'x', 'y', 'width', 'height', 'segments', 'fontSize',
          'minFontSize', 'fontWeight', 'fontFamily', 'color', 'align',
          'uppercase', 'maxLines', 'lineHeight', 'rotation'
        ]
      ) then
        raise exception 'Text element contains an unsupported key'
          using errcode = '22023';
      end if;
      v_x := public.label_template_number(v_element, 'x', true, 0, 591);
      v_y := public.label_template_number(v_element, 'y', true, 0, 354);
      v_width := public.label_template_number(v_element, 'width', true, 0.01, 591);
      v_height := public.label_template_number(v_element, 'height', true, 0.01, 354);
      if v_x + v_width > 591 or v_y + v_height > 354 then
        raise exception 'Text element exceeds the label canvas'
          using errcode = '22023';
      end if;
      v_font_size := public.label_template_number(
        v_element, 'fontSize', true, 6, 128
      );
      v_min_font_size := public.label_template_number(
        v_element, 'minFontSize', true, 6, 128
      );
      if v_min_font_size > v_font_size then
        raise exception 'Text minFontSize cannot exceed fontSize'
          using errcode = '22023';
      end if;
      perform public.label_template_number(
        v_element, 'maxLines', true, 1, 4
      );
      if (v_element ->> 'maxLines')::numeric
        <> pg_catalog.trunc((v_element ->> 'maxLines')::numeric)
      then
        raise exception 'Text maxLines must be an integer'
          using errcode = '22023';
      end if;
      perform public.label_template_number(
        v_element, 'lineHeight', true, 6, 128
      );
      if (v_element ->> 'lineHeight')::numeric < v_font_size then
        raise exception 'Text lineHeight cannot be smaller than fontSize'
          using errcode = '22023';
      end if;
      perform public.label_template_number(
        v_element, 'rotation', false, -360, 360
      );
      if v_element ->> 'fontFamily' is distinct from 'Arial'
        or not coalesce(
          v_element ->> 'fontWeight' in ('regular', 'bold'),
          false
        )
        or not coalesce(
          v_element ->> 'color' in ('#000000', '#ffffff'),
          false
        )
        or not coalesce(
          v_element ->> 'align' in ('left', 'center', 'right'),
          false
        )
      then
        raise exception 'Text style is outside the supported schema'
          using errcode = '22023';
      end if;
      if v_element ? 'uppercase'
        and pg_catalog.jsonb_typeof(v_element -> 'uppercase')
          is distinct from 'boolean'
      then
        raise exception 'Text uppercase must be a boolean'
          using errcode = '22023';
      end if;
      if pg_catalog.jsonb_typeof(v_element -> 'segments') is distinct from 'array'
      then
        raise exception 'Text segments must be an array'
          using errcode = '22023';
      end if;
      v_segments := pg_catalog.jsonb_array_length(v_element -> 'segments');
      if v_segments < 1 or v_segments > 8 then
        raise exception 'Text must contain between 1 and 8 segments'
          using errcode = '22023';
      end if;
      for v_segment in
        select value
        from pg_catalog.jsonb_array_elements(v_element -> 'segments')
      loop
        if not public.label_template_keys_allowed(
          v_segment, array['literal', 'binding']
        ) or ((v_segment ? 'literal') = (v_segment ? 'binding'))
        then
          raise exception 'Text segment needs exactly one literal or binding'
            using errcode = '22023';
        end if;
        if v_segment ? 'literal' then
          if pg_catalog.jsonb_typeof(v_segment -> 'literal')
              is distinct from 'string'
            or pg_catalog.length(v_segment ->> 'literal') > 256
            or exists (
              select 1
              from pg_catalog.generate_series(
                1,
                pg_catalog.length(v_segment ->> 'literal')
              ) as characters(character_index)
              where pg_catalog.ascii(
                pg_catalog.substr(
                  v_segment ->> 'literal',
                  characters.character_index,
                  1
                )
              ) between 0 and 31
                and pg_catalog.ascii(
                  pg_catalog.substr(
                    v_segment ->> 'literal',
                    characters.character_index,
                    1
                  )
                ) not in (9, 10, 13)
            )
          then
            raise exception 'Text literal must be a string of at most 256 characters'
              using errcode = '22023';
          end if;
        elsif pg_catalog.jsonb_typeof(v_segment -> 'binding')
            is distinct from 'string'
          or not coalesce(
            v_segment ->> 'binding' in (
              'personName',
              'drink',
              'productionName',
              'clientName',
              'productionClient',
              'group',
              'orderNumber'
            ),
            false
          )
        then
          raise exception 'Text binding is not supported'
            using errcode = '22023';
        end if;
      end loop;

    elsif v_type = 'line' then
      if not public.label_template_keys_allowed(
        v_element,
        array['type', 'x1', 'y1', 'x2', 'y2', 'stroke', 'strokeWidth']
      ) then
        raise exception 'Line element contains an unsupported key'
          using errcode = '22023';
      end if;
      perform public.label_template_number(v_element, 'x1', true, 0, 591);
      perform public.label_template_number(v_element, 'y1', true, 0, 354);
      perform public.label_template_number(v_element, 'x2', true, 0, 591);
      perform public.label_template_number(v_element, 'y2', true, 0, 354);
      perform public.label_template_number(
        v_element, 'strokeWidth', true, 0.01, 12
      );
      if not coalesce(
        v_element ->> 'stroke' in ('#000000', '#ffffff'),
        false
      ) then
        raise exception 'Line stroke is not supported'
          using errcode = '22023';
      end if;

    elsif v_type in ('rect', 'roundedRect') then
      if not public.label_template_keys_allowed(
        v_element,
        case
          when v_type = 'roundedRect'
            then array[
              'type', 'x', 'y', 'width', 'height', 'fill', 'stroke',
              'strokeWidth', 'rotation', 'radius'
            ]
          else array[
            'type', 'x', 'y', 'width', 'height', 'fill', 'stroke',
            'strokeWidth', 'rotation'
          ]
        end
      ) then
        raise exception 'Rectangle element contains an unsupported key'
          using errcode = '22023';
      end if;
      v_x := public.label_template_number(v_element, 'x', true, 0, 591);
      v_y := public.label_template_number(v_element, 'y', true, 0, 354);
      v_width := public.label_template_number(v_element, 'width', true, 0.01, 591);
      v_height := public.label_template_number(v_element, 'height', true, 0.01, 354);
      if v_x + v_width > 591 or v_y + v_height > 354 then
        raise exception 'Rectangle element exceeds the label canvas'
          using errcode = '22023';
      end if;
      if v_type = 'roundedRect' then
        v_radius := public.label_template_number(
          v_element, 'radius', true, 0, 177
        );
        if v_radius > least(v_width, v_height) / 2 then
          raise exception 'Rounded rectangle radius is too large'
            using errcode = '22023';
        end if;
      end if;
      perform public.label_template_number(
        v_element, 'strokeWidth', false, 0.01, 12
      );
      perform public.label_template_number(
        v_element, 'rotation', false, -360, 360
      );
      if not (v_element ? 'fill') and not (v_element ? 'stroke') then
        raise exception 'Rectangle needs a fill or stroke'
          using errcode = '22023';
      end if;
      if (v_element ? 'fill'
          and not coalesce(
            v_element ->> 'fill' in ('#000000', '#ffffff'),
            false
          ))
        or (v_element ? 'stroke'
          and not coalesce(
            v_element ->> 'stroke' in ('#000000', '#ffffff'),
            false
          ))
        or (v_element ? 'stroke' and not (v_element ? 'strokeWidth'))
        or (v_element ? 'strokeWidth' and not (v_element ? 'stroke'))
      then
        raise exception 'Rectangle paint is outside the supported schema'
          using errcode = '22023';
      end if;

    elsif v_type = 'circle' then
      if not public.label_template_keys_allowed(
        v_element,
        array[
          'type', 'cx', 'cy', 'radius', 'fill', 'stroke', 'strokeWidth',
          'rotation'
        ]
      ) then
        raise exception 'Circle element contains an unsupported key'
          using errcode = '22023';
      end if;
      v_cx := public.label_template_number(v_element, 'cx', true, 0, 591);
      v_cy := public.label_template_number(v_element, 'cy', true, 0, 354);
      v_radius := public.label_template_number(v_element, 'radius', true, 0.01, 177);
      if v_cx - v_radius < 0 or v_cx + v_radius > 591
        or v_cy - v_radius < 0 or v_cy + v_radius > 354
      then
        raise exception 'Circle element exceeds the label canvas'
          using errcode = '22023';
      end if;
      perform public.label_template_number(
        v_element, 'strokeWidth', false, 0.01, 12
      );
      perform public.label_template_number(
        v_element, 'rotation', false, -360, 360
      );
      if not (v_element ? 'fill') and not (v_element ? 'stroke') then
        raise exception 'Circle needs a fill or stroke'
          using errcode = '22023';
      end if;
      if (v_element ? 'fill'
          and not coalesce(
            v_element ->> 'fill' in ('#000000', '#ffffff'),
            false
          ))
        or (v_element ? 'stroke'
          and not coalesce(
            v_element ->> 'stroke' in ('#000000', '#ffffff'),
            false
          ))
        or (v_element ? 'stroke' and not (v_element ? 'strokeWidth'))
        or (v_element ? 'strokeWidth' and not (v_element ? 'stroke'))
      then
        raise exception 'Circle paint is outside the supported schema'
          using errcode = '22023';
      end if;

    elsif v_type = 'ellipse' then
      if not public.label_template_keys_allowed(
        v_element,
        array[
          'type', 'cx', 'cy', 'radiusX', 'radiusY', 'fill', 'stroke',
          'strokeWidth', 'rotation'
        ]
      ) then
        raise exception 'Ellipse element contains an unsupported key'
          using errcode = '22023';
      end if;
      v_cx := public.label_template_number(v_element, 'cx', true, 0, 591);
      v_cy := public.label_template_number(v_element, 'cy', true, 0, 354);
      v_radius_x := public.label_template_number(
        v_element, 'radiusX', true, 0.01, 295.5
      );
      v_radius_y := public.label_template_number(
        v_element, 'radiusY', true, 0.01, 177
      );
      if v_cx - v_radius_x < 0 or v_cx + v_radius_x > 591
        or v_cy - v_radius_y < 0 or v_cy + v_radius_y > 354
      then
        raise exception 'Ellipse element exceeds the label canvas'
          using errcode = '22023';
      end if;
      perform public.label_template_number(
        v_element, 'strokeWidth', false, 0.01, 12
      );
      perform public.label_template_number(
        v_element, 'rotation', false, -360, 360
      );
      if not (v_element ? 'fill') and not (v_element ? 'stroke') then
        raise exception 'Ellipse needs a fill or stroke'
          using errcode = '22023';
      end if;
      if (v_element ? 'fill'
          and not coalesce(
            v_element ->> 'fill' in ('#000000', '#ffffff'),
            false
          ))
        or (v_element ? 'stroke'
          and not coalesce(
            v_element ->> 'stroke' in ('#000000', '#ffffff'),
            false
          ))
        or (v_element ? 'stroke' and not (v_element ? 'strokeWidth'))
        or (v_element ? 'strokeWidth' and not (v_element ? 'stroke'))
      then
        raise exception 'Ellipse paint is outside the supported schema'
          using errcode = '22023';
      end if;

    elsif v_type = 'mark' then
      if not public.label_template_keys_allowed(
        v_element,
        array[
          'type', 'mark', 'x', 'y', 'width', 'height', 'fill', 'stroke',
          'strokeWidth', 'rotation'
        ]
      ) then
        raise exception 'Mark element contains an unsupported key'
          using errcode = '22023';
      end if;
      v_x := public.label_template_number(v_element, 'x', true, 0, 591);
      v_y := public.label_template_number(v_element, 'y', true, 0, 354);
      v_width := public.label_template_number(v_element, 'width', true, 0.01, 591);
      v_height := public.label_template_number(v_element, 'height', true, 0.01, 354);
      if v_x + v_width > 591 or v_y + v_height > 354 then
        raise exception 'Mark element exceeds the label canvas'
          using errcode = '22023';
      end if;
      if not coalesce(
        v_element ->> 'mark' in ('orbitGlobe', 'sparkle4'),
        false
      )
      then
        raise exception 'Mark style is outside the supported schema'
          using errcode = '22023';
      end if;
      perform public.label_template_number(
        v_element, 'strokeWidth', false, 0.01, 12
      );
      perform public.label_template_number(
        v_element, 'rotation', false, -360, 360
      );
      if not (v_element ? 'fill') and not (v_element ? 'stroke') then
        raise exception 'Mark needs a fill or stroke'
          using errcode = '22023';
      end if;
      if (v_element ? 'fill'
          and not coalesce(
            v_element ->> 'fill' in ('#000000', '#ffffff'),
            false
          ))
        or (v_element ? 'stroke'
          and not coalesce(
            v_element ->> 'stroke' in ('#000000', '#ffffff'),
            false
          ))
        or (v_element ? 'stroke' and not (v_element ? 'strokeWidth'))
        or (v_element ? 'strokeWidth' and not (v_element ? 'stroke'))
      then
        raise exception 'Mark paint is outside the supported schema'
          using errcode = '22023';
      end if;
    else
      raise exception 'Template element type "%" is not supported', v_type
        using errcode = '22023';
    end if;
  end loop;
end;
$$;


do $seed$
declare
  v_catalog jsonb := $label_catalog${
  "schemaVersion": 1,
  "pixelWidth": 591,
  "pixelHeight": 354,
  "templates": [
    {
      "id": "grid-01",
      "name": "Grid 01",
      "summary": "Asymmetric Swiss hierarchy with a strict baseline.",
      "version": 1,
      "definition": {
        "schemaVersion": 1,
        "pixelWidth": 591,
        "pixelHeight": 354,
        "background": "#ffffff",
        "elements": [
          { "type": "rect", "x": 0, "y": 0, "width": 34, "height": 354, "fill": "#000000" },
          { "type": "text", "x": 8, "y": 306, "width": 18, "height": 28, "segments": [{ "literal": "01" }], "fontFamily": "Arial", "fontSize": 18, "minFontSize": 12, "fontWeight": "bold", "color": "#ffffff", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 19, "rotation": -90 },
          { "type": "text", "x": 62, "y": 27, "width": 340, "height": 18, "segments": [{ "literal": "CAPTURE THIS COFFEE" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 27, "width": 143, "height": 18, "segments": [{ "literal": "NO. " }, { "binding": "orderNumber" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "line", "x1": 62, "y1": 57, "x2": 563, "y2": 57, "stroke": "#000000", "strokeWidth": 2 },
          { "type": "text", "x": 62, "y": 76, "width": 80, "height": 20, "segments": [{ "literal": "FOR" }], "fontFamily": "Arial", "fontSize": 16, "minFontSize": 10, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 17 },
          { "type": "text", "x": 62, "y": 98, "width": 501, "height": 110, "segments": [{ "binding": "personName" }], "fontFamily": "Arial", "fontSize": 92, "minFontSize": 29, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 2, "lineHeight": 92 },
          { "type": "text", "x": 62, "y": 223, "width": 501, "height": 62, "segments": [{ "binding": "drink" }], "fontFamily": "Arial", "fontSize": 28, "minFontSize": 18, "fontWeight": "bold", "color": "#000000", "align": "left", "maxLines": 2, "lineHeight": 29 },
          { "type": "line", "x1": 62, "y1": 293, "x2": 563, "y2": 293, "stroke": "#000000", "strokeWidth": 2 },
          { "type": "text", "x": 62, "y": 313, "width": 340, "height": 18, "segments": [{ "binding": "productionClient" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 313, "width": 143, "height": 18, "segments": [{ "binding": "group" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 }
        ]
      }
    },
    {
      "id": "grid-02",
      "name": "Grid 02",
      "summary": "A quieter modular composition with more air.",
      "version": 1,
      "definition": {
        "schemaVersion": 1,
        "pixelWidth": 591,
        "pixelHeight": 354,
        "background": "#ffffff",
        "elements": [
          { "type": "rect", "x": 0, "y": 0, "width": 104, "height": 354, "fill": "#000000" },
          { "type": "text", "x": 19, "y": 253, "width": 70, "height": 72, "segments": [{ "literal": "02" }], "fontFamily": "Arial", "fontSize": 72, "minFontSize": 42, "fontWeight": "bold", "color": "#ffffff", "align": "left", "maxLines": 1, "lineHeight": 72 },
          { "type": "text", "x": 62, "y": 37, "width": 220, "height": 18, "segments": [{ "literal": "COFFEE SERVICE" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 9, "fontWeight": "bold", "color": "#ffffff", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15, "rotation": 90 },
          { "type": "text", "x": 132, "y": 27, "width": 250, "height": 18, "segments": [{ "literal": "CTC / GRID" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 400, "y": 27, "width": 162, "height": 18, "segments": [{ "literal": "ORDER " }, { "binding": "orderNumber" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "line", "x1": 132, "y1": 57, "x2": 562, "y2": 57, "stroke": "#000000", "strokeWidth": 2 },
          { "type": "text", "x": 132, "y": 87, "width": 430, "height": 110, "segments": [{ "binding": "personName" }], "fontFamily": "Arial", "fontSize": 82, "minFontSize": 27, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 2, "lineHeight": 82 },
          { "type": "text", "x": 132, "y": 216, "width": 430, "height": 62, "segments": [{ "binding": "drink" }], "fontFamily": "Arial", "fontSize": 27, "minFontSize": 17, "fontWeight": "bold", "color": "#000000", "align": "left", "maxLines": 2, "lineHeight": 29 },
          { "type": "line", "x1": 132, "y1": 292, "x2": 562, "y2": 292, "stroke": "#000000", "strokeWidth": 2 },
          { "type": "text", "x": 132, "y": 312, "width": 280, "height": 18, "segments": [{ "binding": "productionClient" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 312, "width": 142, "height": 18, "segments": [{ "binding": "group" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 }
        ]
      }
    },
    {
      "id": "instrument",
      "name": "Instrument",
      "summary": "German industrial labeling, reduced to essentials.",
      "version": 1,
      "definition": {
        "schemaVersion": 1,
        "pixelWidth": 591,
        "pixelHeight": 354,
        "background": "#ffffff",
        "elements": [
          { "type": "text", "x": 29, "y": 26, "width": 350, "height": 18, "segments": [{ "literal": "CTC / COFFEE SERVICE" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 26, "width": 142, "height": 18, "segments": [{ "literal": "SYSTEM 03" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "line", "x1": 29, "y1": 56, "x2": 562, "y2": 56, "stroke": "#000000", "strokeWidth": 2 },
          { "type": "text", "x": 29, "y": 76, "width": 180, "height": 18, "segments": [{ "literal": "01 / PERSON" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 29, "y": 100, "width": 384, "height": 70, "segments": [{ "binding": "personName" }], "fontFamily": "Arial", "fontSize": 58, "minFontSize": 27, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 58 },
          { "type": "text", "x": 29, "y": 183, "width": 180, "height": 18, "segments": [{ "literal": "02 / ORDER" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 29, "y": 207, "width": 384, "height": 60, "segments": [{ "binding": "drink" }], "fontFamily": "Arial", "fontSize": 27, "minFontSize": 17, "fontWeight": "bold", "color": "#000000", "align": "left", "maxLines": 2, "lineHeight": 29 },
          { "type": "circle", "cx": 499, "cy": 164, "radius": 58, "stroke": "#000000", "strokeWidth": 3 },
          { "type": "line", "x1": 499, "y1": 90, "x2": 499, "y2": 106, "stroke": "#000000", "strokeWidth": 2 },
          { "type": "text", "x": 452, "y": 138, "width": 94, "height": 18, "segments": [{ "literal": "03" }], "fontFamily": "Arial", "fontSize": 13, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "center", "maxLines": 1, "lineHeight": 14 },
          { "type": "text", "x": 452, "y": 157, "width": 94, "height": 40, "segments": [{ "binding": "orderNumber" }], "fontFamily": "Arial", "fontSize": 34, "minFontSize": 16, "fontWeight": "bold", "color": "#000000", "align": "center", "maxLines": 1, "lineHeight": 35 },
          { "type": "line", "x1": 29, "y1": 293, "x2": 562, "y2": 293, "stroke": "#000000", "strokeWidth": 2 },
          { "type": "text", "x": 29, "y": 313, "width": 360, "height": 18, "segments": [{ "binding": "productionClient" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 313, "width": 142, "height": 18, "segments": [{ "binding": "group" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 }
        ]
      }
    },
    {
      "id": "contact",
      "name": "Contact",
      "summary": "Fashion contact-sheet language with frame metadata.",
      "version": 1,
      "definition": {
        "schemaVersion": 1,
        "pixelWidth": 591,
        "pixelHeight": 354,
        "background": "#ffffff",
        "elements": [
          { "type": "line", "x1": 19, "y1": 19, "x2": 39, "y2": 19, "stroke": "#000000", "strokeWidth": 3 },
          { "type": "line", "x1": 19, "y1": 19, "x2": 19, "y2": 39, "stroke": "#000000", "strokeWidth": 3 },
          { "type": "line", "x1": 572, "y1": 19, "x2": 552, "y2": 19, "stroke": "#000000", "strokeWidth": 3 },
          { "type": "line", "x1": 572, "y1": 19, "x2": 572, "y2": 39, "stroke": "#000000", "strokeWidth": 3 },
          { "type": "line", "x1": 19, "y1": 335, "x2": 39, "y2": 335, "stroke": "#000000", "strokeWidth": 3 },
          { "type": "line", "x1": 19, "y1": 335, "x2": 19, "y2": 315, "stroke": "#000000", "strokeWidth": 3 },
          { "type": "line", "x1": 572, "y1": 335, "x2": 552, "y2": 335, "stroke": "#000000", "strokeWidth": 3 },
          { "type": "line", "x1": 572, "y1": 335, "x2": 572, "y2": 315, "stroke": "#000000", "strokeWidth": 3 },
          { "type": "text", "x": 45, "y": 32, "width": 280, "height": 18, "segments": [{ "literal": "FRAME " }, { "binding": "orderNumber" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 400, "y": 32, "width": 148, "height": 18, "segments": [{ "literal": "CTC / 50X30" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "line", "x1": 45, "y1": 62, "x2": 548, "y2": 62, "stroke": "#000000", "strokeWidth": 2 },
          { "type": "text", "x": 45, "y": 90, "width": 445, "height": 112, "segments": [{ "binding": "personName" }], "fontFamily": "Arial", "fontSize": 86, "minFontSize": 27, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 2, "lineHeight": 86 },
          { "type": "text", "x": 45, "y": 218, "width": 445, "height": 62, "segments": [{ "binding": "drink" }], "fontFamily": "Arial", "fontSize": 27, "minFontSize": 17, "fontWeight": "bold", "color": "#000000", "align": "left", "maxLines": 2, "lineHeight": 29 },
          { "type": "text", "x": 45, "y": 303, "width": 330, "height": 18, "segments": [{ "binding": "productionClient" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 402, "y": 303, "width": 146, "height": 18, "segments": [{ "binding": "group" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 510, "y": 168, "width": 74, "height": 18, "segments": [{ "literal": "CONTACT" }], "fontFamily": "Arial", "fontSize": 13, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "center", "uppercase": true, "maxLines": 1, "lineHeight": 14, "rotation": -90 }
        ]
      }
    },
    {
      "id": "caption",
      "name": "Caption",
      "summary": "Editorial restraint with gallery-label precision.",
      "version": 1,
      "definition": {
        "schemaVersion": 1,
        "pixelWidth": 591,
        "pixelHeight": 354,
        "background": "#ffffff",
        "elements": [
          { "type": "text", "x": 34, "y": 28, "width": 350, "height": 18, "segments": [{ "literal": "CAPTURE THIS COFFEE" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 28, "width": 137, "height": 18, "segments": [{ "literal": "NO. " }, { "binding": "orderNumber" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 34, "y": 102, "width": 150, "height": 18, "segments": [{ "literal": "COFFEE FOR" }], "fontFamily": "Arial", "fontSize": 15, "minFontSize": 9, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 16 },
          { "type": "text", "x": 34, "y": 132, "width": 523, "height": 105, "segments": [{ "binding": "personName" }], "fontFamily": "Arial", "fontSize": 78, "minFontSize": 26, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 2, "lineHeight": 78 },
          { "type": "text", "x": 34, "y": 222, "width": 523, "height": 62, "segments": [{ "binding": "drink" }], "fontFamily": "Arial", "fontSize": 27, "minFontSize": 17, "fontWeight": "bold", "color": "#000000", "align": "left", "maxLines": 2, "lineHeight": 29 },
          { "type": "line", "x1": 34, "y1": 294, "x2": 557, "y2": 294, "stroke": "#000000", "strokeWidth": 2 },
          { "type": "text", "x": 34, "y": 313, "width": 350, "height": 18, "segments": [{ "binding": "productionClient" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 313, "width": 137, "height": 18, "segments": [{ "binding": "group" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 }
        ]
      }
    },
    {
      "id": "block",
      "name": "Block",
      "summary": "A severe brutalist field built for instant recognition.",
      "version": 1,
      "definition": {
        "schemaVersion": 1,
        "pixelWidth": 591,
        "pixelHeight": 354,
        "background": "#ffffff",
        "elements": [
          { "type": "text", "x": 27, "y": 26, "width": 350, "height": 18, "segments": [{ "literal": "CTC / SERVICE LABEL" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 26, "width": 144, "height": 18, "segments": [{ "literal": "NO. " }, { "binding": "orderNumber" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "rect", "x": 0, "y": 62, "width": 591, "height": 190, "fill": "#000000" },
          { "type": "text", "x": 27, "y": 87, "width": 537, "height": 145, "segments": [{ "binding": "personName" }], "fontFamily": "Arial", "fontSize": 86, "minFontSize": 28, "fontWeight": "bold", "color": "#ffffff", "align": "left", "uppercase": true, "maxLines": 2, "lineHeight": 86 },
          { "type": "text", "x": 27, "y": 270, "width": 537, "height": 38, "segments": [{ "binding": "drink" }], "fontFamily": "Arial", "fontSize": 30, "minFontSize": 18, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 31 },
          { "type": "text", "x": 27, "y": 321, "width": 350, "height": 18, "segments": [{ "binding": "productionClient" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 321, "width": 144, "height": 18, "segments": [{ "binding": "group" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 }
        ]
      }
    },
    {
      "id": "halo",
      "name": "Halo",
      "summary": "Holographic reveal: a bold name on bare metallic with the drink in a shimmer bar.",
      "version": 1,
      "definition": {
        "schemaVersion": 1,
        "pixelWidth": 591,
        "pixelHeight": 354,
        "background": "#ffffff",
        "elements": [
          { "type": "text", "x": 40, "y": 35, "width": 330, "height": 18, "segments": [{ "literal": "CAPTURE THIS COFFEE" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 35, "width": 131, "height": 18, "segments": [{ "literal": "NO. " }, { "binding": "orderNumber" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 40, "y": 86, "width": 511, "height": 130, "segments": [{ "binding": "personName" }], "fontFamily": "Arial", "fontSize": 104, "minFontSize": 30, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 2, "lineHeight": 104 },
          { "type": "rect", "x": 24, "y": 244, "width": 543, "height": 62, "fill": "#000000" },
          { "type": "text", "x": 48, "y": 258, "width": 495, "height": 38, "segments": [{ "binding": "drink" }], "fontFamily": "Arial", "fontSize": 30, "minFontSize": 18, "fontWeight": "bold", "color": "#ffffff", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 31 },
          { "type": "text", "x": 40, "y": 322, "width": 330, "height": 18, "segments": [{ "binding": "productionClient" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 322, "width": 131, "height": 18, "segments": [{ "binding": "group" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 }
        ]
      }
    },
    {
      "id": "orbit",
      "name": "Orbit",
      "summary": "Y2K worldwide: a chrome wireframe globe, sparkle marks, and a drink pill.",
      "version": 1,
      "definition": {
        "schemaVersion": 1,
        "pixelWidth": 591,
        "pixelHeight": 354,
        "background": "#ffffff",
        "elements": [
          { "type": "mark", "mark": "orbitGlobe", "x": 462, "y": 36, "width": 92, "height": 92, "stroke": "#000000", "strokeWidth": 3 },
          { "type": "mark", "mark": "sparkle4", "x": 438, "y": 35, "width": 18, "height": 18, "fill": "#000000" },
          { "type": "mark", "mark": "sparkle4", "x": 543, "y": 126, "width": 12, "height": 12, "fill": "#000000" },
          { "type": "text", "x": 40, "y": 37, "width": 340, "height": 18, "segments": [{ "literal": "CAPTURE THIS COFFEE" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 40, "y": 59, "width": 340, "height": 18, "segments": [{ "literal": "WORLDWIDE COFFEE SERVICE · NO. " }, { "binding": "orderNumber" }], "fontFamily": "Arial", "fontSize": 12, "minFontSize": 7, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 13 },
          { "type": "text", "x": 40, "y": 96, "width": 511, "height": 130, "segments": [{ "binding": "personName" }], "fontFamily": "Arial", "fontSize": 96, "minFontSize": 30, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 2, "lineHeight": 96 },
          { "type": "roundedRect", "x": 24, "y": 250, "width": 543, "height": 62, "radius": 31, "fill": "#000000" },
          { "type": "text", "x": 58, "y": 264, "width": 475, "height": 38, "segments": [{ "binding": "drink" }], "fontFamily": "Arial", "fontSize": 30, "minFontSize": 18, "fontWeight": "bold", "color": "#ffffff", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 31 },
          { "type": "text", "x": 40, "y": 326, "width": 330, "height": 18, "segments": [{ "binding": "productionClient" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "left", "uppercase": true, "maxLines": 1, "lineHeight": 15 },
          { "type": "text", "x": 420, "y": 326, "width": 131, "height": 18, "segments": [{ "binding": "group" }], "fontFamily": "Arial", "fontSize": 14, "minFontSize": 8, "fontWeight": "bold", "color": "#000000", "align": "right", "uppercase": true, "maxLines": 1, "lineHeight": 15 }
        ]
      }
    }
  ]
}
$label_catalog$::jsonb;
  v_item jsonb;
  v_template_id uuid;
  v_checksum text;
begin
  if v_catalog -> 'schemaVersion' <> '1'::jsonb
    or v_catalog -> 'pixelWidth' <> '591'::jsonb
    or v_catalog -> 'pixelHeight' <> '354'::jsonb
    or pg_catalog.jsonb_typeof(v_catalog -> 'templates') <> 'array'
    or pg_catalog.jsonb_array_length(v_catalog -> 'templates') <> 8
  then
    raise exception 'Build 13 canonical label catalog is invalid'
      using errcode = '22023';
  end if;

  for v_item in
    select value
    from pg_catalog.jsonb_array_elements(v_catalog -> 'templates')
  loop
    if not public.label_template_keys_allowed(
      v_item,
      array['id', 'name', 'summary', 'version', 'definition']
    ) or v_item ->> 'id' !~ '^[a-z][a-z0-9-]{1,47}$'
      or pg_catalog.length(pg_catalog.btrim(v_item ->> 'name')) not between 1 and 80
      or pg_catalog.length(pg_catalog.btrim(v_item ->> 'summary')) not between 1 and 300
      or v_item -> 'version' <> '1'::jsonb
    then
      raise exception 'Build 13 canonical template metadata is invalid'
        using errcode = '22023';
    end if;
    perform public.validate_label_template_definition(v_item -> 'definition');
    v_checksum := public.label_template_checksum(v_item -> 'definition');

    insert into public.label_templates (
      slug,
      display_name,
      description
    )
    values (
      v_item ->> 'id',
      v_item ->> 'name',
      v_item ->> 'summary'
    )
    on conflict (slug) do update
    set
      display_name = excluded.display_name,
      description = excluded.description,
      updated_at = pg_catalog.now()
    returning id into v_template_id;

    insert into public.label_template_versions (
      template_id,
      version,
      status,
      definition,
      definition_checksum,
      changelog,
      published_at
    )
    values (
      v_template_id,
      1,
      'published',
      v_item -> 'definition',
      v_checksum,
      'Bundled Build 13 template catalog.',
      pg_catalog.now()
    )
    on conflict (template_id, version) do nothing;

    if not exists (
      select 1
      from public.label_template_versions version
      where version.template_id = v_template_id
        and version.version = 1
        and version.status = 'published'
        and version.definition_checksum = v_checksum
        and version.definition = v_item -> 'definition'
    ) then
      raise exception
        'Existing template "%" v1 differs from the Build 13 catalog',
        v_item ->> 'id'
        using errcode = '23505';
    end if;
  end loop;
end;
$seed$;

insert into public.label_template_settings (id, default_version_id)
select 1, version.id
from public.label_template_versions version
join public.label_templates template on template.id = version.template_id
where template.slug = 'grid-01'
  and version.version = 1
  and version.status = 'published'
on conflict (id) do update
set
  default_version_id = excluded.default_version_id,
  updated_at = pg_catalog.now();

drop trigger if exists label_templates_set_updated_at
on public.label_templates;
create trigger label_templates_set_updated_at
before update on public.label_templates
for each row
execute function public.set_label_template_updated_at();

drop trigger if exists label_template_versions_enforce
on public.label_template_versions;
create trigger label_template_versions_enforce
before insert or update or delete on public.label_template_versions
for each row
execute function public.enforce_label_template_version();

drop trigger if exists label_template_settings_enforce
on public.label_template_settings;
create trigger label_template_settings_enforce
before insert or update or delete on public.label_template_settings
for each row
execute function public.enforce_label_template_default();

drop trigger if exists productions_enforce_lifecycle
on public.productions;
create trigger productions_enforce_lifecycle
before insert or update or delete on public.productions
for each row
execute function public.enforce_production_lifecycle();

drop trigger if exists production_roster_complete_guard
on public.production_roster;
create trigger production_roster_complete_guard
before insert or update or delete on public.production_roster
for each row
execute function public.enforce_production_child_mutation();

drop trigger if exists orders_complete_guard
on public.orders;
create trigger orders_complete_guard
before insert or update or delete on public.orders
for each row
execute function public.enforce_production_child_mutation();

-- Preserve the Build 12 setup contract without bypassing the Build 13
-- lifecycle trigger. Legacy callers may still request an Active or Complete
-- day, but the row is created in Planning, its roster is seeded atomically,
-- and then each allowed lifecycle transition is applied in order.
create or replace function public.setup_create_day(
  p_name text,
  p_client_id uuid default null,
  p_client_name text default null,
  p_shoot_date date default null,
  p_location text default null,
  p_runner_name text default null,
  p_notes text default null,
  p_status public.production_status default 'planning',
  p_seed_default_roster boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_client_name text;
  v_client_normalized text;
  v_client public.clients%rowtype;
  v_production public.productions%rowtype;
  v_person public.people%rowtype;
  v_requested_status public.production_status;
begin
  perform public.setup_require_authenticated();

  v_name := pg_catalog.btrim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'Production name is required'
      using errcode = '22023';
  end if;
  if pg_catalog.length(v_name) > 200 then
    raise exception 'Production name is too long'
      using errcode = '22001';
  end if;
  v_requested_status := coalesce(
    p_status,
    'planning'::public.production_status
  );

  if p_client_id is not null then
    select *
    into v_client
    from public.clients
    where id = p_client_id;
    if not found then
      raise exception 'Client not found'
        using errcode = 'P0002';
    end if;
  else
    v_client_name := coalesce(
      nullif(pg_catalog.btrim(p_client_name), ''),
      v_name
    );
    v_client_normalized := public.setup_normalize_name(v_client_name);
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_client_normalized, 1202)
    );

    select *
    into v_client
    from public.clients
    where public.setup_normalize_name(name) = v_client_normalized
    order by active desc, created_at desc, id
    limit 1;

    if not found then
      insert into public.clients (name, active)
      values (v_client_name, true)
      returning * into v_client;
    elsif not v_client.active then
      update public.clients
      set active = true
      where id = v_client.id
      returning * into v_client;
    end if;
  end if;

  insert into public.productions (
    name,
    client_id,
    shoot_date,
    location,
    runner_name,
    notes,
    status
  )
  values (
    v_name,
    v_client.id,
    p_shoot_date,
    nullif(pg_catalog.btrim(p_location), ''),
    nullif(pg_catalog.btrim(p_runner_name), ''),
    nullif(pg_catalog.btrim(p_notes), ''),
    'planning'::public.production_status
  )
  returning * into v_production;

  if p_seed_default_roster then
    for v_person in
      with linked as (
        select people.*, 0 as priority
        from public.client_people links
        join public.people people on people.id = links.person_id
        where links.client_id = v_client.id
          and links.active = true
          and people.active = true
      ),
      crew as (
        select people.*, 1 as priority
        from public.people
        where type = 'crew'
          and active = true
        order by name, id
        limit 4
      ),
      candidates as (
        select * from linked
        union all
        select * from crew
      ),
      ranked as (
        select
          candidates.*,
          pg_catalog.row_number() over (
            partition by candidates.id
            order by candidates.priority
          ) as duplicate_rank
        from candidates
      )
      select
        id,
        name,
        type,
        role,
        department,
        company,
        photo_url,
        usual_order,
        dietary_notes,
        notes,
        active,
        created_at
      from ranked
      where duplicate_rank = 1
      order by priority, name, id
    loop
      perform public.setup_add_person_to_roster(
        v_production.id,
        v_person.id,
        coalesce(
          nullif(pg_catalog.btrim(v_person.department), ''),
          case
            when v_person.type = 'client_contact'::public.person_type
              then v_client.name
            else nullif(pg_catalog.btrim(v_person.company), '')
          end,
          'Set'
        ),
        true
      );
    end loop;
  end if;

  if v_requested_status in (
    'active'::public.production_status,
    'complete'::public.production_status
  ) then
    update public.productions
    set status = 'active'::public.production_status
    where id = v_production.id
    returning * into v_production;
  end if;

  if v_requested_status = 'complete'::public.production_status then
    update public.productions
    set status = 'complete'::public.production_status
    where id = v_production.id
    returning * into v_production;
  end if;

  return pg_catalog.jsonb_build_object(
    'production', pg_catalog.to_jsonb(v_production),
    'client', pg_catalog.to_jsonb(v_client)
  );
end;
$$;

alter table public.label_templates enable row level security;
alter table public.label_template_versions enable row level security;
alter table public.label_template_settings enable row level security;

revoke all on public.label_templates from anon;
revoke all on public.label_template_versions from anon;
revoke all on public.label_template_settings from anon;
grant select, insert, update, delete on public.label_templates
  to authenticated;
grant select, insert, update, delete on public.label_template_versions
  to authenticated;
grant select, insert, update, delete on public.label_template_settings
  to authenticated;

drop policy if exists "Authenticated users can manage label templates"
on public.label_templates;
create policy "Authenticated users can manage label templates"
on public.label_templates for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage label template versions"
on public.label_template_versions;
create policy "Authenticated users can manage label template versions"
on public.label_template_versions for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage label template settings"
on public.label_template_settings;
create policy "Authenticated users can manage label template settings"
on public.label_template_settings for all
to authenticated
using (true)
with check (true);

revoke all on function public.label_template_checksum(jsonb)
  from public, anon;
revoke all on function public.label_template_keys_allowed(jsonb, text[])
  from public, anon;
revoke all on function public.label_template_number(
  jsonb, text, boolean, numeric, numeric
) from public, anon;
revoke all on function public.validate_label_template_definition(jsonb)
  from public, anon;
revoke all on function public.set_label_template_updated_at()
  from public, anon;
revoke all on function public.enforce_label_template_version()
  from public, anon;
revoke all on function public.enforce_label_template_default()
  from public, anon;
revoke all on function public.enforce_production_lifecycle()
  from public, anon;
revoke all on function public.enforce_production_child_mutation()
  from public, anon;
revoke all on function public.create_label_template_draft(
  uuid, text, text, text, jsonb, text
) from public, anon;
revoke all on function public.update_label_template_draft(
  uuid, jsonb, text, text, text
) from public, anon;
revoke all on function public.publish_label_template_version(uuid)
  from public, anon;
revoke all on function public.set_default_label_template_version(uuid)
  from public, anon;
revoke all on function public.assign_label_template_to_production(uuid, uuid)
  from public, anon;
revoke all on function public.resolve_label_template_for_production(uuid)
  from public, anon;
revoke all on function public.complete_production_day(uuid)
  from public, anon;

grant execute on function public.label_template_checksum(jsonb)
  to authenticated;
grant execute on function public.label_template_keys_allowed(jsonb, text[])
  to authenticated;
grant execute on function public.label_template_number(
  jsonb, text, boolean, numeric, numeric
) to authenticated;
grant execute on function public.validate_label_template_definition(jsonb)
  to authenticated;
grant execute on function public.create_label_template_draft(
  uuid, text, text, text, jsonb, text
) to authenticated;
grant execute on function public.update_label_template_draft(
  uuid, jsonb, text, text, text
) to authenticated;
grant execute on function public.publish_label_template_version(uuid)
  to authenticated;
grant execute on function public.set_default_label_template_version(uuid)
  to authenticated;
grant execute on function public.assign_label_template_to_production(uuid, uuid)
  to authenticated;
grant execute on function public.resolve_label_template_for_production(uuid)
  to authenticated;
grant execute on function public.complete_production_day(uuid)
  to authenticated;
