-- =============================================================================
-- Phase 1: Service Integration Layer — external trips & bookings (Supabase PG)
-- =============================================================================
-- Run in Supabase SQL Editor (or psql against your project DB).
-- Aligns with: .cursor/rules/service-integration-layer-mock-adapters.mdc
--
-- Creates:
--   external_trip_snapshots  — optional listing snapshot / audit per provider offer
--   external_bookings        — bookings made via TourWise for external provider trips
--   external_booking_passengers
--   external_payments
--
-- Does NOT modify public.trips or public.booking (local workflow unchanged).
-- After apply: Settings → API → Reload schema if PostgREST caches old schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- external_trip_snapshots
-- -----------------------------------------------------------------------------
create table if not exists public.external_trip_snapshots (
  snapshot_id     bigint generated always as identity primary key,
  provider_id     text not null,
  external_ref    text not null,
  origin_city     text,
  destination_province text,
  destination_city text,
  departure_time  timestamptz,
  arrival_time    timestamptz,
  price           numeric,
  transport_type  text,
  total_seats     integer,
  available_seats integer,
  suitability     text,
  image_url       text,
  raw_snapshot    jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists external_trip_snapshots_provider_ref_idx
  on public.external_trip_snapshots (provider_id, external_ref);

create index if not exists external_trip_snapshots_created_at_idx
  on public.external_trip_snapshots (created_at desc);

comment on table public.external_trip_snapshots is
  'Canonical snapshot of an external provider listing at ingest/search time; not a substitute for trips.trip_id.';

-- -----------------------------------------------------------------------------
-- external_bookings
-- -----------------------------------------------------------------------------
create table if not exists public.external_bookings (
  external_booking_id   bigint generated always as identity primary key,
  user_id               uuid not null references public.profiles (id) on delete restrict,
  provider_id           text not null,
  external_ref          text not null,
  synthetic_trip_id     bigint,
  booking_date          timestamptz not null default now(),
  status                text not null default 'confirmed',
  number_of_seats       integer not null,
  total_price           numeric not null,
  passenger_names       text[] not null default '{}',
  contact_email         text not null,
  contact_phone         text not null,
  special_requests      text,
  booking_reference     text not null,
  provider_confirmation_ref text,
  confirmed_at          timestamptz,
  cancelled_at          timestamptz,
  cancellation_reason   text,
  refund_amount         numeric,
  provider_response     jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint external_bookings_number_of_seats_positive check (number_of_seats > 0),
  constraint external_bookings_total_price_non_negative check (total_price >= 0),
  constraint external_bookings_booking_reference_unique unique (booking_reference)
);

create index if not exists external_bookings_user_id_idx
  on public.external_bookings (user_id);

create index if not exists external_bookings_provider_ref_idx
  on public.external_bookings (provider_id, external_ref);

create index if not exists external_bookings_booking_date_idx
  on public.external_bookings (booking_date desc);

comment on table public.external_bookings is
  'Bookings placed through TourWise for external provider trips; persisted after adapter/provider confirmation.';
comment on column public.external_bookings.synthetic_trip_id is
  'Optional UI trip id (e.g. negative synthetic id) used when the user booked.';
comment on column public.external_bookings.booking_reference is
  'TourWise-facing reference; use distinct prefix from local booking (e.g. EXT-).';
comment on column public.external_bookings.provider_response is
  'Normalized or raw provider confirmation payload for audit.';

-- -----------------------------------------------------------------------------
-- external_booking_passengers
-- -----------------------------------------------------------------------------
create table if not exists public.external_booking_passengers (
  passenger_id            bigint generated always as identity primary key,
  external_booking_id     bigint not null references public.external_bookings (external_booking_id) on delete cascade,
  full_name               text not null,
  age                     integer,
  gender                  text,
  passport_number         text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  dietary_restrictions    text,
  medical_conditions      text,
  created_at              timestamptz not null default now()
);

create index if not exists external_booking_passengers_booking_idx
  on public.external_booking_passengers (external_booking_id);

-- -----------------------------------------------------------------------------
-- external_payments
-- -----------------------------------------------------------------------------
create table if not exists public.external_payments (
  payment_id        bigint generated always as identity primary key,
  external_booking_id bigint not null references public.external_bookings (external_booking_id) on delete cascade,
  amount              numeric not null,
  currency            text not null default 'PKR',
  payment_method      text,
  payment_status      text not null default 'completed',
  transaction_id      text,
  payment_date        timestamptz,
  refunded_at         timestamptz,
  refund_amount       numeric,
  payment_details     jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint external_payments_amount_positive check (amount > 0)
);

create unique index if not exists external_payments_transaction_id_unique
  on public.external_payments (transaction_id)
  where transaction_id is not null;

create index if not exists external_payments_external_booking_idx
  on public.external_payments (external_booking_id);

comment on table public.external_payments is
  'Payment rows for external_bookings; mirrors payments.booking_id pattern for local bookings.';
