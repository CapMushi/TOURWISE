from fastapi import FastAPI
from app.api import health, auth

app = FastAPI(
    title="TourWise API",
    description="Backend API for TourWise travel platform",
    version="0.1.0",
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api", tags=["auth"])


@app.get("/")
async def root():
    return {"message": "TourWise API", "version": "0.1.0"}

