-- Agent Verification v2 — Phase 1 migration.
-- Run in Supabase SQL Editor.
--
-- Adds typed columns to public.travel_agent so the admin pending queue can
-- display business / contact / CNIC info and sort by submission time.
-- Document URLs are NOT new columns; they live as object paths inside
-- travel_agent.profile_details.documents (see agent-verification-v2-plan.mdc).
-- All new columns are nullable, so existing rows remain valid.

-- 1. Column additions
alter table public.travel_agent
  add column if not exists business_name text,
  add column if not exists phone         text,
  add column if not exists cnic_number   text,
  add column if not exists submitted_at  timestamptz;

-- 2. Unique CNIC across applicants (NULLs unaffected by partial index).
--    Blocks two accounts from claiming the same Pakistani CNIC.
create unique index if not exists uq_travel_agent_cnic_number
  on public.travel_agent (cnic_number)
  where cnic_number is not null;

-- 3. Default queue query: pending agents, newest submitted first.
create index if not exists idx_travel_agent_status_submitted
  on public.travel_agent (verification_status, submitted_at desc);


-- -----------------------------------------------------------------------------
-- Verification queries (run separately after the migration succeeds)
-- -----------------------------------------------------------------------------
--
-- -- a) Confirm columns exist with expected types
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'travel_agent'
--   and column_name in ('business_name','phone','cnic_number','submitted_at')
-- order by column_name;
--
-- -- b) Confirm indexes exist
-- select indexname
-- from pg_indexes
-- where schemaname = 'public'
--   and tablename = 'travel_agent'
--   and indexname in ('uq_travel_agent_cnic_number','idx_travel_agent_status_submitted');
--
-- -- c) Existing agent rows remain readable (regression check)
-- select agent_id, name, verification_status from public.travel_agent limit 5;


-- -----------------------------------------------------------------------------
-- Rollback (use only if you need to undo Phase 1 — destructive)
-- -----------------------------------------------------------------------------
--
-- drop index if exists public.idx_travel_agent_status_submitted;
-- drop index if exists public.uq_travel_agent_cnic_number;
-- alter table public.travel_agent
--   drop column if exists submitted_at,
--   drop column if exists cnic_number,
--   drop column if exists phone,
--   drop column if exists business_name;
