from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
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


class BookingNotificationListResponse(BaseModel):
    notifications: List[BookingNotificationResponse]
    total: int
    unread_count: int
    page: int = 1
    page_size: int = 10
    total_pages: int = 1
    has_next_page: bool = False
    has_previous_page: bool = False


@router.get("", response_model=BookingNotificationListResponse)
async def list_my_notifications(
    page: Optional[int] = Query(None, ge=1, description="Page number for paginated results"),
    page_size: Optional[int] = Query(None, ge=1, le=50, description="Page size for paginated results"),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    should_paginate = page is not None or page_size is not None
    resolved_page = page or 1
    resolved_page_size = page_size or 10
    try:
        total_result = (
            supabase.table("booking_notifications")
            .select("notification_id", count="exact")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        unread_result = (
            supabase.table("booking_notifications")
            .select("notification_id", count="exact")
            .eq("user_id", user_id)
            .eq("is_read", False)
            .limit(1)
            .execute()
        )
        total = total_result.count or 0
        unread_count = unread_result.count or 0
        effective_page_size = resolved_page_size if should_paginate else max(total, 1)
        total_pages = max((total + effective_page_size - 1) // effective_page_size, 1)
        current_page = min(resolved_page, total_pages) if should_paginate else 1
        query = (
            supabase.table("booking_notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )
        if should_paginate:
            range_start = (current_page - 1) * resolved_page_size
            range_end = range_start + resolved_page_size - 1
            query = query.range(range_start, range_end)
        result = query.execute()
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
        return BookingNotificationListResponse(
            notifications=out,
            total=total,
            unread_count=unread_count,
            page=current_page,
            page_size=effective_page_size,
            total_pages=total_pages,
            has_next_page=current_page < total_pages,
            has_previous_page=current_page > 1,
        )
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
