-- =============================================================================
-- TourWise: API touch-point schema reference (documentation only)
-- =============================================================================
-- This file does NOT create or alter your database. It lists PostgreSQL table
-- names and columns that the FastAPI app in backend/app/api/ reads or writes
-- via Supabase PostgREST.
--
-- Canonical full schema: .cursor/rules/database-schema.mdc
--
-- Runnable snippets in this folder:
--   add_trips_image_url.sql      — trips.image_url
--   storage_trip_images_bucket.sql — Storage bucket for uploads
--   storage_profile_images_bucket.sql — Storage bucket for traveler/agent avatars
--   admin_roles_phase1.sql — Admin role tables and initial assignment
--   optional_profiles_trigger.sql — optional profile bootstrap
--   external_integrations_phase1.sql — external SIL tables (bookings, passengers, payments, snapshots)
--   trip_reviews_phase1.sql — traveler reviews for booked trips
-- =============================================================================


-- -----------------------------------------------------------------------------
-- profiles  (profile.py, trip_images.created_by on insert in trips.py)
-- -----------------------------------------------------------------------------
-- id (uuid, PK)           — select, insert minimal { id }; update never from code
-- username                — select, update
-- preferences (jsonb)     — select, update
-- profile_details (jsonb) — select, update (e.g. avatar_url)
-- updated_at              — select (DB may maintain)


-- -----------------------------------------------------------------------------
-- travel_agent  (auth.py, profile.py, trips.py, bookings.py, collaboration.py)
-- -----------------------------------------------------------------------------
-- agent_id (bigint, PK)
-- user_id (uuid, FK → profiles.id)
-- name, email
-- verification_status     — insert/update (e.g. pending, approved)
-- contact_info, profile_details (jsonb) — insert null on register; profile_details may contain avatar_url, bio
-- rating, numberofreviews — select (e.g. /api/me agent card)
-- created_at              — select as returned by DB


-- -----------------------------------------------------------------------------
-- admin_roles, user_admin_roles  (admin.py, auth.py via role checks)
-- -----------------------------------------------------------------------------
-- admin_roles.role_id (bigint/int, PK)
-- admin_roles.role_name, description, created_at
--   common role_name values in current schema: super_admin, support_admin, content_admin, finance_admin
-- user_admin_roles.user_id (uuid, FK → profiles.id)
-- user_admin_roles.role_id (FK → admin_roles.role_id)
-- user_admin_roles.assigned_by, assigned_at


-- -----------------------------------------------------------------------------
-- trips  (profile.py, trips.py, bookings.py, collaboration.py, favorites.py)
-- -----------------------------------------------------------------------------
-- trip_id (bigint, PK)
-- agent_id (bigint, FK → travel_agent.agent_id)
-- origin_city, destination_province, destination_city
-- departure_time, arrival_time (timestamptz)
-- price (numeric)         — app uses PKR amounts
-- transport_type
-- total_seats, available_seats
-- created_at
-- suitability             — insert required by API defaulting to Solo Travelers
-- image_url (text, null)  — update via PATCH /api/trips/{id}; sync from trip_images cover
-- is_tour_package (bool)  — optional tour package marker for cards/badges
-- origin_lat, origin_lng, destination_lat, destination_lng — select * paths


-- -----------------------------------------------------------------------------
-- trip_images  (trips.py — gallery + cover)
-- -----------------------------------------------------------------------------
-- image_id (bigint, PK)
-- trip_id (bigint, FK)
-- image_url, alt_text, sort_order, is_cover
-- created_by (uuid, FK → profiles.id, nullable)
-- created_at


-- -----------------------------------------------------------------------------
-- booking  (profile.py, bookings.py)
-- -----------------------------------------------------------------------------
-- booking_id (bigint, PK)
-- user_id (uuid), trip_id (bigint), itinerary_id (bigint, null)
-- booking_date, status
-- number_of_seats, unit_price_at_booking, total_price
-- passenger_names (text[])
-- contact_email, contact_phone, special_requests
-- booking_reference (unique)
-- confirmed_at, cancelled_at, cancellation_reason, refund_amount
-- updated_at
-- payment_info (jsonb)    — not set by current create_booking path; may exist in DB


-- -----------------------------------------------------------------------------
-- booking_passengers  (bookings.py — insert on create booking)
-- -----------------------------------------------------------------------------
-- passenger_id (bigint, PK)
-- booking_id (bigint, FK)
-- full_name, age, gender, passport_number
-- emergency_contact_name, emergency_contact_phone
-- dietary_restrictions, medical_conditions
-- created_at


-- -----------------------------------------------------------------------------
-- agent_reviews  (reviews.py)
-- -----------------------------------------------------------------------------
-- review_id (bigint, PK)
-- agent_id (bigint, FK → travel_agent)
-- user_id (uuid, FK → profiles.id)
-- rating, comment
-- created_at, updated_at


-- -----------------------------------------------------------------------------
-- trip_reviews  (reviews.py)
-- -----------------------------------------------------------------------------
-- review_id (bigint, PK)
-- trip_id (bigint, FK → trips.trip_id)
-- agent_id (bigint, FK → travel_agent.agent_id, nullable snapshot/helper)
-- user_id (uuid, FK → profiles.id)
-- rating, comment
-- created_at, updated_at


-- -----------------------------------------------------------------------------
-- payments  (bookings.py)
-- -----------------------------------------------------------------------------
-- payment_id (bigint, PK)
-- booking_id (bigint, FK)
-- amount, currency        — insert uses currency 'PKR'
-- payment_method, payment_status
-- transaction_id, payment_date
-- refunded_at, refund_amount — update on cancel
-- payment_details, created_at, updated_at — as present in DB / selects


-- -----------------------------------------------------------------------------
-- booking_notifications  (bookings.py, notifications.py)
-- -----------------------------------------------------------------------------
-- notification_id (bigint, PK)
-- booking_id (bigint, FK), user_id (uuid, FK)
-- notification_type, title, message
-- is_read                 — insert false; update true when marking read
-- created_at


-- -----------------------------------------------------------------------------
-- external_trip_snapshots  (Phase 2 integrations — optional ingest)
-- -----------------------------------------------------------------------------
-- snapshot_id (bigint, PK, identity)
-- provider_id, external_ref
-- origin_city, destination_province, destination_city
-- departure_time, arrival_time (timestamptz)
-- price (numeric), transport_type, total_seats, available_seats, suitability, image_url
-- raw_snapshot (jsonb), created_at


-- -----------------------------------------------------------------------------
-- external_bookings  (Phase 2 bookings.py — external branch + merged list)
-- -----------------------------------------------------------------------------
-- external_booking_id (bigint, PK, identity)
-- user_id (uuid, FK → profiles.id)
-- provider_id, external_ref, synthetic_trip_id (bigint, null)
-- booking_date, status, number_of_seats, total_price
-- passenger_names (text[]), contact_email, contact_phone, special_requests
-- booking_reference (unique), provider_confirmation_ref, confirmed_at
-- cancelled_at, cancellation_reason, refund_amount
-- provider_response (jsonb), created_at, updated_at


-- -----------------------------------------------------------------------------
-- external_booking_passengers  (Phase 2 bookings.py)
-- -----------------------------------------------------------------------------
-- passenger_id (bigint, PK, identity)
-- external_booking_id (bigint, FK → external_bookings, on delete cascade)
-- full_name, age, gender, passport_number
-- emergency_contact_name, emergency_contact_phone
-- dietary_restrictions, medical_conditions, created_at


-- -----------------------------------------------------------------------------
-- external_payments  (Phase 2 bookings.py)
-- -----------------------------------------------------------------------------
-- payment_id (bigint, PK, identity)
-- external_booking_id (bigint, FK → external_bookings, on delete cascade)
-- amount, currency, payment_method, payment_status
-- transaction_id (unique when not null), payment_date
-- refunded_at, refund_amount, payment_details (jsonb), created_at, updated_at


-- -----------------------------------------------------------------------------
-- favorites  (favorites.py)
-- -----------------------------------------------------------------------------
-- favorite_id (bigint, PK)
-- user_id (uuid, FK), trip_id (bigint, FK)
-- created_at


-- -----------------------------------------------------------------------------
-- notification_preferences  (notification_preferences.py)
-- -----------------------------------------------------------------------------
-- user_id (uuid, PK/FK)
-- booking_updates, payment_updates, trip_reminders, promotions, agent_messages
-- in_app_enabled, email_enabled, sms_enabled, push_enabled
-- quiet_hours_start, quiet_hours_end, timezone
-- created_at, updated_at


-- -----------------------------------------------------------------------------
-- bus_pooling_requests  (profile.py, collaboration.py)
-- -----------------------------------------------------------------------------
-- request_id (bigint, PK)
-- requester_agent_id, target_agent_id (FK → travel_agent)
-- requester_trip_id, target_trip_id (FK → trips)
-- status                  — pending, approved, rejected, cancelled, …
-- message, seat_management, selected_bus_agent_id
-- created_at, updated_at


-- -----------------------------------------------------------------------------
-- agent_messages  (profile.py, collaboration.py)
-- -----------------------------------------------------------------------------
-- message_id (bigint, PK)
-- sender_agent_id, receiver_agent_id (FK → travel_agent)
-- subject, content
-- related_pooling_request_id (bigint, FK, null)
-- is_read
-- created_at


-- =============================================================================
-- Maintenance — keep this file in sync with the API
-- =============================================================================
-- When you add or change Supabase PostgREST usage under backend/app/api/:
--
-- 1. Search the codebase for:  supabase.table("
-- 2. For each table name, ensure this file either has a section for it or add one
--    using the same comment style as above.
-- 3. List columns your handlers depend on: fields passed to .insert() / .update(),
--    explicit .select("...") lists, and filters (.eq / .gte / …) on columns that
--    are not covered by a routine select("*") for that code path.
-- 4. If the real PostgreSQL schema or relationships changed (new table, column,
--    FK), update the canonical doc: .cursor/rules/database-schema.mdc
--
-- This file is documentation only; it does not apply migrations.
-- =============================================================================
