from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import List, Optional

from app.core.security import get_current_user, get_user_role_flags
from app.services.supabase_client import get_supabase_client


router = APIRouter()


class SkipVerificationResponse(BaseModel):
    message: str
    agent_id: int


class RegisterAsAgentResponse(BaseModel):
    message: str
    agent_id: int


@router.post("/register-as-agent", response_model=RegisterAsAgentResponse)
async def register_as_agent(current_user: dict = Depends(get_current_user)):
    """
    Register the current user as a travel agent.
    Creates travel_agent record with pending verification status.
    If user is already registered, returns existing agent_id.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]
    email = current_user.get("email", "")
    
    # Extract username from email (part before @)
    username = email.split("@")[0] if email else "agent"
    
    # Check if user is already registered as an agent
    existing_agent = supabase.table("travel_agent").select("agent_id").eq("user_id", user_id).execute()
    
    if existing_agent.data:
        # Already registered - return existing agent_id
        agent_id = existing_agent.data[0]["agent_id"]
        return RegisterAsAgentResponse(
            message="Already registered as travel agent",
            agent_id=agent_id
        )
    
    # Create new travel_agent record with pending status
    new_agent = supabase.table("travel_agent").insert({
        "user_id": user_id,
        "name": username,
        "email": email,
        "verification_status": "pending",
        "contact_info": None,
        "profile_details": None
    }).execute()
    
    if not new_agent.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create travel agent record"
        )
    
    agent_id = new_agent.data[0]["agent_id"]
    return RegisterAsAgentResponse(
        message="Successfully registered as travel agent",
        agent_id=agent_id
    )


@router.post("/skip-verification", response_model=SkipVerificationResponse)
async def skip_verification(current_user: dict = Depends(get_current_user)):
    """
    Legacy testing endpoint kept disabled for safety.
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Self-service agent verification is disabled. An admin must review and approve agent requests.",
    )


@router.get("/me")
async def read_me(current_user=Depends(get_current_user)):
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
async def get_top_agents(limit: int = Query(4, ge=1, le=20, description="Number of agents to return")):
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


