-- Fix: PGRST204 "Could not find the 'image_url' column of 'trips' in the schema cache"
-- Run in Supabase SQL Editor, then wait a few seconds or reload the API schema.

alter table public.trips
  add column if not exists image_url text;

comment on column public.trips.image_url is 'Public URL for main trip image (e.g. Supabase Storage)';

-- If PostgREST still caches the old schema, in Dashboard: Settings → API → Reload schema (or pause/redeploy).
