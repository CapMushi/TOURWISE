from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import require_admin_user
from app.services.supabase_client import get_supabase_client


router = APIRouter()

APPROVED_AGENT_STATUSES = ["approved"]


class AdminDashboardStatsResponse(BaseModel):
    total_users: int
    pending_verifications: int
    active_trips: int


class AdminActivityItem(BaseModel):
    id: str
    text: str
    created_at: str
    time: str
    activity_type: Literal["agent_request", "trip_created", "booking_created"]


class AdminDashboardResponse(BaseModel):
    stats: AdminDashboardStatsResponse
    recent_activity: list[AdminActivityItem]


class AdminManagedAgent(BaseModel):
    agent_id: int
    user_id: str
    name: str
    email: Optional[str] = None
    verification_status: Optional[str] = None
    created_at: Optional[str] = None
    rating: Optional[float] = None
    numberofreviews: int = 0
    total_trips: int = 0


class AdminAgentDirectoryResponse(BaseModel):
    pending: list[AdminManagedAgent]
    active: list[AdminManagedAgent]


class AgentVerificationDecisionRequest(BaseModel):
    decision: Literal["approved", "rejected"]


class AgentVerificationDecisionResponse(BaseModel):
    message: str
    agent_id: int
    verification_status: str


def _format_relative_time(value: str | None) -> str:
    if not value:
        return "Unknown time"

    try:
        created_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return "Unknown time"

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    delta = datetime.now(timezone.utc) - created_at
    total_seconds = max(int(delta.total_seconds()), 0)

    if total_seconds < 60:
        return "Just now"
    if total_seconds < 3600:
        minutes = total_seconds // 60
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    if total_seconds < 86400:
        hours = total_seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''} ago"

    days = total_seconds // 86400
    return f"{days} day{'s' if days != 1 else ''} ago"


def _count_rows(supabase, table_name: str, *filters):
    query = supabase.table(table_name).select("*", count="exact").limit(1)
    for filter_fn in filters:
        query = filter_fn(query)
    result = query.execute()
    return result.count or 0


def _serialize_agents(rows: list[dict], trip_counts: dict[int, int]) -> list[AdminManagedAgent]:
    serialized: list[AdminManagedAgent] = []
    for row in rows:
        rating = row.get("rating")
        serialized.append(
            AdminManagedAgent(
                agent_id=row["agent_id"],
                user_id=row["user_id"],
                name=row.get("name") or "Unnamed Agent",
                email=row.get("email"),
                verification_status=row.get("verification_status"),
                created_at=row.get("created_at"),
                rating=float(rating) if rating is not None else None,
                numberofreviews=row.get("numberofreviews") or 0,
                total_trips=trip_counts.get(row["agent_id"], 0),
            )
        )
    return serialized


def _get_trip_counts_by_agent(supabase, agent_ids: list[int]) -> dict[int, int]:
    if not agent_ids:
        return {}

    result = (
        supabase.table("trips")
        .select("agent_id")
        .in_("agent_id", agent_ids)
        .execute()
    )

    counts: dict[int, int] = {}
    for row in result.data or []:
        agent_id = row.get("agent_id")
        if agent_id is None:
            continue
        counts[agent_id] = counts.get(agent_id, 0) + 1

    return counts


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_admin_dashboard(
    _: dict = Depends(require_admin_user),
    supabase=Depends(get_supabase_client),
):
    total_users = _count_rows(supabase, "profiles")
    pending_verifications = _count_rows(
        supabase,
        "travel_agent",
        lambda q: q.eq("verification_status", "pending"),
    )
    active_trips = _count_rows(
        supabase,
        "trips",
        lambda q: q.gt("available_seats", 0),
    )

    pending_agents_result = (
        supabase.table("travel_agent")
        .select("agent_id, name, created_at")
        .eq("verification_status", "pending")
        .order("created_at", desc=True)
        .limit(4)
        .execute()
    )
    recent_trips_result = (
        supabase.table("trips")
        .select("trip_id, origin_city, destination_city, created_at, travel_agent(name)")
        .order("created_at", desc=True)
        .limit(4)
        .execute()
    )
    recent_bookings_result = (
        supabase.table("booking")
        .select("booking_id, booking_date, trips(origin_city, destination_city)")
        .order("booking_date", desc=True)
        .limit(4)
        .execute()
    )

    recent_activity: list[dict] = []

    for row in pending_agents_result.data or []:
        created_at = row.get("created_at")
        recent_activity.append(
            {
                "id": f"agent-request-{row['agent_id']}",
                "text": f"Agent verification request: {row.get('name') or 'Unnamed Agent'}",
                "created_at": created_at or "",
                "time": _format_relative_time(created_at),
                "activity_type": "agent_request",
            }
        )

    for row in recent_trips_result.data or []:
        created_at = row.get("created_at")
        travel_agent = row.get("travel_agent") or {}
        recent_activity.append(
            {
                "id": f"trip-{row['trip_id']}",
                "text": (
                    f"New trip listed: {row.get('origin_city') or 'Unknown'} -> "
                    f"{row.get('destination_city') or 'Unknown'} by "
                    f"{travel_agent.get('name') or 'Unknown Agent'}"
                ),
                "created_at": created_at or "",
                "time": _format_relative_time(created_at),
                "activity_type": "trip_created",
            }
        )

    for row in recent_bookings_result.data or []:
        booking_date = row.get("booking_date")
        trip_row = row.get("trips") or {}
        recent_activity.append(
            {
                "id": f"booking-{row['booking_id']}",
                "text": (
                    f"New booking received for "
                    f"{trip_row.get('origin_city') or 'Unknown'} -> "
                    f"{trip_row.get('destination_city') or 'Unknown'}"
                ),
                "created_at": booking_date or "",
                "time": _format_relative_time(booking_date),
                "activity_type": "booking_created",
            }
        )

    recent_activity.sort(key=lambda item: item["created_at"], reverse=True)

    return AdminDashboardResponse(
        stats=AdminDashboardStatsResponse(
            total_users=total_users,
            pending_verifications=pending_verifications,
            active_trips=active_trips,
        ),
        recent_activity=[AdminActivityItem(**item) for item in recent_activity[:8]],
    )


@router.get("/agents", response_model=AdminAgentDirectoryResponse)
async def get_admin_agents(
    _: dict = Depends(require_admin_user),
    supabase=Depends(get_supabase_client),
):
    pending_result = (
        supabase.table("travel_agent")
        .select("agent_id, user_id, name, email, verification_status, created_at, rating, numberofreviews")
        .eq("verification_status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    active_result = (
        supabase.table("travel_agent")
        .select("agent_id, user_id, name, email, verification_status, created_at, rating, numberofreviews")
        .in_("verification_status", APPROVED_AGENT_STATUSES)
        .order("created_at", desc=True)
        .execute()
    )

    all_agent_ids = [
        *(row["agent_id"] for row in pending_result.data or []),
        *(row["agent_id"] for row in active_result.data or []),
    ]
    trip_counts = _get_trip_counts_by_agent(supabase, all_agent_ids)

    return AdminAgentDirectoryResponse(
        pending=_serialize_agents(pending_result.data or [], trip_counts),
        active=_serialize_agents(active_result.data or [], trip_counts),
    )


@router.patch("/agents/{agent_id}/verification", response_model=AgentVerificationDecisionResponse)
async def review_agent_verification(
    agent_id: int,
    body: AgentVerificationDecisionRequest,
    _: dict = Depends(require_admin_user),
    supabase=Depends(get_supabase_client),
):
    existing = (
        supabase.table("travel_agent")
        .select("agent_id, verification_status")
        .eq("agent_id", agent_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Travel agent not found.",
        )

    result = (
        supabase.table("travel_agent")
        .update({"verification_status": body.decision})
        .eq("agent_id", agent_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update travel agent verification status.",
        )

    return AgentVerificationDecisionResponse(
        message=f"Agent {body.decision} successfully.",
        agent_id=agent_id,
        verification_status=body.decision,
    )
