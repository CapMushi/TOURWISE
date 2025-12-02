# TourWise Backend API

FastAPI backend for the TourWise travel platform.

## Setup

### Prerequisites

- Python 3.11 or higher
- pip (Python package manager)

### Installation

1. **Create a virtual environment** (recommended):

```bash
python -m venv venv
```

2. **Activate the virtual environment**:

   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

3. **Install dependencies**:

```bash
pip install -r requirements.txt
```

4. **Set up environment variables**:

   - Copy `.env.example` to `.env`:
     ```bash
     copy .env.example .env
     ```
   - Edit `.env` and add your Supabase credentials:
     - `SUPABASE_URL`: Your Supabase project URL
     - `SUPABASE_ANON_KEY`: Your Supabase anonymous key
     - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (keep this secret!)
  - `SUPABASE_JWT_SECRET`: Your Supabase JWT secret (Project Settings → API)

## Running the Server

Start the development server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Health Check**: http://localhost:8000/api/health
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **Alternative Docs**: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── api/
│   │   ├── __init__.py
│   │   └── health.py        # Health check endpoint
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py        # Configuration and settings
│   └── services/
│       ├── __init__.py
│       └── supabase_client.py  # Supabase client setup
├── .env.example             # Environment variables template
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## Phase 1 Status

✅ FastAPI application structure
✅ Environment configuration
✅ Supabase client integration
✅ Health check endpoint

## Next Steps (Phase 2+)

- Authentication and authorization
- User profiles and roles
- Trips management
- Bookings system
- Agent verification
- Notifications

