import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from app.core.security import get_current_user, get_user_role_flags
from app.services.supabase_client import get_supabase_client


router = APIRouter()


class SkipVerificationResponse(BaseModel):
    message: str
    agent_id: int


class AgentApplicationDocuments(BaseModel):
    cnic_front_path: str = Field(..., min_length=1)
    cnic_back_path: str = Field(..., min_length=1)
    business_license_path: Optional[str] = None


class AgentApplicationRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=200)
    phone: str = Field(..., min_length=5, max_length=40)
    cnic_number: str = Field(..., min_length=13, max_length=20)
    address: Optional[str] = Field(None, max_length=500)
    bio: Optional[str] = Field(None, max_length=2000)
    documents: AgentApplicationDocuments


class RegisterAsAgentResponse(BaseModel):
    message: str
    agent_id: int
    verification_status: str


# Pakistani CNIC formats accepted: 1234567890123 or 12345-1234567-1
CNIC_REGEX = re.compile(r"^\d{5}-?\d{7}-?\d$")


def _normalise_cnic(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) != 13:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CNIC must contain exactly 13 digits (e.g. 12345-1234567-1).",
        )
    return f"{digits[0:5]}-{digits[5:12]}-{digits[12]}"


@router.post("/register-as-agent", response_model=RegisterAsAgentResponse)
def register_as_agent(
    body: AgentApplicationRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Submit (or resubmit) a travel-agent verification application for the
    current user. Upserts a `travel_agent` row with the supplied business
    info, CNIC number, and document object-paths, then sets the row to
    `verification_status = 'pending'` and stamps `submitted_at = now()`.

    Behaviour:
    - If no row exists, create it.
    - If a row exists with status `pending` or `rejected`, update it in place
      (lets a rejected applicant resubmit with corrected info / new docs).
    - If a row exists with status `approved`, refuse with 409.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]
    email = current_user.get("email") or ""
    fallback_name = email.split("@")[0] if email else "agent"

    if not CNIC_REGEX.match(body.cnic_number or ""):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CNIC must look like 12345-1234567-1 (13 digits).",
        )
    cnic_normalised = _normalise_cnic(body.cnic_number)

    # Block agent registration for CNICs that an admin has previously banned.
    # Active rows are those with lifted_at IS NULL; the partial index
    # idx_banned_cnics_active makes this a single index probe.
    banned_cnic_result = (
        supabase.table("banned_cnics")
        .select("cnic_number, reason")
        .eq("cnic_number", cnic_normalised)
        .is_("lifted_at", "null")
        .limit(1)
        .execute()
    )
    if banned_cnic_result.data:
        reason = banned_cnic_result.data[0].get("reason") or "No reason recorded"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This CNIC is banned from agent registration. Reason: {reason}",
        )

    existing_query = (
        supabase.table("travel_agent")
        .select("agent_id, verification_status, name, profile_details")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    existing_row = existing_query.data[0] if existing_query.data else None

    if existing_row and existing_row.get("verification_status") == "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your agent account is already approved; no resubmission needed.",
        )

    submitted_at = datetime.now(timezone.utc).isoformat()

    # Preserve any pre-existing profile_details keys (e.g. avatar_url, bio)
    # so a resubmission doesn't wipe the agent's profile photo.
    prior_profile_details = (existing_row or {}).get("profile_details") or {}
    if not isinstance(prior_profile_details, dict):
        prior_profile_details = {}

    new_profile_details: Dict[str, Any] = {
        **prior_profile_details,
        "documents": {
            "cnic_front_path": body.documents.cnic_front_path,
            "cnic_back_path": body.documents.cnic_back_path,
            "business_license_path": body.documents.business_license_path,
        },
    }
    if body.bio is not None:
        new_profile_details["bio"] = body.bio

    contact_info: Dict[str, Any] = {
        "phone": body.phone,
        "address": body.address,
        "cnic_number": cnic_normalised,
    }

    payload: Dict[str, Any] = {
        "user_id": user_id,
        "email": email,
        "business_name": body.business_name,
        "phone": body.phone,
        "cnic_number": cnic_normalised,
        "contact_info": contact_info,
        "profile_details": new_profile_details,
        "verification_status": "pending",
        "submitted_at": submitted_at,
    }

    try:
        if existing_row:
            agent_id = existing_row["agent_id"]
            result = (
                supabase.table("travel_agent")
                .update(payload)
                .eq("agent_id", agent_id)
                .execute()
            )
            if not result.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update travel agent application.",
                )
            return RegisterAsAgentResponse(
                message="Application resubmitted; awaiting admin review.",
                agent_id=agent_id,
                verification_status="pending",
            )

        payload["name"] = fallback_name
        result = supabase.table("travel_agent").insert(payload).execute()
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create travel agent record.",
            )
        agent_id = result.data[0]["agent_id"]
        return RegisterAsAgentResponse(
            message="Application submitted; awaiting admin review.",
            agent_id=agent_id,
            verification_status="pending",
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        message = str(exc).lower()
        if "uq_travel_agent_cnic_number" in message or "cnic_number" in message and "duplicate" in message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This CNIC is already registered to another applicant.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit application: {exc}",
        ) from exc


@router.post("/skip-verification", response_model=SkipVerificationResponse)
def skip_verification(current_user: dict = Depends(get_current_user)):
    """
    Legacy testing endpoint kept disabled for safety.
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Self-service agent verification is disabled. An admin must review and approve agent requests.",
    )


@router.get("/me")
def read_me(current_user=Depends(get_current_user)):
  """
  Return information about the currently authenticated user based on the Supabase JWT.
  """
  supabase = get_supabase_client()
  return {
      **current_user,
      **get_user_role_flags(supabase, current_user["id"]),
  }


class AgentResponse(BaseModel):
    agent_id: int
    name: str
    email: str
    rating: Optional[float] = None
    numberofreviews: Optional[int] = None


class TopAgentsResponse(BaseModel):
    agents: List[AgentResponse]


@router.get("/top-agents", response_model=TopAgentsResponse)
def get_top_agents(limit: int = Query(4, ge=1, le=20, description="Number of agents to return")):
    """
    Get top rated travel agents ordered by rating.
    Returns agents with highest ratings and most reviews.
    This endpoint is public and does not require authentication.
    """
    supabase = get_supabase_client()
    
    try:
        result = supabase.table("travel_agent")\
            .select("agent_id, name, email, rating, numberofreviews")\
            .not_.is_("rating", "null")\
            .order("rating", desc=True)\
            .order("numberofreviews", desc=True)\
            .limit(limit)\
            .execute()
        
        agents = []
        for agent_data in result.data:
            agent = AgentResponse(
                agent_id=agent_data["agent_id"],
                name=agent_data["name"],
                email=agent_data["email"],
                rating=float(agent_data["rating"]) if agent_data.get("rating") is not None else None,
                numberofreviews=agent_data.get("numberofreviews", 0) if agent_data.get("numberofreviews") is not None else 0,
            )
            agents.append(agent)
        
        return TopAgentsResponse(agents=agents)
    
    except Exception as e:
        print(f"Error fetching top agents: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch top agents: {str(e)}",
        )



