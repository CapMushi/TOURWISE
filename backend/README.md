# TourWise Backend API

FastAPI backend for the TourWise platform with Supabase integration.

## Current API Scope

Implemented routers in `backend/app/api/`:

- `health.py` - health endpoint
- `auth.py` - agent registration/verification helpers and `/api/me`
- `profile.py` - traveler profile read/update
- `trips.py` - trips CRUD, trip image gallery, cover image sync
- `bookings.py` - booking create/list/get/cancel, passengers, payments, notifications
- `favorites.py` - wishlist/favorites
- `collaboration.py` - agent collaboration, pooling requests, agent messages
- `notification_preferences.py` - notification settings
- `notifications.py` - booking notifications read APIs

## Prerequisites

- Python 3.11+
- pip

## Setup

1. Create and activate a virtual environment:

```bash
python -m venv venv
venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure environment variables (`backend/.env`):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- Optional: `BACKEND_HOST`, `BACKEND_PORT`

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Available endpoints:

- API root: `http://localhost:8000/`
- Health: `http://localhost:8000/api/health`
- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Database Notes

- Canonical schema documentation: `.cursor/rules/database-schema.mdc`
- API touch-point reference: `backend/supabase/schema_reference.sql`
- Existing utility SQL scripts:
  - `backend/supabase/add_trips_image_url.sql`
  - `backend/supabase/storage_trip_images_bucket.sql`
  - `backend/supabase/optional_profiles_trigger.sql`

## Important Runtime Behavior

- Booking payment rows are currently inserted with `payments.currency = "PKR"`.
- Booking totals are stored on booking creation and reused for cancellation/refund flow.
- Trip cover image URL is stored in `trips.image_url`.
- Additional gallery images are stored in `trip_images`.

