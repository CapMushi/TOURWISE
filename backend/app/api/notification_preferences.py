from datetime import time, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client

router = APIRouter()


class NotificationPreferencesResponse(BaseModel):
    user_id: str
    booking_updates: bool = True
    payment_updates: bool = True
    trip_reminders: bool = True
    promotions: bool = False
    agent_messages: bool = True
    in_app_enabled: bool = True
    email_enabled: bool = True
    sms_enabled: bool = False
    push_enabled: bool = False
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None
    timezone: Optional[str] = "UTC"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class NotificationPreferencesUpdate(BaseModel):
    booking_updates: Optional[bool] = None
    payment_updates: Optional[bool] = None
    trip_reminders: Optional[bool] = None
    promotions: Optional[bool] = None
    agent_messages: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None
    timezone: Optional[str] = None


@router.get("", response_model=NotificationPreferencesResponse)
def get_notification_preferences(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]

    try:
        result = (
            supabase.table("notification_preferences")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if result.data:
            return NotificationPreferencesResponse(**result.data[0])

        create_result = (
            supabase.table("notification_preferences")
            .insert({"user_id": user_id})
            .execute()
        )
        if not create_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize notification preferences",
            )

        return NotificationPreferencesResponse(**create_result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching notification preferences: {str(e)}",
        )


@router.patch("", response_model=NotificationPreferencesResponse)
def update_notification_preferences(
    payload: NotificationPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    try:
        existing = (
            supabase.table("notification_preferences")
            .select("user_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if not existing.data:
            supabase.table("notification_preferences").insert({"user_id": user_id}).execute()

        result = (
            supabase.table("notification_preferences")
            .update(update_data)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update notification preferences",
            )

        return NotificationPreferencesResponse(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating notification preferences: {str(e)}",
        )

