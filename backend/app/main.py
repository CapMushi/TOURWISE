from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import (
    admin,
    health,
    auth,
    trips,
    collaboration,
    bookings,
    favorites,
    notification_preferences,
    profile,
    notifications,
    integrations,
    recommendations,
    reviews,
    chat,
)

app = FastAPI(
    title="TourWise API",
    description="Backend API for TourWise travel platform",
    version="0.1.0",
)

# Configure CORS
# Allow localhost and any local network IP for development
cors_origins = [
    "http://localhost:8080",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"http://192\.168\.\d+\.\d+:(8080|5173|3000)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(trips.router, prefix="/api/trips", tags=["trips"])
app.include_router(collaboration.router, prefix="/api/collaboration", tags=["collaboration"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["bookings"])
app.include_router(favorites.router, prefix="/api/favorites", tags=["favorites"])
app.include_router(
    notification_preferences.router,
    prefix="/api/notification-preferences",
    tags=["notification-preferences"],
)
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"])
app.include_router(recommendations.router, prefix="/api/recommendations", tags=["recommendations"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])


@app.get("/")
async def root():
    return {"message": "TourWise API", "version": "0.1.0"}

