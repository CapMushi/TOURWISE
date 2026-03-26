-- =============================================================================
-- TourWise additive migration (NO renames, NO drops, NO deletes)
-- =============================================================================
-- This script is intentionally additive-only.
-- Existing table/column names are preserved.
-- =============================================================================

begin;

-- 1) Immutable booking unit price snapshot
alter table public.booking
  add column if not exists unit_price_at_booking numeric;

update public.booking
set unit_price_at_booking = case
  when number_of_seats > 0 then total_price / number_of_seats
  else null
end
where unit_price_at_booking is null;

-- 2) Traveler reviews for agents
create table if not exists public.agent_reviews (
  review_id bigserial primary key,
  agent_id bigint not null references public.travel_agent(agent_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating numeric(2,1) not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, user_id)
);

create index if not exists idx_agent_reviews_agent_id
  on public.agent_reviews(agent_id);
create index if not exists idx_agent_reviews_user_id
  on public.agent_reviews(user_id);

-- Keep travel_agent rating aggregates in sync
create or replace function public.recompute_agent_rating(p_agent_id bigint)
returns void
language plpgsql
as $$
begin
  update public.travel_agent ta
  set
    rating = s.avg_rating,
    numberofreviews = s.review_count
  from (
    select
      agent_id,
      round(avg(rating)::numeric, 1) as avg_rating,
      count(*)::int as review_count
    from public.agent_reviews
    where agent_id = p_agent_id
    group by agent_id
  ) s
  where ta.agent_id = s.agent_id;

  update public.travel_agent
  set rating = null, numberofreviews = 0
  where agent_id = p_agent_id
    and not exists (
      select 1 from public.agent_reviews ar where ar.agent_id = p_agent_id
    );
end;
$$;

create or replace function public.agent_reviews_sync_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_agent_rating(old.agent_id);
    return old;
  else
    perform public.recompute_agent_rating(new.agent_id);
    if tg_op = 'UPDATE' and old.agent_id <> new.agent_id then
      perform public.recompute_agent_rating(old.agent_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_agent_reviews_sync on public.agent_reviews;
create trigger trg_agent_reviews_sync
after insert or update or delete on public.agent_reviews
for each row
execute function public.agent_reviews_sync_trigger();

-- 3) DB-backed bus resources + tour-package marker
create table if not exists public.bus_services (
  service_id bigserial primary key,
  operator text not null,
  service_number text,
  origin_city text not null,
  destination_city text not null,
  departure_time_local text,
  arrival_time_local text,
  duration_text text,
  stops int,
  seats int,
  coach_class text,
  indicative_price numeric,
  country text not null default 'Pakistan',
  created_at timestamptz not null default now()
);

create table if not exists public.trip_bus_resources (
  id bigserial primary key,
  trip_id bigint not null references public.trips(trip_id) on delete cascade,
  service_id bigint not null references public.bus_services(service_id) on delete restrict,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_bus_resources_trip_id
  on public.trip_bus_resources(trip_id);

alter table public.trips
  add column if not exists is_tour_package boolean not null default false;

create or replace function public.sync_trip_tour_package_flag(p_trip_id bigint)
returns void
language plpgsql
as $$
begin
  update public.trips
  set is_tour_package = exists (
    select 1 from public.trip_bus_resources tbr where tbr.trip_id = p_trip_id
  )
  where trip_id = p_trip_id;
end;
$$;

create or replace function public.trip_bus_resources_sync_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_trip_tour_package_flag(old.trip_id);
    return old;
  else
    perform public.sync_trip_tour_package_flag(new.trip_id);
    return new;
  end if;
end;
$$;

drop trigger if exists trg_trip_bus_resources_sync on public.trip_bus_resources;
create trigger trg_trip_bus_resources_sync
after insert or delete on public.trip_bus_resources
for each row
execute function public.trip_bus_resources_sync_trigger();

commit;
