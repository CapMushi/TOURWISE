from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.services.supabase_client import get_supabase_client


bearer_scheme = HTTPBearer(auto_error=False)

# Sentinel that the frontend matches against to auto-sign-out a banned user.
# Must NOT be changed without updating frontend/src/lib/api.ts apiClient.
ACCOUNT_SUSPENDED_DETAIL = "ACCOUNT_SUSPENDED"


def _is_ban_active(banned_until_raw: Optional[str]) -> bool:
    """Return True when `profiles.banned_until` represents a currently-active
    ban. Handles three shapes:

    - `None`             → not banned
    - `'infinity'`       → permanent ban (agent ban; "permanent" traveler option)
    - any ISO timestamp  → banned until that moment; once it's <= now() the ban
                           has lazily expired and the user can request again.
    """
    if not banned_until_raw:
        return False

    if isinstance(banned_until_raw, str) and banned_until_raw.lower() in {"infinity", "+infinity"}:
        return True

    try:
        # Supabase returns timestamps in ISO 8601; allow trailing 'Z'.
        if isinstance(banned_until_raw, str):
            expires_at = datetime.fromisoformat(banned_until_raw.replace("Z", "+00:00"))
        else:
            expires_at = banned_until_raw  # already a datetime
    except (TypeError, ValueError):
        # Garbled value — fail safe: refuse to enforce a ban we can't parse.
        return False

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    return expires_at > datetime.now(timezone.utc)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """
    Validate a Supabase JWT from the Authorization header and return basic user info.

    Also enforces account-level bans: if `profiles.banned_until` is `'infinity'`
    or a future timestamp, returns 403 with detail = `ACCOUNT_SUSPENDED` so the
    frontend can sign the user out. Re-registering with a different email
    creates a fresh `profiles.id` and is intentionally allowed (see
    `.cursor/rules/manage-users-bans-plan.mdc`).
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

    # One extra select per request, served from the partial index
    # idx_profiles_banned_until. Service-role client bypasses RLS.
    try:
        ban_result = (
            get_supabase_client()
            .table("profiles")
            .select("banned_until, ban_reason")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
    except Exception:  # noqa: BLE001
        # If the profiles lookup itself fails, fall through to the normal
        # response — JWT validity is the primary auth signal. A DB outage
        # should NOT lock everyone out.
        ban_result = None

    profile_row = (ban_result.data[0] if ban_result and ban_result.data else None) or {}
    if _is_ban_active(profile_row.get("banned_until")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ACCOUNT_SUSPENDED_DETAIL,
            headers={"X-Account-Suspended": "1"},
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


