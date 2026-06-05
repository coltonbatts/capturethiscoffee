-- Staff-managed public bucket for roster/person headshots.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'person-photos',
  'person-photos',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read person photos" on storage.objects;
create policy "Public can read person photos"
on storage.objects for select
to public
using (bucket_id = 'person-photos');

drop policy if exists "Staff can manage person photos" on storage.objects;
create policy "Staff can manage person photos"
on storage.objects for all
to authenticated
using (
  bucket_id = 'person-photos'
  and coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true
)
with check (
  bucket_id = 'person-photos'
  and coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false) = true
);
