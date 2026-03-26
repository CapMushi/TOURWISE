# TourWise Frontend

React + Vite frontend for TourWise.

## Stack

- React + TypeScript
- Vite
- Tailwind + shadcn/ui
- TanStack Query
- Supabase JS client

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `frontend/.env` with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:8000
# Optional override for storage bucket:
# VITE_SUPABASE_TRIP_IMAGES_BUCKET=trip-images
```

3. Run dev server:

```bash
npm run dev
```

4. Build production bundle:

```bash
npm run build
```

## Current App Coverage

- Auth flows (email/password and social integration points)
- Traveler home/search and trip browsing
- Trip details and booking flow
- Favorites/wishlist
- Traveler bookings + notifications
- Agent dashboard + add/manage trip details
- Trip image upload flow
- Resource inventory UI and trip resource local persistence
- Collaboration hub (pooling requests + agent messaging)
- Admin-facing pages (including approvals and profile detail views)

## Currency Behavior

- UI formatting uses PKR across booking/trip views via `src/lib/currency.ts`.
- Input prefix label uses `Rs.` in PKR price inputs.

## Backend Dependency

Frontend expects backend API routes from `backend/app/main.py` under `/api/*`.

If image upload fails with `PGRST204` for `image_url`, run:

- `backend/supabase/add_trips_image_url.sql`

and then reload Supabase API schema cache.
