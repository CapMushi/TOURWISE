from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CreateCollaboratorInviteRequest(BaseModel):
    trip_id: int
    # Either a username (string from profiles.username) or a user_id UUID
    collaborating_identifier: str
    message: Optional[str] = None


class UpdateCollaboratorInviteRequest(BaseModel):
    status: str  # accepted | rejected | cancelled


class CollaboratorInviteResponse(BaseModel):
    invite_id: int
    trip_id: int
    trip_label: str          # "origin_city → destination_city"
    inviting_agent_id: int
    inviting_agent_name: str
    collaborating_agent_id: int
    collaborating_agent_name: str
    message: Optional[str] = None
    status: str
    created_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_agent_from_identifier(supabase, identifier: str, requesting_agent_id: int) -> int:
    """
    Resolve an identifier to a travel_agent.agent_id.
    Accepts:
      - Numeric string  → direct agent_id lookup
      - UUID string     → profiles.id → travel_agent lookup
      - Other string    → profiles.username → travel_agent lookup
    Raises HTTPException if not found, not an agent, or is the same agent.
    """
    identifier = identifier.strip()

    # 1. Direct agent_id (numeric string)
    if identifier.isdigit():
        agent_id = int(identifier)
        check = (
            supabase.table("travel_agent")
            .select("agent_id")
            .eq("agent_id", agent_id)
            .limit(1)
            .execute()
        )
        if not check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No travel agent with agent ID {agent_id}.",
            )
        if agent_id == requesting_agent_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot invite yourself as a collaborator.",
            )
        return agent_id

    # 2. UUID user_id
    profile_res = None
    if len(identifier) == 36 and "-" in identifier:
        profile_res = (
            supabase.table("profiles")
            .select("id")
            .eq("id", identifier)
            .limit(1)
            .execute()
        )

    # 3. Username fallback
    if not (profile_res and profile_res.data):
        profile_res = (
            supabase.table("profiles")
            .select("id")
            .eq("username", identifier)
            .limit(1)
            .execute()
        )

    if not profile_res or not profile_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found with username or user ID '{identifier}'.",
        )

    target_user_id = profile_res.data[0]["id"]

    agent_res = (
        supabase.table("travel_agent")
        .select("agent_id, name")
        .eq("user_id", target_user_id)
        .limit(1)
        .execute()
    )
    if not agent_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That user is not registered as a travel agent.",
        )

    agent_id = agent_res.data[0]["agent_id"]
    if agent_id == requesting_agent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot invite yourself as a collaborator.",
        )

    return agent_id


def _build_response(row: dict, supabase) -> CollaboratorInviteResponse:
    """Build a CollaboratorInviteResponse from a raw DB row."""
    # Fetch trip label
    trip_res = (
        supabase.table("trips")
        .select("origin_city, destination_city")
        .eq("trip_id", row["trip_id"])
        .limit(1)
        .execute()
    )
    trip = trip_res.data[0] if trip_res.data else {}
    trip_label = f"{trip.get('origin_city', '')} → {trip.get('destination_city', '')}"

    # Fetch agent names
    inv_res = (
        supabase.table("travel_agent")
        .select("name")
        .eq("agent_id", row["inviting_agent_id"])
        .limit(1)
        .execute()
    )
    col_res = (
        supabase.table("travel_agent")
        .select("name")
        .eq("agent_id", row["collaborating_agent_id"])
        .limit(1)
        .execute()
    )

    created = row.get("created_at", "")
    if isinstance(created, datetime):
        created = created.isoformat()

    return CollaboratorInviteResponse(
        invite_id=row["invite_id"],
        trip_id=row["trip_id"],
        trip_label=trip_label,
        inviting_agent_id=row["inviting_agent_id"],
        inviting_agent_name=(inv_res.data[0].get("name") or "Agent") if inv_res.data else "Agent",
        collaborating_agent_id=row["collaborating_agent_id"],
        collaborating_agent_name=(col_res.data[0].get("name") or "Agent") if col_res.data else "Agent",
        message=row.get("message"),
        status=row["status"],
        created_at=str(created),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

class PublicCollaboratorInfo(BaseModel):
    agent_id: int
    agent_name: str


@router.get("/trip/{trip_id}", response_model=List[PublicCollaboratorInfo])
def get_trip_collaborators_public(
    trip_id: int,
    supabase=Depends(get_supabase_client),
):
    """Public endpoint: returns accepted collaborating agents for a trip (no auth required)."""
    result = (
        supabase.table("trip_collaborators")
        .select("inviting_agent_id, collaborating_agent_id")
        .eq("trip_id", trip_id)
        .eq("status", "accepted")
        .execute()
    )

    # Collect unique agent IDs that are collaborators (not the trip owner)
    # For requests made FROM the hub: inviting_agent_id is the requester (non-owner)
    # For requests made FROM manage-details: collaborating_agent_id is the invitee
    # Either way we want to show the non-owner agent — but we need to know who owns the trip
    trip_res = (
        supabase.table("trips")
        .select("agent_id")
        .eq("trip_id", trip_id)
        .limit(1)
        .execute()
    )
    owner_agent_id = trip_res.data[0]["agent_id"] if trip_res.data else None

    collab_agent_ids: set = set()
    for row in result.data or []:
        for field in ("inviting_agent_id", "collaborating_agent_id"):
            aid = row[field]
            if aid != owner_agent_id:
                collab_agent_ids.add(aid)

    if not collab_agent_ids:
        return []

    agents_res = (
        supabase.table("travel_agent")
        .select("agent_id, name")
        .in_("agent_id", list(collab_agent_ids))
        .execute()
    )
    return [
        PublicCollaboratorInfo(agent_id=a["agent_id"], agent_name=a.get("name") or f"Agent #{a['agent_id']}")
        for a in (agents_res.data or [])
    ]


@router.post("", response_model=CollaboratorInviteResponse, status_code=status.HTTP_201_CREATED)
def create_collaborator_invite(
    body: CreateCollaboratorInviteRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Invite another travel agent to collaborate on one of your trips."""
    user_id = current_user["id"]

    # Verify requester is an agent and owns the trip
    agent_res = (
        supabase.table("travel_agent")
        .select("agent_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not agent_res.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a travel agent.")
    inviting_agent_id = agent_res.data[0]["agent_id"]

    trip_res = (
        supabase.table("trips")
        .select("trip_id, agent_id")
        .eq("trip_id", body.trip_id)
        .limit(1)
        .execute()
    )
    if not trip_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found.")

    collaborating_agent_id = _resolve_agent_from_identifier(supabase, body.collaborating_identifier, inviting_agent_id)

    # Upsert: if a cancelled/rejected invite exists, allow re-inviting
    existing = (
        supabase.table("trip_collaborators")
        .select("invite_id, status")
        .eq("trip_id", body.trip_id)
        .eq("collaborating_agent_id", collaborating_agent_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        ex = existing.data[0]
        if ex["status"] in ("pending", "accepted"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active collaboration invite already exists for this agent on this trip.",
            )
        # Re-invite by updating the existing row
        update_res = (
            supabase.table("trip_collaborators")
            .update({"status": "pending", "message": body.message, "updated_at": datetime.utcnow().isoformat()})
            .eq("invite_id", ex["invite_id"])
            .execute()
        )
        row = update_res.data[0]
    else:
        insert_res = (
            supabase.table("trip_collaborators")
            .insert({
                "trip_id": body.trip_id,
                "inviting_agent_id": inviting_agent_id,
                "collaborating_agent_id": collaborating_agent_id,
                "message": body.message,
                "status": "pending",
            })
            .execute()
        )
        if not insert_res.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create invite.")
        row = insert_res.data[0]

    return _build_response(row, supabase)


@router.get("", response_model=List[CollaboratorInviteResponse])
def get_collaborator_invites(
    type: str = Query("all", description="sent | received | all"),
    trip_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Get collaboration invites sent by or received by the current agent."""
    user_id = current_user["id"]

    agent_res = (
        supabase.table("travel_agent")
        .select("agent_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not agent_res.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a travel agent.")
    agent_id = agent_res.data[0]["agent_id"]

    query = supabase.table("trip_collaborators").select("*").order("created_at", desc=True)

    if type == "sent":
        query = query.eq("inviting_agent_id", agent_id)
    elif type == "received":
        query = query.eq("collaborating_agent_id", agent_id)
    else:
        query = query.or_(f"inviting_agent_id.eq.{agent_id},collaborating_agent_id.eq.{agent_id}")

    if trip_id is not None:
        query = query.eq("trip_id", trip_id)

    result = query.execute()
    return [_build_response(row, supabase) for row in (result.data or [])]


@router.patch("/{invite_id}", response_model=CollaboratorInviteResponse)
def update_collaborator_invite(
    invite_id: int,
    body: UpdateCollaboratorInviteRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Accept, reject, or cancel a collaboration invite."""
    if body.status not in ("accepted", "rejected", "cancelled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status must be accepted, rejected, or cancelled.")

    user_id = current_user["id"]
    agent_res = (
        supabase.table("travel_agent")
        .select("agent_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not agent_res.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a travel agent.")
    agent_id = agent_res.data[0]["agent_id"]

    invite_res = (
        supabase.table("trip_collaborators")
        .select("*")
        .eq("invite_id", invite_id)
        .limit(1)
        .execute()
    )
    if not invite_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found.")
    invite = invite_res.data[0]

    # Authorisation: only the collaborating agent can accept/reject; only the inviting agent can cancel
    if body.status in ("accepted", "rejected") and invite["collaborating_agent_id"] != agent_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the invited agent can accept or reject.")
    if body.status == "cancelled" and invite["inviting_agent_id"] != agent_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the inviting agent can cancel.")

    update_res = (
        supabase.table("trip_collaborators")
        .update({"status": body.status, "updated_at": datetime.utcnow().isoformat()})
        .eq("invite_id", invite_id)
        .execute()
    )
    if not update_res.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update invite.")

    return _build_response(update_res.data[0], supabase)
