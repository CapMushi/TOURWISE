# Testing Guide: TourWise End-to-End

This guide covers current implemented flows and known behavior in the repo.

## Prerequisites

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Backend (`backend/.env`):

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
```

Frontend (`frontend/.env`):

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=http://localhost:8000
```

## Required Database Baseline

- `trips`, `travel_agent`, `booking`, `payments`, `favorites`, `booking_notifications`, `trip_images`, `bus_pooling_requests`, `agent_messages`, `notification_preferences`, `profiles`.
- Apply `backend/supabase/add_trips_image_url.sql` if not already applied.

---

## 1) Smoke Test

1. Open frontend app.
2. Verify login works.
3. Verify backend health endpoint: `GET /api/health`.
4. Verify trips load on traveler home and trip details pages.

Expected:

- No major console errors.
- API auth calls return 200 for authenticated users.

---

## 2) Trip Creation and Management (Agent)

1. Login as agent.
2. Go to `/agent/add-trip`.
3. Submit valid trip data.
4. Open `/agent/manage-trips` and confirm the trip appears.
5. Open Manage Details and update the trip image.

Expected:

- Trip is inserted in `trips`.
- Image URL persists in `trips.image_url`.
- Optional gallery image rows can be retrieved from `trip_images`.

---

## 3) Booking and Payment (Traveler)

1. Open a trip.
2. Create a booking for 1+ seats.
3. Check My Bookings list and detail.
4. Cancel booking.

Expected:

- Booking row created in `booking`.
- Passenger rows created in `booking_passengers`.
- Payment row created in `payments` with `currency = PKR`.
- Seat count in `trips.available_seats` decrements on booking and increments on cancellation.
- Cancellation creates notification and refund fields update.

Note:

- Current API stores booking `total_price` at booking time.
- `trip.price` in nested response currently reflects live trip value, not a dedicated snapshot column.

---

## 4) Favorites and Notifications

1. Favorite/unfavorite a trip.
2. Check favorites page.
3. Open notifications page.
4. Mark a single notification read and mark all as read.

Expected:

- `favorites` CRUD works by user and trip.
- `booking_notifications.is_read` updates properly.

---

## 5) Collaboration Hub

1. Login as an agent with at least one active trip.
2. Open collaboration tabs:
   - Browse trips
   - Matching trips
   - Requests
   - Messages
3. Send pooling request to another agent trip.
4. Approve/reject/cancel request.
5. Exchange messages and verify unread count behavior.

Expected:

- Requests persist in `bus_pooling_requests`.
- Messages persist in `agent_messages`.
- Unread count updates as conversation is marked read.

Current matching logic:

- Same `origin_city`
- Same `destination_city`
- Same departure date (day match)
- Same `suitability`
- Both trips have available seats

---

## 6) Resource Inventory

1. Open `/agent/resource-inventory`.
2. Attach sample buses/hotels to a trip.
3. Open Manage Details for that trip.

Expected:

- Resources appear in Manage Details logistics sections.
- Stored locally in browser via `localStorage` (`tourwise_trip_resources_v1`).

Note:

- Current resource inventory data is static sample data and not fetched from backend tables.

---

## 7) Currency Consistency

1. Check traveler and agent pages for prices.
2. Verify formatting is PKR.

Expected:

- UI prices render with PKR format (`formatPkr`).
- Price input prefix uses `Rs.` where applied.
- No lingering `$` display for trip/booking price output.

---

## 8) Trip Bundles (Tour Packages)

Multi-leg tour packages built by stitching several existing `trips` rows together. See
`.cursor/rules/trip-bundles-plan.mdc` for the full design.

Prerequisites:

- Phase 1 migration applied (`backend/supabase/trip_bundles_phase1.sql`).
- At least one verified agent with 3–4 trips spanning Pakistani cities such that the
  destination of leg `i` equals the origin of leg `i+1` (e.g. KHI→LHE, LHE→ISB, ISB→KHI).

Happy path (create + book + cancel):

1. Sign in as an agent. Create 4 trips: Karachi→Lahore, Lahore→Islamabad,
   Islamabad→Swat, Swat→Karachi. Make sure each has `available_seats > 0` and that
   `arrival_time[i] <= departure_time[i+1]`.
2. Open the sidebar → **"Tour Packages"** (`/agent/resource-inventory`).
3. From the left panel "Add" each trip in route order. The right panel lists stops
   in travel order; pricing and seats update live.
4. The **journey map** at the top of the page drops a numbered pin on every city the
   traveler passes through and connects them with a flowing dashed trail. A
   "Continuous journey" banner appears once you have ≥ 2 stops that chain together.
5. The validator turns green ("Continuous journey · ready to publish") when every rule
   passes. Click "Publish tour package".
6. You land on the new anchor trip page. Verify:
   - The same journey map is rendered above the itinerary.
   - The itinerary lists each stop as "Stop N · A → B" with Travel by / Departs /
     Arrives / Travel partner — no internal trip IDs are visible.
   - The card on the traveler home shows the "Tour Package" badge plus "A N-stop
     guided journey" beneath the route.
7. As a traveler, open the anchor trip and book it for `S` seats.
8. After booking confirms:
   - The anchor row's `available_seats` decreased by `S`.
   - Every member trip's `available_seats` also decreased by `S`.
   - "My Bookings" shows a "Tour Package · N stops" chip and a "Show stops" toggle
     that reveals the customer-facing itinerary.
   - The agent receives one combined notification listing every stop.
9. Cancel the booking. All member trips' seats are restored, the anchor seats are
   restored, and the refund flow runs as normal.

Validator coverage to spot-check on create:

- Add the same `A→B` route twice → "Duplicate route" error.
- Reorder so leg 2 starts in a different city than leg 1 ended → "Chain breaks" error.
- Pick legs where leg 2 departs before leg 1 arrives → "departs before … arrives" error.
- Pick legs from another agent (not possible via the picker; verify the backend rejects
  with 403 if exercised directly).
- Pick a trip that is itself a bundle anchor (`member_trip_ids` populated) → "nesting
  is not allowed" error.

DB-level guards to spot-check:

- Try to `DELETE FROM trips WHERE trip_id = <member of a bundle>` in SQL Editor →
  the `trg_member_trip_delete_guard` trigger raises an exception.
- Update a member trip's `price`, `available_seats`, or city fields → the
  `trg_member_trip_aggregates` trigger automatically recomputes the anchor row.

Editing a bundle:

- Hit `PATCH /api/trips/bundle/{anchor_id}` with a new `member_trip_ids` list while no
  confirmed bookings exist → 200 OK, anchor aggregates refresh.
- Repeat after a confirmed booking exists → 409 Conflict
  ("Bundle has confirmed bookings and can no longer be edited"), per decision 8 in
  the plan.

---

## Common Failure Checks

- 401/403: token missing/expired, or user not in `travel_agent` for agent routes.
- `PGRST204 image_url`: run image URL migration and reload API schema cache.
- Empty collaboration data: ensure at least two agent users with active trips.
- Booking failure: check available seats and required passenger count.

---

## Current Scope vs Planned Enhancements

Implemented now:

- Booking flow with payment + cancellation + notifications
- Collaboration requests/messages
- Trip image cover + gallery support
- PKR formatting in current UI

Planned (not yet implemented in codebase):

- Dedicated immutable `unit_price_at_booking` column
- 30-day pooling window logic (instead of same-day matching)
- DB-backed resource catalog and tour-package badge flag
- Traveler-to-agent review submission workflow


