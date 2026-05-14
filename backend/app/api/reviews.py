from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.services.supabase_client import get_supabase_client

router = APIRouter()


class AgentReviewableItem(BaseModel):
    agent_id: int
    name: str
    email: Optional[str] = None
    rating: Optional[Decimal] = None
    numberofreviews: Optional[int] = None
    verification_status: Optional[str] = None
    contact_info: Optional[dict] = None
    profile_details: Optional[dict] = None


class AgentReview(BaseModel):
    review_id: int
    agent_id: int
    user_id: str
    username: Optional[str] = None
    rating: Decimal
    comment: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class UpsertAgentReviewRequest(BaseModel):
    rating: Decimal = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)


class TripReview(BaseModel):
    review_id: int
    trip_id: int
    user_id: str
    username: Optional[str] = None
    rating: Decimal
    comment: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class UpsertTripReviewRequest(BaseModel):
    rating: Decimal = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)


@router.get("/agents", response_model=List[AgentReviewableItem])
def list_agents_for_reviews(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """List all travel agents for traveler review flow."""
    _ = current_user["id"]  # require auth
    try:
        result = (
            supabase.table("travel_agent")
            .select("agent_id, name, email, rating, numberofreviews, verification_status, contact_info, profile_details")
            .order("rating", desc=True)
            .execute()
        )
        return [AgentReviewableItem(**row) for row in result.data or []]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching agents for reviews: {str(e)}",
        )


@router.get("/agents/{agent_id}/trips")
def get_agent_public_trips(
    agent_id: int,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Get active trips for a given agent (public view for travelers)."""
    _ = current_user["id"]
    try:
        agent = supabase.table("travel_agent").select("agent_id").eq("agent_id", agent_id).limit(1).execute()
        if not agent.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        trips_res = (
            supabase.table("trips")
            .select("trip_id, origin_city, destination_city, departure_time, arrival_time, price, transport_type, total_seats, available_seats, suitability, image_url")
            .eq("agent_id", agent_id)
            .gt("available_seats", 0)
            .order("departure_time", desc=False)
            .limit(20)
            .execute()
        )
        return trips_res.data or []
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching agent trips: {str(e)}",
        )


@router.get("/agents/{agent_id}/my-review")
def get_my_review_for_agent(
    agent_id: int,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Get the current traveler's own review for a specific agent, or null."""
    user_id = current_user["id"]
    try:
        res = (
            supabase.table("agent_reviews")
            .select("*")
            .eq("agent_id", agent_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        row = res.data[0]
        return {
            "review_id": row["review_id"],
            "agent_id": row["agent_id"],
            "rating": float(row["rating"]),
            "comment": row.get("comment"),
            "created_at": row["created_at"],
            "updated_at": row.get("updated_at"),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching your review: {str(e)}",
        )


@router.get("/agents/{agent_id}/reviews", response_model=List[AgentReview])
def list_reviews_for_agent(
    agent_id: int,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    _ = current_user["id"]
    try:
        # Validate agent exists
        agent = supabase.table("travel_agent").select("agent_id").eq("agent_id", agent_id).limit(1).execute()
        if not agent.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

        reviews_res = (
            supabase.table("agent_reviews")
            .select("*")
            .eq("agent_id", agent_id)
            .order("created_at", desc=True)
            .execute()
        )
        rows = reviews_res.data or []
        if not rows:
            return []

        user_ids = list({r["user_id"] for r in rows if r.get("user_id")})
        username_map: dict[str, str] = {}
        if user_ids:
            profile_res = (
                supabase.table("profiles")
                .select("id, username")
                .in_("id", user_ids)
                .execute()
            )
            for p in profile_res.data or []:
                username_map[p["id"]] = p.get("username") or "Traveler"

        out: List[AgentReview] = []
        for row in rows:
            out.append(
                AgentReview(
                    review_id=row["review_id"],
                    agent_id=row["agent_id"],
                    user_id=row["user_id"],
                    username=username_map.get(row["user_id"]),
                    rating=Decimal(str(row["rating"])),
                    comment=row.get("comment"),
                    created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
                    updated_at=datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00"))
                    if row.get("updated_at")
                    else None,
                )
            )
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching reviews: {str(e)}",
        )


@router.post("/agents/{agent_id}/reviews", response_model=AgentReview)
def upsert_agent_review(
    agent_id: int,
    payload: UpsertAgentReviewRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    try:
        # Validate target agent
        target_agent_res = (
            supabase.table("travel_agent").select("agent_id").eq("agent_id", agent_id).limit(1).execute()
        )
        if not target_agent_res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

        # Prevent self-review for agent's own profile
        own_agent_res = (
            supabase.table("travel_agent").select("agent_id").eq("user_id", user_id).limit(1).execute()
        )
        if own_agent_res.data and own_agent_res.data[0]["agent_id"] == agent_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot review your own agent profile",
            )

        existing = (
            supabase.table("agent_reviews")
            .select("*")
            .eq("agent_id", agent_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        now_iso = datetime.utcnow().isoformat()
        if existing.data:
            updated = (
                supabase.table("agent_reviews")
                .update(
                    {
                        "rating": float(payload.rating),
                        "comment": payload.comment,
                        "updated_at": now_iso,
                    }
                )
                .eq("review_id", existing.data[0]["review_id"])
                .execute()
            )
            row = updated.data[0]
        else:
            created = (
                supabase.table("agent_reviews")
                .insert(
                    {
                        "agent_id": agent_id,
                        "user_id": user_id,
                        "rating": float(payload.rating),
                        "comment": payload.comment,
                        "updated_at": now_iso,
                    }
                )
                .execute()
            )
            row = created.data[0]

        profile = supabase.table("profiles").select("username").eq("id", user_id).limit(1).execute()
        username = profile.data[0].get("username") if profile.data else None

        return AgentReview(
            review_id=row["review_id"],
            agent_id=row["agent_id"],
            user_id=row["user_id"],
            username=username,
            rating=Decimal(str(row["rating"])),
            comment=row.get("comment"),
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00"))
            if row.get("updated_at")
            else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        message = str(e)
        if "agent_reviews" in message.lower():
            message = (
                "agent_reviews table not found. Run backend/supabase/additive_features_no_column_renames.sql first."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving review: {message}",
        )


@router.get("/trips/{trip_id}/my-review")
def get_my_review_for_trip(
    trip_id: int,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    try:
        trip_res = supabase.table("trips").select("trip_id").eq("trip_id", trip_id).limit(1).execute()
        if not trip_res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        res = (
            supabase.table("trip_reviews")
            .select("*")
            .eq("trip_id", trip_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        row = res.data[0]
        return {
            "review_id": row["review_id"],
            "trip_id": row["trip_id"],
            "rating": float(row["rating"]),
            "comment": row.get("comment"),
            "created_at": row["created_at"],
            "updated_at": row.get("updated_at"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching your trip review: {str(e)}",
        )


@router.get("/trips/{trip_id}/reviews", response_model=List[TripReview])
def list_reviews_for_trip(
    trip_id: int,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    _ = current_user["id"]
    try:
        trip_res = supabase.table("trips").select("trip_id").eq("trip_id", trip_id).limit(1).execute()
        if not trip_res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

        reviews_res = (
            supabase.table("trip_reviews")
            .select("*")
            .eq("trip_id", trip_id)
            .order("created_at", desc=True)
            .execute()
        )
        rows = reviews_res.data or []
        if not rows:
            return []

        user_ids = list({row["user_id"] for row in rows if row.get("user_id")})
        username_map: dict[str, str] = {}
        if user_ids:
            profile_res = (
                supabase.table("profiles")
                .select("id, username")
                .in_("id", user_ids)
                .execute()
            )
            for profile in profile_res.data or []:
                username_map[profile["id"]] = profile.get("username") or "Traveler"

        return [
            TripReview(
                review_id=row["review_id"],
                trip_id=row["trip_id"],
                user_id=row["user_id"],
                username=username_map.get(row["user_id"]),
                rating=Decimal(str(row["rating"])),
                comment=row.get("comment"),
                created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
                updated_at=datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00"))
                if row.get("updated_at")
                else None,
            )
            for row in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching trip reviews: {str(e)}",
        )


@router.post("/trips/{trip_id}/reviews", response_model=TripReview)
def upsert_trip_review(
    trip_id: int,
    payload: UpsertTripReviewRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    user_id = current_user["id"]
    try:
        trip_res = (
            supabase.table("trips")
            .select("trip_id, agent_id")
            .eq("trip_id", trip_id)
            .limit(1)
            .execute()
        )
        if not trip_res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
        trip_row = trip_res.data[0]

        owner_res = (
            supabase.table("travel_agent")
            .select("agent_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if owner_res.data and owner_res.data[0]["agent_id"] == trip_row["agent_id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot review your own trip",
            )

        booking_res = (
            supabase.table("booking")
            .select("booking_id")
            .eq("trip_id", trip_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not booking_res.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only review trips you have booked",
            )

        existing = (
            supabase.table("trip_reviews")
            .select("*")
            .eq("trip_id", trip_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        now_iso = datetime.utcnow().isoformat()
        if existing.data:
            updated = (
                supabase.table("trip_reviews")
                .update(
                    {
                        "rating": float(payload.rating),
                        "comment": payload.comment,
                        "updated_at": now_iso,
                    }
                )
                .eq("review_id", existing.data[0]["review_id"])
                .execute()
            )
            row = updated.data[0]
        else:
            created = (
                supabase.table("trip_reviews")
                .insert(
                    {
                        "trip_id": trip_id,
                        "agent_id": trip_row["agent_id"],
                        "user_id": user_id,
                        "rating": float(payload.rating),
                        "comment": payload.comment,
                        "updated_at": now_iso,
                    }
                )
                .execute()
            )
            row = created.data[0]

        profile = supabase.table("profiles").select("username").eq("id", user_id).limit(1).execute()
        username = profile.data[0].get("username") if profile.data else None

        return TripReview(
            review_id=row["review_id"],
            trip_id=row["trip_id"],
            user_id=row["user_id"],
            username=username,
            rating=Decimal(str(row["rating"])),
            comment=row.get("comment"),
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00"))
            if row.get("updated_at")
            else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        message = str(e)
        if "trip_reviews" in message.lower():
            message = (
                "trip_reviews table not found. Run backend/supabase/trip_reviews_phase1.sql first."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving trip review: {message}",
        )

