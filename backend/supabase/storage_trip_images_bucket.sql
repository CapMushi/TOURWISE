-- Run in Supabase SQL Editor if uploads fail with "bucket not found".
-- Default bucket name matches frontend upload (override with VITE_SUPABASE_TRIP_IMAGES_BUCKET).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-images',
  'trip-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Authenticated users can upload trip images (anon uses JWT when logged in)
drop policy if exists "Authenticated upload trip-images" on storage.objects;
create policy "Authenticated upload trip-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'trip-images');

drop policy if exists "Public read trip-images" on storage.objects;
create policy "Public read trip-images"
  on storage.objects for select
  to public
  using (bucket_id = 'trip-images');

drop policy if exists "Authenticated update own trip-images" on storage.objects;
create policy "Authenticated update own trip-images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'trip-images');

drop policy if exists "Authenticated delete own trip-images" on storage.objects;
create policy "Authenticated delete own trip-images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'trip-images');
