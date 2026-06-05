-- Remove sample people and their dependent records from live projects.
with sample_people as (
  select id
  from public.people
  where name in (
    'Ava Chen',
    'Marcus Reed',
    'Jules Rivera',
    'Sam Patel',
    'Mia Torres'
  )
)
delete from public.orders
where person_id in (select id from sample_people);

with sample_people as (
  select id
  from public.people
  where name in (
    'Ava Chen',
    'Marcus Reed',
    'Jules Rivera',
    'Sam Patel',
    'Mia Torres'
  )
)
delete from public.production_roster
where person_id in (select id from sample_people);

with sample_people as (
  select id
  from public.people
  where name in (
    'Ava Chen',
    'Marcus Reed',
    'Jules Rivera',
    'Sam Patel',
    'Mia Torres'
  )
)
delete from public.client_people
where person_id in (select id from sample_people);

delete from public.people
where name in (
  'Ava Chen',
  'Marcus Reed',
  'Jules Rivera',
  'Sam Patel',
  'Mia Torres'
);
