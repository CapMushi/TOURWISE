from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.services.supabase_client import get_supabase_client


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """
    Validate a Supabase JWT from the Authorization header and return basic user info.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user_id = payload.get("sub")
    email = payload.get("email")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return {"id": user_id, "email": email, "claims": payload}


def get_user_role_flags(supabase, user_id: str) -> dict:
    admin_roles = (
        supabase.table("user_admin_roles")
        .select("role_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    is_admin = bool(admin_roles.data)

    agent_result = (
        supabase.table("travel_agent")
        .select("agent_id, verification_status")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    agent_row = agent_result.data[0] if agent_result.data else None

    return {
        "is_admin": is_admin,
        "is_agent": agent_row is not None,
        "agent_id": agent_row.get("agent_id") if agent_row else None,
        "agent_verification_status": agent_row.get("verification_status") if agent_row else None,
        "app_role": "admin" if is_admin else "agent" if agent_row else "traveler",
    }


async def require_admin_user(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    role_flags = get_user_role_flags(supabase, current_user["id"])
    if not role_flags["is_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required for this action.",
        )

    return {**current_user, **role_flags}


