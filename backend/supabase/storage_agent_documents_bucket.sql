-- Agent Verification v2 — Phase 1, private documents bucket.
-- Run in Supabase SQL Editor.
--
-- This bucket stores PII (CNIC images, business licenses) so it is PRIVATE.
-- Reads happen only via signed URLs minted by the backend (service-role),
-- never via getPublicUrl().
--
-- Path convention enforced by RLS:  <user_id>/<doc_kind>_<unix_ts>.<ext>
-- The first path segment must equal auth.uid()::text, so owners can only
-- read/write their own folder.
--
-- Override the bucket name with VITE_SUPABASE_AGENT_DOCS_BUCKET on the
-- frontend if you change 'agent-documents' below.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agent-documents',
  'agent-documents',
  false,
  10485760,  -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- Owner-only INSERT: the user can only upload into a path whose first
-- segment is their auth.uid().
drop policy if exists "Owner upload agent-documents" on storage.objects;
create policy "Owner upload agent-documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'agent-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );


-- Owner-only SELECT: same path rule.
-- Admins fetch documents via the backend, which uses the Supabase service
-- role to mint signed URLs and bypasses RLS, so admins are NOT granted
-- direct SELECT here.
drop policy if exists "Owner read agent-documents" on storage.objects;
create policy "Owner read agent-documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'agent-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );


drop policy if exists "Owner update agent-documents" on storage.objects;
create policy "Owner update agent-documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'agent-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );


drop policy if exists "Owner delete agent-documents" on storage.objects;
create policy "Owner delete agent-documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'agent-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );


-- -----------------------------------------------------------------------------
-- Verification queries (run separately after the migration succeeds)
-- -----------------------------------------------------------------------------
--
-- -- a) Bucket exists and is private
-- select id, public, file_size_limit, allowed_mime_types
-- from storage.buckets
-- where id = 'agent-documents';
-- -- Expected: public = false
--
-- -- b) All four policies exist on storage.objects
-- select policyname
-- from pg_policies
-- where schemaname = 'storage'
--   and tablename  = 'objects'
--   and policyname like '%agent-documents%';


-- -----------------------------------------------------------------------------
-- Rollback (manual): drop the four policies and delete the bucket from the
-- Supabase Storage UI (or via storage.delete_bucket()).
-- -----------------------------------------------------------------------------
--
-- drop policy if exists "Owner upload agent-documents" on storage.objects;
-- drop policy if exists "Owner read agent-documents"   on storage.objects;
-- drop policy if exists "Owner update agent-documents" on storage.objects;
-- drop policy if exists "Owner delete agent-documents" on storage.objects;
-- -- Bucket deletion is destructive; do it from the UI only after exporting
-- -- any uploaded objects you need to keep.
