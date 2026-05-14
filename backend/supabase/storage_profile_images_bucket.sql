-- Run in Supabase SQL Editor if profile image uploads fail with "bucket not found".
-- Default bucket name matches frontend upload (override with VITE_SUPABASE_PROFILE_IMAGES_BUCKET).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated upload profile-images" on storage.objects;
create policy "Authenticated upload profile-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-images');

drop policy if exists "Public read profile-images" on storage.objects;
create policy "Public read profile-images"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-images');

drop policy if exists "Authenticated update own profile-images" on storage.objects;
create policy "Authenticated update own profile-images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-images');

drop policy if exists "Authenticated delete own profile-images" on storage.objects;
create policy "Authenticated delete own profile-images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-images');
