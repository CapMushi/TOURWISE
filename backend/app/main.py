from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import health, auth, trips, collaboration, bookings

app = FastAPI(
    title="TourWise API",
    description="Backend API for TourWise travel platform",
    version="0.1.0",
)

# Configure CORS
# Allow localhost and common local network IPs for development
cors_origins = [
    "http://localhost:8080",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:5173",
    # Allow local network IPs (e.g., when accessing via http://192.168.x.x:8080)
    # This pattern covers common local network ranges
    "http://192.168.1.8:8080",
    "http://192.168.1.8:5173",
    # Add more specific IPs as needed for your network
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(trips.router, prefix="/api/trips", tags=["trips"])
app.include_router(collaboration.router, prefix="/api/collaboration", tags=["collaboration"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["bookings"])


@app.get("/")
async def root():
    return {"message": "TourWise API", "version": "0.1.0"}

