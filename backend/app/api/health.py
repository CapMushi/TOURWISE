from fastapi import APIRouter
from datetime import datetime
import time

router = APIRouter()

# Track server start time for uptime calculation
_start_time = time.time()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    uptime_seconds = int(time.time() - _start_time)
    
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "uptime_seconds": uptime_seconds,
        "version": "0.1.0",
    }

