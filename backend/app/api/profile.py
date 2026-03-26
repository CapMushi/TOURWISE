from datetime import datetime
from typing import Any, Dict, Optional

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
