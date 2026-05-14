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

## Agent Verification v2 — application + admin review

Phase 1 migrations (run once in Supabase SQL Editor):
- `backend/supabase/agent_verification_v2_phase1.sql` — adds `business_name`, `phone`, `cnic_number`, `submitted_at` columns + indexes on `travel_agent`.
- `backend/supabase/storage_agent_documents_bucket.sql` — creates the private `agent-documents` bucket with owner-folder RLS policies.

End-to-end test:
1. Sign up as a new traveler, then visit `/agent-verification`.
2. Fill business name, phone, CNIC (format `12345-1234567-1`), and upload CNIC front + back images (optional business license PDF/image). The Submit button stays disabled until all required fields and both CNIC sides are present.
3. Submit. You should see the "Application Received / Pending Review" summary on the same page.
4. Sign in as an admin user, open `/admin/manage-agents` → **Pending Requests** tab. The applicant appears with their Business, Applicant, Email, Phone, and Submitted-at columns populated; rows are sorted newest-first.
5. Click **View** on the pending row. The detail page (`/admin/agent-profile/<id>?from=pending`) loads with contact info, identity card, document tiles (CNIC images open in a lightbox; business license opens via signed URL), and the inline **Approve / Reject** bar at the bottom.
6. Click **Approve** → the row disappears from Pending, shows up in the Active tab, and the applicant now has access to `/agent` on their next page load. **Reject** sends the row back to the agent who will see a "previous application was rejected" banner and a form pre-loaded for resubmission.
7. Duplicate-CNIC test: try registering a second agent with the same CNIC — the backend responds 409 "This CNIC is already registered to another applicant".
8. Hot-link test: copy a CNIC image URL from the detail page into an incognito tab; it should expire after ~1 hour and admin-only access via the bucket policies blocks unauthenticated reads.

If document tiles render "Not uploaded" for an applicant who did upload them, recheck that the `agent-documents` bucket exists with `public = false` and that the four `Owner ... agent-documents` policies are present (see verification queries at the bottom of `storage_agent_documents_bucket.sql`).

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


