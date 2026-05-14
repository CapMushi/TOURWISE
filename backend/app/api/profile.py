from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client

router = APIRouter()


class ProfileResponse(BaseModel):
    id: str
    email: Optional[str] = None
    username: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    profile_details: Optional[Dict[str, Any]] = None
    updated_at: Optional[datetime] = None


class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=1, max_length=80)
    preferences: Optional[Dict[str, Any]] = None
    profile_details: Optional[Dict[str, Any]] = None


def _ensure_profile_row(supabase, user_id: str) -> dict:
    result = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    if result.data:
        return result.data[0]
    insert_result = supabase.table("profiles").insert({"id": user_id}).execute()
    if insert_result.data:
        return insert_result.data[0]
    retry = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    if retry.data:
        return retry.data[0]
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not load or create profile",
    )


@router.get("", response_model=ProfileResponse)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    email = current_user.get("email")

    try:
        row = _ensure_profile_row(supabase, user_id)
        return ProfileResponse(
            id=user_id,
            email=email,
            username=row.get("username"),
            preferences=row.get("preferences"),
            profile_details=row.get("profile_details"),
            updated_at=row.get("updated_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching profile: {str(e)}",
        )


@router.patch("", response_model=ProfileResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    email = current_user.get("email")

    update_payload: dict = {}
    if body.username is not None:
        update_payload["username"] = body.username.strip()
    if body.preferences is not None:
        update_payload["preferences"] = body.preferences
    if body.profile_details is not None:
        update_payload["profile_details"] = body.profile_details

    if not update_payload:
        row = _ensure_profile_row(supabase, user_id)
        return ProfileResponse(
            id=user_id,
            email=email,
            username=row.get("username"),
            preferences=row.get("preferences"),
            profile_details=row.get("profile_details"),
            updated_at=row.get("updated_at"),
        )

    try:
        _ensure_profile_row(supabase, user_id)
        result = (
            supabase.table("profiles")
            .update(update_payload)
            .eq("id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update profile",
            )
        row = result.data[0]
        return ProfileResponse(
            id=user_id,
            email=email,
            username=row.get("username"),
            preferences=row.get("preferences"),
            profile_details=row.get("profile_details"),
            updated_at=row.get("updated_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating profile: {str(e)}",
        )


# ---------------------------------------------------------------------------
# Agent-specific profile endpoints
# ---------------------------------------------------------------------------

class AgentProfileResponse(BaseModel):
    agent_id: int
    user_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    verification_status: Optional[str] = None
    rating: Optional[float] = None
    numberofreviews: Optional[int] = None
    contact_info: Optional[Dict[str, Any]] = None
    profile_details: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class AgentProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    contact_info: Optional[Dict[str, Any]] = None
    profile_details: Optional[Dict[str, Any]] = None


class AgentDashboardStatsResponse(BaseModel):
    total_revenue: float
    total_bookings: int
    active_listings: int
    pending_inquiries: int


class AgentDashboardChartPoint(BaseModel):
    month: str
    bookings: int


class AgentDashboardRecentBooking(BaseModel):
    booking_id: int
    booking_reference: str
    booking_date: datetime
    status: str
    trip_label: str
    traveler_name: str
    total_price: float


class AgentDashboardResponse(BaseModel):
    stats: AgentDashboardStatsResponse
    bookings_by_month: List[AgentDashboardChartPoint]
    recent_bookings: List[AgentDashboardRecentBooking]


@router.get("/agent", response_model=AgentProfileResponse)
async def get_agent_profile(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Get the current user's travel agent profile."""
    user_id = current_user["id"]
    try:
        res = (
            supabase.table("travel_agent")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent profile not found for this user",
            )
        row = res.data[0]
        rating = row.get("rating")
        return AgentProfileResponse(
            agent_id=row["agent_id"],
            user_id=row["user_id"],
            name=row.get("name"),
            email=row.get("email"),
            verification_status=row.get("verification_status"),
            rating=float(rating) if rating is not None else None,
            numberofreviews=row.get("numberofreviews"),
            contact_info=row.get("contact_info"),
            profile_details=row.get("profile_details"),
            created_at=row.get("created_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching agent profile: {str(e)}",
        )


@router.get("/agent/dashboard", response_model=AgentDashboardResponse)
async def get_agent_dashboard(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Return live dashboard metrics for the current travel agent."""
    user_id = current_user["id"]
    try:
        agent_res = (
            supabase.table("travel_agent")
            .select("agent_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not agent_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent profile not found for this user",
            )

        agent_id = agent_res.data[0]["agent_id"]
        trips_res = (
            supabase.table("trips")
            .select("trip_id, origin_city, destination_city, available_seats")
            .eq("agent_id", agent_id)
            .execute()
        )
        trips = trips_res.data or []
        trip_ids = [trip["trip_id"] for trip in trips]
        trip_lookup = {
            trip["trip_id"]: f"{trip['origin_city']} -> {trip['destination_city']}"
            for trip in trips
        }

        bookings = []
        if trip_ids:
            bookings_res = (
                supabase.table("booking")
                .select("booking_id, trip_id, booking_reference, booking_date, status, total_price, contact_email, passenger_names")
                .in_("trip_id", trip_ids)
                .order("booking_date", desc=True)
                .execute()
            )
            bookings = bookings_res.data or []

        non_cancelled_bookings = [booking for booking in bookings if booking.get("status") != "cancelled"]
        total_revenue = sum(float(booking.get("total_price") or 0) for booking in non_cancelled_bookings)
        total_bookings = len(non_cancelled_bookings)
        active_listings = sum(1 for trip in trips if (trip.get("available_seats") or 0) > 0)

        pooling_res = (
            supabase.table("bus_pooling_requests")
            .select("request_id", count="exact")
            .eq("target_agent_id", agent_id)
            .eq("status", "pending")
            .execute()
        )
        pending_pooling = pooling_res.count or 0

        unread_messages_res = (
            supabase.table("agent_messages")
            .select("message_id", count="exact")
            .eq("receiver_agent_id", agent_id)
            .eq("is_read", False)
            .execute()
        )
        unread_messages = unread_messages_res.count or 0

        now = datetime.now(timezone.utc)
        month_starts: List[datetime] = []
        for offset in range(5, -1, -1):
            year = now.year
            month = now.month - offset
            while month <= 0:
                month += 12
                year -= 1
            month_starts.append(datetime(year, month, 1, tzinfo=timezone.utc))

        bookings_by_month_lookup = {
            (month_start.year, month_start.month): 0
            for month_start in month_starts
        }
        for booking in non_cancelled_bookings:
            booking_date = datetime.fromisoformat(booking["booking_date"].replace("Z", "+00:00"))
            key = (booking_date.year, booking_date.month)
            if key in bookings_by_month_lookup:
                bookings_by_month_lookup[key] += 1

        recent_bookings = []
        for booking in non_cancelled_bookings[:5]:
            passenger_names = booking.get("passenger_names") or []
            traveler_name = passenger_names[0] if passenger_names else (booking.get("contact_email") or "Traveler")
            recent_bookings.append(
                AgentDashboardRecentBooking(
                    booking_id=booking["booking_id"],
                    booking_reference=booking["booking_reference"],
                    booking_date=datetime.fromisoformat(booking["booking_date"].replace("Z", "+00:00")),
                    status=str(booking.get("status") or "unknown"),
                    trip_label=trip_lookup.get(booking["trip_id"], f"Trip #{booking['trip_id']}"),
                    traveler_name=traveler_name,
                    total_price=float(booking.get("total_price") or 0),
                )
            )

        return AgentDashboardResponse(
            stats=AgentDashboardStatsResponse(
                total_revenue=total_revenue,
                total_bookings=total_bookings,
                active_listings=active_listings,
                pending_inquiries=pending_pooling + unread_messages,
            ),
            bookings_by_month=[
                AgentDashboardChartPoint(
                    month=month_start.strftime("%b"),
                    bookings=bookings_by_month_lookup[(month_start.year, month_start.month)],
                )
                for month_start in month_starts
            ],
            recent_bookings=recent_bookings,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching agent dashboard: {str(e)}",
        )


@router.patch("/agent", response_model=AgentProfileResponse)
async def update_agent_profile(
    body: AgentProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Update the current user's travel agent profile."""
    user_id = current_user["id"]
    try:
        existing = (
            supabase.table("travel_agent")
            .select("agent_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent profile not found",
            )

        payload: dict = {}
        if body.name is not None:
            payload["name"] = body.name.strip()
        if body.contact_info is not None:
            payload["contact_info"] = body.contact_info
        if body.profile_details is not None:
            payload["profile_details"] = body.profile_details

        if not payload:
            return await get_agent_profile(current_user=current_user, supabase=supabase)

        res = (
            supabase.table("travel_agent")
            .update(payload)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update agent profile",
            )
        row = res.data[0]
        rating = row.get("rating")
        return AgentProfileResponse(
            agent_id=row["agent_id"],
            user_id=row["user_id"],
            name=row.get("name"),
            email=row.get("email"),
            verification_status=row.get("verification_status"),
            rating=float(rating) if rating is not None else None,
            numberofreviews=row.get("numberofreviews"),
            contact_info=row.get("contact_info"),
            profile_details=row.get("profile_details"),
            created_at=row.get("created_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating agent profile: {str(e)}",
        )
