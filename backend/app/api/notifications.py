from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client

router = APIRouter()


class BookingNotificationResponse(BaseModel):
    notification_id: int
    booking_id: int
    user_id: str
    notification_type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime


@router.get("", response_model=List[BookingNotificationResponse])
async def list_my_notifications(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    try:
        result = (
            supabase.table("booking_notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        out: List[BookingNotificationResponse] = []
        for row in result.data or []:
            out.append(
                BookingNotificationResponse(
                    notification_id=row["notification_id"],
                    booking_id=row["booking_id"],
                    user_id=row["user_id"],
                    notification_type=row["notification_type"],
                    title=row["title"],
                    message=row["message"],
                    is_read=bool(row.get("is_read")),
                    created_at=row["created_at"],
                )
            )
        return out
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching notifications: {str(e)}",
        )


@router.patch("/{notification_id}/read", response_model=BookingNotificationResponse)
async def mark_notification_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    try:
        existing = (
            supabase.table("booking_notifications")
            .select("*")
            .eq("notification_id", notification_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
        result = (
            supabase.table("booking_notifications")
            .update({"is_read": True})
            .eq("notification_id", notification_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Update failed")
        row = result.data[0]
        return BookingNotificationResponse(
            notification_id=row["notification_id"],
            booking_id=row["booking_id"],
            user_id=row["user_id"],
            notification_type=row["notification_type"],
            title=row["title"],
            message=row["message"],
            is_read=bool(row.get("is_read")),
            created_at=row["created_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating notification: {str(e)}",
        )


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    try:
        supabase.table("booking_notifications").update({"is_read": True}).eq("user_id", user_id).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error marking notifications read: {str(e)}",
        )
