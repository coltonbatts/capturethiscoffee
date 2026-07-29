-- Build 12 native setup contracts.
--
-- Setup remains online-only. These functions run as the signed-in caller so
-- the existing authenticated RLS policies remain the authorization boundary.
-- Multi-row writes live in one Postgres statement/transaction and the deferred
-- integrity triggers reject any committed roster row without exactly one
-- matching order.

create or replace function public.setup_normalize_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(coalesce(p_value, '')),
      E'\\s+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.setup_require_authenticated()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.setup_parse_usual_order(p_value text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_value text := coalesce(p_value, '');
  v_lower text := pg_catalog.lower(coalesce(p_value, ''));
  v_parts text[];
  v_part text;
  v_normalized text;
  v_size text := '';
  v_temperature text := '';
  v_milk text := '';
  v_drink text := '';
  v_special text := '';
begin
  select coalesce(pg_catalog.array_agg(part order by ordinality), '{}'::text[])
  into v_parts
  from (
    select pg_catalog.btrim(value) as part, ordinality
    from pg_catalog.unnest(
      pg_catalog.regexp_split_to_array(v_value, E'\\s*,\\s*')
    ) with ordinality parts(value, ordinality)
    where pg_catalog.btrim(value) <> ''
  ) parsed;

  if exists (
    select 1 from pg_catalog.unnest(v_parts) part
    where pg_catalog.lower(part) = 'small'
  ) then
    v_size := 'Small';
  elsif exists (
    select 1 from pg_catalog.unnest(v_parts) part
    where pg_catalog.lower(part) = 'medium'
  ) then
    v_size := 'Medium';
  elsif exists (
    select 1 from pg_catalog.unnest(v_parts) part
    where pg_catalog.lower(part) = 'large'
  ) then
    v_size := 'Large';
  end if;

  v_temperature := case
    when v_lower like '%iced%' or v_lower like '%cold%' then 'Iced'
    when v_lower like '%hot%' then 'Hot'
    else ''
  end;
  v_milk := case
    when v_lower like '%oat%' then 'Oat'
    when v_lower like '%almond%' then 'Almond'
    when v_lower like '%whole%' then 'Whole'
    when v_lower like '%cream%' then 'Cream'
    else ''
  end;

  foreach v_part in array v_parts
  loop
    v_normalized := pg_catalog.lower(v_part);
    if v_drink = ''
      and v_normalized not in ('small', 'medium', 'large', 'hot', 'iced')
      and (
        v_milk = ''
        or v_normalized <> (pg_catalog.lower(v_milk) || ' milk')
      )
    then
      v_drink := v_part;
    end if;
  end loop;
  if v_drink = '' and pg_catalog.array_length(v_parts, 1) > 0 then
    v_drink := v_parts[1];
  end if;

  foreach v_part in array v_parts
  loop
    v_normalized := pg_catalog.lower(v_part);
    if v_part <> v_drink
      and v_normalized not in ('small', 'medium', 'large', 'hot', 'iced')
      and (
        v_milk = ''
        or v_normalized <> (pg_catalog.lower(v_milk) || ' milk')
      )
    then
      v_special := v_special
        || case when v_special = '' then '' else ', ' end
        || v_part;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'drink_type', v_drink,
    'size', v_size,
    'temperature', v_temperature,
    'milk_type', v_milk,
    'sweetener', case
      when v_lower like '%half sweet%' then 'Half sweet'
      when v_lower like '%sweet%' then 'Sweetened'
      else ''
    end,
    'special_notes', v_special
  );
end;
$$;

create unique index if not exists people_normalized_name_idx
on public.people (public.setup_normalize_name(name));

create unique index if not exists production_roster_identity_idx
on public.production_roster (id, production_id, person_id);

do $$
begin
  alter table public.orders
    add constraint orders_roster_identity_fkey
    foreign key (roster_id, production_id, person_id)
    references public.production_roster (id, production_id, person_id)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end;
$$;

alter table public.orders
  validate constraint orders_roster_identity_fkey;

do $$
begin
  if exists (
    select 1
    from public.production_roster roster
    left join public.orders orders
      on orders.roster_id = roster.id
      and orders.production_id = roster.production_id
      and orders.person_id = roster.person_id
    group by roster.id
    having pg_catalog.count(orders.id) <> 1
  ) then
    raise exception
      'Existing roster/order integrity must be repaired before Build 12';
  end if;
end;
$$;

create or replace function public.setup_enforce_roster_order_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_roster_id uuid;
  v_production_id uuid;
  v_person_id uuid;
  v_order_count integer;
begin
  if tg_table_name = 'production_roster' then
    v_roster_id := new.id;
    v_production_id := new.production_id;
    v_person_id := new.person_id;
  else
    v_roster_id := old.roster_id;
    v_production_id := old.production_id;
    v_person_id := old.person_id;
  end if;

  if not exists (
    select 1
    from public.production_roster roster
    where roster.id = v_roster_id
      and roster.production_id = v_production_id
      and roster.person_id = v_person_id
  ) then
    return null;
  end if;

  select pg_catalog.count(*)::integer
  into v_order_count
  from public.orders orders
  where orders.roster_id = v_roster_id
    and orders.production_id = v_production_id
    and orders.person_id = v_person_id;

  if v_order_count <> 1 then
    raise exception
      'Roster member must have exactly one matching initial order'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

drop trigger if exists setup_roster_requires_order
on public.production_roster;
create constraint trigger setup_roster_requires_order
after insert or update on public.production_roster
deferrable initially deferred
for each row
execute function public.setup_enforce_roster_order_integrity();

drop trigger if exists setup_order_preserves_roster_integrity
on public.orders;
create constraint trigger setup_order_preserves_roster_integrity
after delete or update on public.orders
deferrable initially deferred
for each row
execute function public.setup_enforce_roster_order_integrity();

create or replace function public.setup_add_person_to_roster(
  p_production_id uuid,
  p_person_id uuid,
  p_group_label text default null,
  p_on_set_today boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_person public.people%rowtype;
  v_roster public.production_roster%rowtype;
  v_order public.orders%rowtype;
  v_order_fields jsonb;
  v_group_label text;
  v_sort_order integer;
begin
  perform public.setup_require_authenticated();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_production_id::text, 1200)
  );

  if not exists (
    select 1
    from public.productions
    where id = p_production_id
  ) then
    raise exception 'Production not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_person
  from public.people
  where id = p_person_id
    and active = true;
  if not found then
    raise exception 'Active person not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.production_roster
    where production_id = p_production_id
      and person_id = p_person_id
  ) then
    raise exception 'Person is already on this roster'
      using errcode = '23505';
  end if;

  v_group_label := nullif(
    pg_catalog.btrim(coalesce(p_group_label, '')),
    ''
  );
  if pg_catalog.length(v_group_label) > 200 then
    raise exception 'Group label is too long'
      using errcode = '22001';
  end if;
  v_group_label := coalesce(
    v_group_label,
    nullif(pg_catalog.btrim(v_person.department), ''),
    nullif(pg_catalog.btrim(v_person.company), ''),
    'Set'
  );

  select coalesce(pg_catalog.max(sort_order), 0) + 1
  into v_sort_order
  from public.production_roster
  where production_id = p_production_id;

  insert into public.production_roster (
    production_id,
    person_id,
    group_label,
    on_set_today,
    sort_order
  )
  values (
    p_production_id,
    p_person_id,
    v_group_label,
    coalesce(p_on_set_today, true),
    v_sort_order
  )
  returning * into v_roster;

  v_order_fields := public.setup_parse_usual_order(v_person.usual_order);
  insert into public.orders (
    production_id,
    roster_id,
    person_id,
    drink_type,
    size,
    temperature,
    milk_type,
    sweetener,
    caffeine,
    special_notes,
    status,
    label_printed
  )
  values (
    p_production_id,
    v_roster.id,
    p_person_id,
    nullif(v_order_fields ->> 'drink_type', ''),
    nullif(v_order_fields ->> 'size', ''),
    nullif(v_order_fields ->> 'temperature', ''),
    nullif(v_order_fields ->> 'milk_type', ''),
    nullif(v_order_fields ->> 'sweetener', ''),
    'Regular',
    nullif(v_order_fields ->> 'special_notes', ''),
    'not_asked',
    false
  )
  returning * into v_order;

  return pg_catalog.jsonb_build_object(
    'person', pg_catalog.to_jsonb(v_person),
    'roster', pg_catalog.to_jsonb(v_roster),
    'order', pg_catalog.to_jsonb(v_order)
  );
end;
$$;

create or replace function public.setup_create_person(
  p_name text,
  p_type public.person_type default 'crew',
  p_role text default null,
  p_department text default null,
  p_company text default null,
  p_photo_url text default null,
  p_usual_order text default null,
  p_dietary_notes text default null,
  p_notes text default null,
  p_active boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_normalized_name text;
  v_person public.people%rowtype;
begin
  perform public.setup_require_authenticated();

  v_name := pg_catalog.btrim(coalesce(p_name, ''));
  v_normalized_name := public.setup_normalize_name(v_name);
  if v_normalized_name = '' then
    raise exception 'Name is required'
      using errcode = '22023';
  end if;
  if pg_catalog.length(v_name) > 200 then
    raise exception 'Name is too long'
      using errcode = '22001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_normalized_name, 1201)
  );
  if exists (
    select 1
    from public.people
    where public.setup_normalize_name(name) = v_normalized_name
  ) then
    raise exception 'A person with this name already exists'
      using errcode = '23505';
  end if;

  insert into public.people (
    name,
    type,
    role,
    department,
    company,
    photo_url,
    usual_order,
    dietary_notes,
    notes,
    active
  )
  values (
    v_name,
    coalesce(p_type, 'crew'::public.person_type),
    nullif(pg_catalog.btrim(p_role), ''),
    nullif(pg_catalog.btrim(p_department), ''),
    nullif(pg_catalog.btrim(p_company), ''),
    nullif(pg_catalog.btrim(p_photo_url), ''),
    nullif(pg_catalog.btrim(p_usual_order), ''),
    nullif(pg_catalog.btrim(p_dietary_notes), ''),
    nullif(pg_catalog.btrim(p_notes), ''),
    coalesce(p_active, true)
  )
  returning * into v_person;

  return pg_catalog.to_jsonb(v_person);
end;
$$;

create or replace function public.setup_create_person_and_add_to_roster(
  p_production_id uuid,
  p_name text,
  p_type public.person_type default 'crew',
  p_role text default null,
  p_department text default null,
  p_company text default null,
  p_photo_url text default null,
  p_usual_order text default null,
  p_dietary_notes text default null,
  p_notes text default null,
  p_group_label text default null,
  p_on_set_today boolean default true,
  p_link_to_client boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_person jsonb;
  v_result jsonb;
  v_person_id uuid;
  v_client_id uuid;
begin
  perform public.setup_require_authenticated();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_production_id::text, 1200)
  );

  select client_id
  into v_client_id
  from public.productions
  where id = p_production_id;
  if not found then
    raise exception 'Production not found'
      using errcode = 'P0002';
  end if;

  v_person := public.setup_create_person(
    p_name,
    p_type,
    p_role,
    p_department,
    p_company,
    p_photo_url,
    p_usual_order,
    p_dietary_notes,
    p_notes
  );
  v_person_id := (v_person ->> 'id')::uuid;

  v_result := public.setup_add_person_to_roster(
    p_production_id,
    v_person_id,
    p_group_label,
    p_on_set_today
  );

  if p_link_to_client
    and p_type in ('client_contact'::public.person_type, 'agency'::public.person_type)
  then
    insert into public.client_people (
      client_id,
      person_id,
      relationship_notes,
      active
    )
    values (v_client_id, v_person_id, null, true)
    on conflict (client_id, person_id)
    do update set active = true;
  end if;

  return v_result;
end;
$$;

create or replace function public.setup_update_person(
  p_person_id uuid,
  p_name text,
  p_type public.person_type default 'crew',
  p_role text default null,
  p_department text default null,
  p_company text default null,
  p_photo_url text default null,
  p_usual_order text default null,
  p_dietary_notes text default null,
  p_notes text default null,
  p_active boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_normalized_name text;
  v_person public.people%rowtype;
begin
  perform public.setup_require_authenticated();

  v_name := pg_catalog.btrim(coalesce(p_name, ''));
  v_normalized_name := public.setup_normalize_name(v_name);
  if v_normalized_name = '' then
    raise exception 'Name is required'
      using errcode = '22023';
  end if;
  if pg_catalog.length(v_name) > 200 then
    raise exception 'Name is too long'
      using errcode = '22001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_normalized_name, 1201)
  );
  if exists (
    select 1
    from public.people
    where public.setup_normalize_name(name) = v_normalized_name
      and id <> p_person_id
  ) then
    raise exception 'A person with this name already exists'
      using errcode = '23505';
  end if;

  update public.people
  set
    name = v_name,
    type = coalesce(p_type, type),
    role = nullif(pg_catalog.btrim(p_role), ''),
    department = nullif(pg_catalog.btrim(p_department), ''),
    company = nullif(pg_catalog.btrim(p_company), ''),
    photo_url = nullif(pg_catalog.btrim(p_photo_url), ''),
    usual_order = nullif(pg_catalog.btrim(p_usual_order), ''),
    dietary_notes = nullif(pg_catalog.btrim(p_dietary_notes), ''),
    notes = nullif(pg_catalog.btrim(p_notes), ''),
    active = coalesce(p_active, active)
  where id = p_person_id
  returning * into v_person;

  if not found then
    raise exception 'Person not found'
      using errcode = 'P0002';
  end if;

  return pg_catalog.to_jsonb(v_person);
end;
$$;

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
    -- productions.client_id is intentionally still non-null for frozen-web
    -- compatibility. A blank optional brand uses the day name, matching the
    -- existing web creation behavior.
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
    coalesce(p_status, 'planning'::public.production_status)
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

  return pg_catalog.jsonb_build_object(
    'production', pg_catalog.to_jsonb(v_production),
    'client', pg_catalog.to_jsonb(v_client)
  );
end;
$$;

create or replace function public.setup_update_day(
  p_production_id uuid,
  p_name text,
  p_client_id uuid default null,
  p_client_name text default null,
  p_shoot_date date default null,
  p_location text default null,
  p_runner_name text default null,
  p_notes text default null,
  p_status public.production_status default 'planning'
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
begin
  perform public.setup_require_authenticated();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_production_id::text, 1200)
  );

  if not exists (
    select 1 from public.productions where id = p_production_id
  ) then
    raise exception 'Production not found'
      using errcode = 'P0002';
  end if;

  v_name := pg_catalog.btrim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'Production name is required'
      using errcode = '22023';
  end if;
  if pg_catalog.length(v_name) > 200 then
    raise exception 'Production name is too long'
      using errcode = '22001';
  end if;

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

  update public.productions
  set
    name = v_name,
    client_id = v_client.id,
    shoot_date = p_shoot_date,
    location = nullif(pg_catalog.btrim(p_location), ''),
    runner_name = nullif(pg_catalog.btrim(p_runner_name), ''),
    notes = nullif(pg_catalog.btrim(p_notes), ''),
    status = coalesce(p_status, status)
  where id = p_production_id
  returning * into v_production;

  return pg_catalog.jsonb_build_object(
    'production', pg_catalog.to_jsonb(v_production),
    'client', pg_catalog.to_jsonb(v_client)
  );
end;
$$;

create or replace function public.setup_delete_planning_day(
  p_production_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted_id uuid;
begin
  perform public.setup_require_authenticated();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_production_id::text, 1200)
  );

  delete from public.productions
  where id = p_production_id
    and status = 'planning'::public.production_status
  returning id into v_deleted_id;

  if v_deleted_id is null then
    if exists (
      select 1 from public.productions where id = p_production_id
    ) then
      raise exception 'Only planning days can be deleted'
        using errcode = '22023';
    end if;
    raise exception 'Production not found'
      using errcode = 'P0002';
  end if;

  return v_deleted_id;
end;
$$;

create or replace function public.setup_bulk_add_roster(
  p_production_id uuid,
  p_people jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_duplicate_count integer;
  v_item jsonb;
  v_person public.people%rowtype;
  v_person_json jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_person_id uuid;
  v_normalized_name text;
begin
  perform public.setup_require_authenticated();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_production_id::text, 1200)
  );

  if not exists (
    select 1 from public.productions where id = p_production_id
  ) then
    raise exception 'Production not found'
      using errcode = 'P0002';
  end if;

  if p_people is null or pg_catalog.jsonb_typeof(p_people) <> 'array' then
    raise exception 'Reviewed people must be a JSON array'
      using errcode = '22023';
  end if;

  v_count := pg_catalog.jsonb_array_length(p_people);
  if v_count < 1 or v_count > 200 then
    raise exception 'Bulk roster must contain between 1 and 200 people'
      using errcode = '22023';
  end if;

  select pg_catalog.count(*)::integer - pg_catalog.count(distinct normalized)::integer
  into v_duplicate_count
  from (
    select public.setup_normalize_name(value ->> 'name') as normalized
    from pg_catalog.jsonb_array_elements(p_people)
  ) names;
  if v_duplicate_count > 0 then
    raise exception 'Bulk roster contains duplicate normalized names'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_people) item
    where public.setup_normalize_name(item ->> 'name') = ''
  ) then
    raise exception 'Every bulk roster person needs a name'
      using errcode = '22023';
  end if;

  -- Acquire name locks in a stable order before inserting any people.
  for v_normalized_name in
    select public.setup_normalize_name(value ->> 'name')
    from pg_catalog.jsonb_array_elements(p_people)
    order by 1
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_normalized_name, 1201)
    );
  end loop;

  for v_item in
    select value
    from pg_catalog.jsonb_array_elements(p_people) with ordinality
    order by ordinality
  loop
    v_person_id := null;
    if nullif(v_item ->> 'person_id', '') is not null then
      begin
        v_person_id := (v_item ->> 'person_id')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'Bulk roster contains an invalid person ID'
            using errcode = '22023';
      end;

      select *
      into v_person
      from public.people
      where id = v_person_id
        and active = true;
      if not found then
        raise exception 'Bulk roster references a missing or archived person'
          using errcode = 'P0002';
      end if;
      if public.setup_normalize_name(v_person.name)
        <> public.setup_normalize_name(v_item ->> 'name')
      then
        raise exception 'Bulk roster person ID does not match its reviewed name'
          using errcode = '22023';
      end if;
    else
      v_normalized_name := public.setup_normalize_name(v_item ->> 'name');
      select *
      into v_person
      from public.people
      where public.setup_normalize_name(name) = v_normalized_name
      order by active desc, created_at, id
      limit 1;

      if found then
        if not v_person.active then
          raise exception 'Bulk roster name matches an archived person'
            using errcode = '23505';
        end if;
        v_person_id := v_person.id;
      else
        v_person_json := public.setup_create_person(
          v_item ->> 'name',
          case
            when v_item ->> 'type' in ('client_contact', 'agency', 'crew', 'guest')
              then (v_item ->> 'type')::public.person_type
            else 'crew'::public.person_type
          end,
          v_item ->> 'role',
          v_item ->> 'department',
          v_item ->> 'company',
          null,
          v_item ->> 'usual_order',
          v_item ->> 'dietary_notes',
          v_item ->> 'notes'
        );
        v_person_id := (v_person_json ->> 'id')::uuid;
      end if;
    end if;

    v_result := public.setup_add_person_to_roster(
      p_production_id,
      v_person_id,
      v_item ->> 'group_label',
      coalesce((v_item ->> 'on_set_today')::boolean, true)
    );
    v_results := v_results || pg_catalog.jsonb_build_array(v_result);
  end loop;

  return v_results;
end;
$$;

create or replace function public.setup_reorder_roster(
  p_production_id uuid,
  p_roster_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected integer;
  v_received integer;
  v_distinct integer;
  v_unknown integer;
  v_roster jsonb;
begin
  perform public.setup_require_authenticated();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_production_id::text, 1200)
  );

  select pg_catalog.count(*)::integer
  into v_expected
  from public.production_roster
  where production_id = p_production_id;

  v_received := coalesce(pg_catalog.array_length(p_roster_ids, 1), 0);
  select pg_catalog.count(distinct id)::integer
  into v_distinct
  from pg_catalog.unnest(coalesce(p_roster_ids, '{}'::uuid[])) id;

  select pg_catalog.count(*)::integer
  into v_unknown
  from pg_catalog.unnest(coalesce(p_roster_ids, '{}'::uuid[])) id
  where not exists (
    select 1
    from public.production_roster roster
    where roster.id = id
      and roster.production_id = p_production_id
  );

  if v_received <> v_expected
    or v_distinct <> v_received
    or v_unknown <> 0
  then
    raise exception 'Roster reorder must include every member exactly once'
      using errcode = '22023';
  end if;

  update public.production_roster roster
  set sort_order = ordered.ordinality
  from pg_catalog.unnest(p_roster_ids) with ordinality ordered(id, ordinality)
  where roster.id = ordered.id
    and roster.production_id = p_production_id;

  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(roster) order by roster.sort_order),
    '[]'::jsonb
  )
  into v_roster
  from public.production_roster roster
  where roster.production_id = p_production_id;

  return v_roster;
end;
$$;

create or replace function public.fetch_day_summaries()
returns table (
  id uuid,
  name text,
  client_name text,
  shoot_date date,
  status public.production_status,
  total integer,
  captured integer,
  skipped integer,
  printed integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.setup_require_authenticated();

  return query
  select
    production.id,
    production.name,
    coalesce(client.name, ''),
    production.shoot_date,
    production.status,
    pg_catalog.count(roster.id)
      filter (where roster.on_set_today is true)::integer as total,
    pg_catalog.count(orders.id)
      filter (
        where roster.on_set_today is true
          and orders.status not in (
            'not_asked'::public.order_status,
            'no_order'::public.order_status
          )
      )::integer as captured,
    pg_catalog.count(orders.id)
      filter (
        where roster.on_set_today is true
          and orders.status = 'no_order'::public.order_status
      )::integer as skipped,
    pg_catalog.count(orders.id)
      filter (
        where roster.on_set_today is true
          and orders.status not in (
            'not_asked'::public.order_status,
            'no_order'::public.order_status
          )
          and orders.label_printed is true
      )::integer as printed
  from public.productions production
  left join public.clients client on client.id = production.client_id
  left join public.production_roster roster
    on roster.production_id = production.id
  left join public.orders orders
    on orders.roster_id = roster.id
    and orders.production_id = roster.production_id
    and orders.person_id = roster.person_id
  group by
    production.id,
    production.name,
    client.name,
    production.shoot_date,
    production.status
  order by
    case production.status
      when 'active'::public.production_status then 0
      when 'planning'::public.production_status then 1
      else 2
    end,
    production.shoot_date nulls last,
    production.name,
    production.id
  limit 2000;
end;
$$;

revoke all on function public.setup_normalize_name(text) from public, anon;
revoke all on function public.setup_require_authenticated() from public, anon;
revoke all on function public.setup_parse_usual_order(text) from public, anon;
revoke all on function public.setup_enforce_roster_order_integrity() from public, anon;
revoke all on function public.setup_add_person_to_roster(uuid, uuid, text, boolean)
  from public, anon;
revoke all on function public.setup_create_person(
  text,
  public.person_type,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
) from public, anon;
revoke all on function public.setup_create_person_and_add_to_roster(
  uuid,
  text,
  public.person_type,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
) from public, anon;
revoke all on function public.setup_update_person(
  uuid,
  text,
  public.person_type,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
) from public, anon;
revoke all on function public.setup_create_day(
  text,
  uuid,
  text,
  date,
  text,
  text,
  text,
  public.production_status,
  boolean
) from public, anon;
revoke all on function public.setup_update_day(
  uuid,
  text,
  uuid,
  text,
  date,
  text,
  text,
  text,
  public.production_status
) from public, anon;
revoke all on function public.setup_delete_planning_day(uuid)
  from public, anon;
revoke all on function public.setup_bulk_add_roster(uuid, jsonb)
  from public, anon;
revoke all on function public.setup_reorder_roster(uuid, uuid[])
  from public, anon;
revoke all on function public.fetch_day_summaries() from public, anon;

grant execute on function public.setup_normalize_name(text) to authenticated;
grant execute on function public.setup_require_authenticated() to authenticated;
grant execute on function public.setup_parse_usual_order(text) to authenticated;
grant execute on function public.setup_add_person_to_roster(uuid, uuid, text, boolean)
  to authenticated;
grant execute on function public.setup_create_person(
  text,
  public.person_type,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
) to authenticated;
grant execute on function public.setup_create_person_and_add_to_roster(
  uuid,
  text,
  public.person_type,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
) to authenticated;
grant execute on function public.setup_update_person(
  uuid,
  text,
  public.person_type,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
) to authenticated;
grant execute on function public.setup_create_day(
  text,
  uuid,
  text,
  date,
  text,
  text,
  text,
  public.production_status,
  boolean
) to authenticated;
grant execute on function public.setup_update_day(
  uuid,
  text,
  uuid,
  text,
  date,
  text,
  text,
  text,
  public.production_status
) to authenticated;
grant execute on function public.setup_delete_planning_day(uuid)
  to authenticated;
grant execute on function public.setup_bulk_add_roster(uuid, jsonb)
  to authenticated;
grant execute on function public.setup_reorder_roster(uuid, uuid[])
  to authenticated;
grant execute on function public.fetch_day_summaries() to authenticated;
