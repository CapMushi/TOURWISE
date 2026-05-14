-- =============================================================================
-- Trip Bundles — Phase 1 (additive, no renames, no drops)
-- =============================================================================
-- Run in Supabase SQL Editor.
-- After applying, reload the PostgREST schema cache:
--   Dashboard → Settings → API → Reload schema
--
-- Purpose:
--   Allow a trips row to act as a "bundle anchor" composed of other trips rows.
--   member_trip_ids[] stores the ordered list of leg trip_ids. Empty array =
--   ordinary single trip. Non-empty = bundle anchor; is_tour_package = true.
--
-- See .cursor/rules/trip-bundles-plan.mdc for the full design and decisions.
-- =============================================================================

begin;

-- 1) Column on public.trips
alter table public.trips
  add column if not exists member_trip_ids bigint[] not null default '{}';

comment on column public.trips.member_trip_ids is
  'Ordered trip_id list. Empty array = ordinary single trip; non-empty = bundle anchor composed of these legs in order. See trip-bundles-plan.mdc.';

create index if not exists idx_trips_member_trip_ids
  on public.trips using gin (member_trip_ids);

-- 2) Recompute aggregated fields on an anchor from its current members
--    Sums price, takes MIN of seat counts, and copies first-leg origin /
--    last-leg destination, plus first-leg departure and last-leg arrival.
create or replace function public.recompute_bundle_anchor(p_anchor_id bigint)
returns void
language plpgsql
as $$
declare
  v_ids bigint[];
begin
  select member_trip_ids into v_ids
    from public.trips
    where trip_id = p_anchor_id;

  if v_ids is null or array_length(v_ids, 1) is null then
    return;
  end if;

  update public.trips a
  set
    price = (
      select coalesce(sum(t.price), 0)
        from public.trips t
        where t.trip_id = any(v_ids)
    ),
    total_seats = (
      select coalesce(min(t.total_seats), 0)
        from public.trips t
        where t.trip_id = any(v_ids)
    ),
    available_seats = (
      select coalesce(min(t.available_seats), 0)
        from public.trips t
        where t.trip_id = any(v_ids)
    ),
    origin_city = (
      select t.origin_city
        from public.trips t
        where t.trip_id = v_ids[1]
    ),
    destination_city = (
      select t.destination_city
        from public.trips t
        where t.trip_id = v_ids[array_upper(v_ids, 1)]
    ),
    destination_province = (
      select t.destination_province
        from public.trips t
        where t.trip_id = v_ids[array_upper(v_ids, 1)]
    ),
    departure_time = (
      select t.departure_time
        from public.trips t
        where t.trip_id = v_ids[1]
    ),
    arrival_time = (
      select t.arrival_time
        from public.trips t
        where t.trip_id = v_ids[array_upper(v_ids, 1)]
    ),
    is_tour_package = true
  where a.trip_id = p_anchor_id;
end;
$$;

-- 3) When a member trip changes, recompute every anchor that contains it
create or replace function public.trg_member_trip_changed()
returns trigger
language plpgsql
as $$
declare
  anchor_id bigint;
begin
  for anchor_id in
    select trip_id
      from public.trips
      where new.trip_id = any(member_trip_ids)
  loop
    perform public.recompute_bundle_anchor(anchor_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_member_trip_aggregates on public.trips;
create trigger trg_member_trip_aggregates
after update of price, total_seats, available_seats,
                origin_city, destination_city, destination_province,
                departure_time, arrival_time
on public.trips
for each row
execute function public.trg_member_trip_changed();

-- 4) Block deletion of a trip while it is a member of any bundle
create or replace function public.trg_block_member_delete()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
      from public.trips
      where old.trip_id = any(member_trip_ids)
  ) then
    raise exception
      'Trip % is a member of an active bundle and cannot be deleted',
      old.trip_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_member_trip_delete_guard on public.trips;
create trigger trg_member_trip_delete_guard
before delete on public.trips
for each row
execute function public.trg_block_member_delete();

commit;

-- =============================================================================
-- Verification (run separately after the migration)
-- =============================================================================
-- select column_name, data_type, column_default
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name = 'trips'
--     and column_name = 'member_trip_ids';
--
-- select tgname from pg_trigger
--   where tgrelid = 'public.trips'::regclass
--     and tgname in ('trg_member_trip_aggregates', 'trg_member_trip_delete_guard');
--
-- select indexname from pg_indexes
--   where schemaname = 'public'
--     and tablename = 'trips'
--     and indexname = 'idx_trips_member_trip_ids';
-- =============================================================================
