# Testing Guide: Add Trip Functionality

This guide will help you test the newly implemented "Add Trip" functionality for travel agents.

## Prerequisites

### 1. Backend Setup
- Ensure you have Python 3.11+ installed
- Backend dependencies installed:
  ```bash
  cd backend
  pip install -r requirements.txt
  ```

### 2. Frontend Setup
- Node.js and npm installed
- Frontend dependencies installed:
  ```bash
  cd frontend
  npm install
  ```

### 3. Environment Variables

**Backend** (`backend/.env`):
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
BACKEND_PORT=8000
BACKEND_HOST=0.0.0.0
ENVIRONMENT=development
```

**Frontend** (`frontend/.env`):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:8000
```

### 4. Database Setup
- Ensure the `trips` table exists in your Supabase database
- Ensure the `travel_agent` table exists
- You need a test user that is registered as a travel agent

## Step-by-Step Testing

### Step 1: Start the Backend Server

```bash
cd backend
# Activate virtual environment (if using one)
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Start the server
uvicorn app.main:app --reload --port 8000
```

**Expected Output:**
- Server should start on `http://localhost:8000`
- You should see: `Uvicorn running on http://0.0.0.0:8000`

**Verify Backend is Running:**
- Open browser: `http://localhost:8000/api/health`
- Should return: `{"status":"ok","timestamp":"...","uptime_seconds":...}`

### Step 2: Start the Frontend Development Server

```bash
cd frontend
npm run dev
```

**Expected Output:**
- Server should start on `http://localhost:8080` (or another port)
- You should see the Vite dev server running

### Step 3: Verify Database Connection

**Check if you have a travel agent user:**

1. Log in to your Supabase dashboard
2. Go to Table Editor → `travel_agent`
3. Verify you have at least one record with:
   - `user_id` matching a user in `auth.users`
   - `verification_status` can be any value

**If you don't have a travel agent:**
- You'll need to create one manually in the database, OR
- Complete the agent verification flow in the frontend first

### Step 4: Test Authentication

1. Open `http://localhost:8080` in your browser
2. Navigate to `/login`
3. Log in with an account that has a corresponding `travel_agent` record
4. After login, navigate to `/agent` (agent dashboard)
5. Verify you can access the agent area

### Step 5: Test the Add Trip Form

1. Navigate to `/agent/add-trip` (or click "Add Trip" from the agent dashboard)
2. You should see a form with the following fields:
   - Origin City (required)
   - Destination Province (required)
   - Destination City (required)
   - Departure Time (required, datetime picker)
   - Arrival Time (required, datetime picker)
   - Price (required, number)
   - Transport Type (required, dropdown)
   - Total Seats (required, number)
   - Available Seats (optional, number)

### Step 6: Test Form Validation

**Test Required Fields:**
1. Try submitting the form without filling any fields
2. **Expected:** Error messages should appear for all required fields
3. **Expected:** Toast notification: "Please fix the errors in the form"

**Test Date Validation:**
1. Fill in all required fields
2. Set Arrival Time to be BEFORE Departure Time
3. **Expected:** Error message: "Arrival time must be after departure time"

**Test Numeric Validation:**
1. Set Price to 0 or negative
2. **Expected:** Error message: "Price must be greater than 0"
3. Set Total Seats to 0 or negative
4. **Expected:** Error message: "Total seats must be greater than 0"
5. Set Available Seats greater than Total Seats
6. **Expected:** Error message: "Available seats cannot exceed total seats"

### Step 7: Test Successful Trip Creation

1. Fill in the form with valid data:
   ```
   Origin City: Lahore
   Destination Province: Khyber Pakhtunkhwa
   Destination City: Naran
   Departure Time: 2025-10-25 06:00
   Arrival Time: 2025-10-27 18:00
   Price: 250.00
   Transport Type: Bus
   Total Seats: 20
   Available Seats: 20 (or leave empty)
   ```

2. Click "Create Trip"
3. **Expected:**
   - Loading state: Button shows "Creating Trip..." and is disabled
   - Success toast: "Trip created successfully! Trip ID: [number]"
   - Redirect to `/agent/manage-trips`

4. **Verify in Database:**
   - Go to Supabase → Table Editor → `trips`
   - Find the newly created trip
   - Verify all fields are correct:
     - `agent_id` matches your agent
     - All location fields are correct
     - Dates are correct
     - Price, seats, transport_type are correct
     - `created_at` is set automatically

### Step 8: Test Error Scenarios

**Test 1: User Not an Agent**
1. Log in with a user that does NOT have a `travel_agent` record
2. Try to create a trip
3. **Expected:**
   - Error toast: "User is not a registered travel agent. Please complete agent verification first."
   - Status code: 403

**Test 2: Network Error**
1. Stop the backend server
2. Try to create a trip
3. **Expected:**
   - Error toast with network error message
   - Form remains accessible (not stuck in loading state)

**Test 3: Invalid Transport Type**
1. Try to submit with an invalid transport_type (if you modify the frontend)
2. **Expected:** Backend validation error

### Step 9: Test API Directly (Optional)

You can test the API endpoint directly using curl or Postman:

```bash
# Get your JWT token from browser DevTools → Application → Local Storage → supabase.auth.token

curl -X POST http://localhost:8000/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "origin_city": "Lahore",
    "destination_province": "Khyber Pakhtunkhwa",
    "destination_city": "Naran",
    "departure_time": "2025-10-25T06:00:00Z",
    "arrival_time": "2025-10-27T18:00:00Z",
    "price": 250.00,
    "transport_type": "bus",
    "total_seats": 20,
    "available_seats": 20
  }'
```

**Expected Response:**
```json
{
  "trip_id": 1,
  "agent_id": 1,
  "origin_city": "Lahore",
  "destination_province": "Khyber Pakhtunkhwa",
  "destination_city": "Naran",
  "departure_time": "2025-10-25T06:00:00+00:00",
  "arrival_time": "2025-10-27T18:00:00+00:00",
  "price": 250.0,
  "transport_type": "bus",
  "total_seats": 20,
  "available_seats": 20,
  "created_at": "2025-01-XX..."
}
```

## Troubleshooting

### Issue: White Screen
- **Check:** Browser console for errors (F12)
- **Check:** Network tab for failed requests
- **Check:** Environment variables are set correctly
- **Check:** Backend server is running

### Issue: 401 Unauthorized
- **Check:** You're logged in
- **Check:** JWT token is being sent in Authorization header
- **Check:** Token hasn't expired (try logging out and back in)

### Issue: 403 Forbidden
- **Check:** User has a record in `travel_agent` table
- **Check:** `user_id` in `travel_agent` matches the logged-in user's ID

### Issue: 422 Validation Error
- **Check:** All required fields are provided
- **Check:** Data types are correct (numbers are numbers, dates are valid)
- **Check:** Arrival time is after departure time
- **Check:** Available seats <= total seats

### Issue: 500 Internal Server Error
- **Check:** Backend logs for detailed error message
- **Check:** Database connection is working
- **Check:** `trips` table exists and has correct schema
- **Check:** Supabase credentials are correct

### Issue: CORS Error
- **Check:** Backend CORS settings (FastAPI should handle this automatically)
- **Check:** Frontend is calling the correct API URL

## Success Criteria

✅ Backend server starts without errors  
✅ Frontend loads without errors  
✅ Form displays all required fields  
✅ Form validation works correctly  
✅ Trip is created successfully in database  
✅ Success message and redirect work  
✅ Error handling works for all scenarios  
✅ API returns proper status codes  

## Next Steps

After successful testing:
1. Test with different transport types
2. Test edge cases (very large numbers, special characters in text fields)
3. Test with different date ranges
4. Verify trips appear in the manage trips page (if that page is connected to the API)

## Notes

- The form only includes fields from the `trips` table schema
- Additional fields (images, itinerary details, etc.) can be added later
- The `available_seats` field defaults to `total_seats` if not provided
- All timestamps are stored in UTC in the database


