-- Run in Supabase SQL Editor to enable traveler reviews for individual trips.

create table if not exists public.trip_reviews (
  review_id bigint generated always as identity primary key,
  trip_id bigint not null references public.trips(trip_id) on delete cascade,
  agent_id bigint references public.travel_agent(agent_id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating numeric(2,1) not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create unique index if not exists trip_reviews_trip_user_unique
  on public.trip_reviews (trip_id, user_id);

create index if not exists trip_reviews_trip_idx
  on public.trip_reviews (trip_id, created_at desc);
