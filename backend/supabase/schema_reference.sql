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
--   optional_profiles_trigger.sql — optional profile bootstrap
-- =============================================================================


-- -----------------------------------------------------------------------------
-- profiles  (profile.py, trip_images.created_by on insert in trips.py)
-- -----------------------------------------------------------------------------
-- id (uuid, PK)           — select, insert minimal { id }; update never from code
-- username                — select, update
-- preferences (jsonb)     — select, update
-- profile_details (jsonb) — select, update
-- updated_at              — select (DB may maintain)


-- -----------------------------------------------------------------------------
-- travel_agent  (auth.py, trips.py, bookings.py, collaboration.py)
-- -----------------------------------------------------------------------------
-- agent_id (bigint, PK)
-- user_id (uuid, FK → profiles.id)
-- name, email
-- verification_status     — insert/update (e.g. pending, approved)
-- contact_info, profile_details (jsonb) — insert null on register
-- rating, numberofreviews — select (e.g. /api/me agent card)
-- created_at              — select as returned by DB


-- -----------------------------------------------------------------------------
-- trips  (trips.py, bookings.py, collaboration.py, favorites.py)
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
-- booking  (bookings.py)
-- -----------------------------------------------------------------------------
-- booking_id (bigint, PK)
-- user_id (uuid), trip_id (bigint), itinerary_id (bigint, null)
-- booking_date, status
-- number_of_seats, total_price
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
-- bus_pooling_requests  (collaboration.py)
-- -----------------------------------------------------------------------------
-- request_id (bigint, PK)
-- requester_agent_id, target_agent_id (FK → travel_agent)
-- requester_trip_id, target_trip_id (FK → trips)
-- status                  — pending, approved, rejected, cancelled, …
-- message, seat_management, selected_bus_agent_id
-- created_at, updated_at


-- -----------------------------------------------------------------------------
-- agent_messages  (collaboration.py)
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
