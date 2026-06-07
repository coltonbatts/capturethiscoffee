-- Keep person photos available to signed-in demo users, but not anonymous users.

update storage.buckets
set public = false
where id = 'person-photos';

drop policy if exists "Public can read person photos" on storage.objects;
drop policy if exists "Staff can manage person photos" on storage.objects;
drop policy if exists "Authenticated users can manage person photos" on storage.objects;

create policy "Authenticated users can manage person photos"
on storage.objects for all
to authenticated
using (bucket_id = 'person-photos')
with check (bucket_id = 'person-photos');
