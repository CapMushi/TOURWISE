-- Manage Users + Bans — Phase 1 migration.
-- Run in Supabase SQL Editor.
--
-- Adds two ban mechanisms:
--   1. profiles.banned_until + audit columns
--        Account-level ban tied to the Supabase user. NULL = active.
--        'infinity'::timestamptz = permanent (used for agent bans). Any
--        timestamp in the future means the account is locked until that
--        moment. After the timestamp passes, the next request succeeds —
--        no cron sweep needed (lazy expiry).
--   2. public.banned_cnics table
--        CNIC-based blocklist for travel-agent registration. Survives
--        account deletion / re-signup, so a banned agent cannot reuse the
--        same CNIC from any other account. lifted_at preserves history.
--
-- All changes are additive. Existing rows are unaffected (banned_until
-- defaults to NULL).
--
-- Companion plan: .cursor/rules/manage-users-bans-plan.mdc
-- Schema docs:    .cursor/rules/database-schema.mdc

-- 1. Profile-level ban columns
alter table public.profiles
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason   text,
  add column if not exists banned_at    timestamptz,
  add column if not exists banned_by    uuid references public.profiles(id) on delete set null;

-- 2. Partial index — cheap lookup at JWT validation time. Most rows are
--    active (banned_until is null) so we only index actively-banned ones.
create index if not exists idx_profiles_banned_until
  on public.profiles (banned_until)
  where banned_until is not null;

-- 3. CNIC blocklist table
create table if not exists public.banned_cnics (
  cnic_number text primary key,
  reason      text not null,
  banned_at   timestamptz not null default now(),
  banned_by   uuid references public.profiles(id) on delete set null,
  lifted_at   timestamptz,
  lifted_by   uuid references public.profiles(id) on delete set null
);

-- 4. Partial index for the registration-time check. Picks out
--    currently-active bans (lifted_at IS NULL) so the agent-registration
--    path stays a single index probe.
create index if not exists idx_banned_cnics_active
  on public.banned_cnics (cnic_number)
  where lifted_at is null;


-- -----------------------------------------------------------------------------
-- Verification queries (run separately after the migration succeeds)
-- -----------------------------------------------------------------------------
--
-- -- a) profiles columns exist with expected types
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name   = 'profiles'
--   and column_name in ('banned_until','ban_reason','banned_at','banned_by')
-- order by column_name;
--
-- -- b) banned_cnics table is present with the right columns
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name   = 'banned_cnics'
-- order by ordinal_position;
--
-- -- c) Both partial indexes exist
-- select indexname
-- from pg_indexes
-- where schemaname = 'public'
--   and indexname in ('idx_profiles_banned_until','idx_banned_cnics_active');
--
-- -- d) Regression — existing profiles still readable, all currently active
-- select count(*) filter (where banned_until is null)     as active_users,
--        count(*) filter (where banned_until is not null) as banned_users
-- from public.profiles;


-- -----------------------------------------------------------------------------
-- Rollback (use only if you need to undo Phase 1 — destructive)
-- -----------------------------------------------------------------------------
--
-- drop index if exists public.idx_banned_cnics_active;
-- drop table if exists public.banned_cnics;
-- drop index if exists public.idx_profiles_banned_until;
-- alter table public.profiles
--   drop column if exists banned_by,
--   drop column if exists banned_at,
--   drop column if exists ban_reason,
--   drop column if exists banned_until;
