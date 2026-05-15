from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.security import _is_ban_active, require_admin_user
from app.services.supabase_client import get_supabase_client


router = APIRouter()

APPROVED_AGENT_STATUSES = ["approved"]

AGENT_DOCUMENTS_BUCKET = "agent-documents"
AGENT_DOCUMENT_SIGNED_URL_TTL_SECONDS = 3600  # 1 hour

# Mapping for traveler ban durations. "permanent" maps to None which the
# handler translates into Postgres 'infinity'::timestamptz.
TRAVELER_BAN_DURATIONS: dict[str, Optional[timedelta]] = {
    "24h":       timedelta(hours=24),
    "7d":        timedelta(days=7),
    "30d":       timedelta(days=30),
    "90d":       timedelta(days=90),
    "permanent": None,
}
PostgresInfinity = "infinity"

# Columns selected for both the directory list and the detail view. Anything
# not listed here is invisible to the admin UI by design.
AGENT_LIST_COLUMNS = (
    "agent_id, user_id, name, business_name, email, phone, cnic_number, "
    "verification_status, created_at, submitted_at, rating, numberofreviews"
)
AGENT_DETAIL_COLUMNS = AGENT_LIST_COLUMNS + ", contact_info, profile_details"


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
    business_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cnic_number: Optional[str] = None
    verification_status: Optional[str] = None
    created_at: Optional[str] = None
    submitted_at: Optional[str] = None
    rating: Optional[float] = None
    numberofreviews: int = 0
    total_trips: int = 0
    banned_until: Optional[str] = None
    ban_reason: Optional[str] = None
    is_banned: bool = False


class AdminAgentDirectoryResponse(BaseModel):
    pending: list[AdminManagedAgent]
    active: list[AdminManagedAgent]


class AdminTraveler(BaseModel):
    user_id: str
    username: Optional[str] = None
    email: Optional[str] = None
    created_at: Optional[str] = None
    banned_until: Optional[str] = None
    ban_reason: Optional[str] = None
    is_banned: bool = False


class AdminTravelersResponse(BaseModel):
    travelers: list[AdminTraveler]
    total: int


class AdminAgentDocuments(BaseModel):
    cnic_front_url: Optional[str] = None
    cnic_back_url: Optional[str] = None
    business_license_url: Optional[str] = None


class AdminAgentDetailResponse(BaseModel):
    agent_id: int
    user_id: str
    name: str
    business_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cnic_number: Optional[str] = None
    verification_status: Optional[str] = None
    created_at: Optional[str] = None
    submitted_at: Optional[str] = None
    rating: Optional[float] = None
    numberofreviews: int = 0
    total_trips: int = 0
    contact_info: Optional[Dict[str, Any]] = None
    profile_details: Optional[Dict[str, Any]] = None
    documents: AdminAgentDocuments
    banned_until: Optional[str] = None
    ban_reason: Optional[str] = None
    is_banned: bool = False


class AgentVerificationDecisionRequest(BaseModel):
    decision: Literal["approved", "rejected"]


class AgentVerificationDecisionResponse(BaseModel):
    message: str
    agent_id: int
    verification_status: str


class TravelerBanRequest(BaseModel):
    duration: Literal["24h", "7d", "30d", "90d", "permanent"]
    reason: str = Field(..., min_length=3, max_length=1000)


class AgentBanRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000)


class BanActionResponse(BaseModel):
    message: str
    user_id: str
    banned_until: Optional[str] = None
    is_banned: bool


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


def _serialize_agents(
    rows: list[dict],
    trip_counts: dict[int, int],
    ban_map: Optional[dict[str, dict]] = None,
) -> list[AdminManagedAgent]:
    serialized: list[AdminManagedAgent] = []
    ban_map = ban_map or {}
    for row in rows:
        rating = row.get("rating")
        ban_info = ban_map.get(row["user_id"]) or {}
        banned_until = ban_info.get("banned_until")
        serialized.append(
            AdminManagedAgent(
                agent_id=row["agent_id"],
                user_id=row["user_id"],
                name=row.get("name") or "Unnamed Agent",
                business_name=row.get("business_name"),
                email=row.get("email"),
                phone=row.get("phone"),
                cnic_number=row.get("cnic_number"),
                verification_status=row.get("verification_status"),
                created_at=row.get("created_at"),
                submitted_at=row.get("submitted_at"),
                rating=float(rating) if rating is not None else None,
                numberofreviews=row.get("numberofreviews") or 0,
                total_trips=trip_counts.get(row["agent_id"], 0),
                banned_until=banned_until,
                ban_reason=ban_info.get("ban_reason"),
                is_banned=_is_ban_active(banned_until),
            )
        )
    return serialized


def _bulk_get_bans(supabase, user_ids: Iterable[str]) -> dict[str, dict]:
    """Return `{user_id: {banned_until, ban_reason}}` for the given users.
    Missing users are simply absent from the dict."""
    ids = [uid for uid in user_ids if uid]
    if not ids:
        return {}
    result = (
        supabase.table("profiles")
        .select("id, banned_until, ban_reason")
        .in_("id", ids)
        .execute()
    )
    return {
        row["id"]: {"banned_until": row.get("banned_until"), "ban_reason": row.get("ban_reason")}
        for row in (result.data or [])
    }


def _bulk_get_auth_users(supabase, user_ids: Iterable[str]) -> dict[str, dict]:
    """Best-effort `{user_id: {email, created_at}}` lookup via the Supabase
    Auth admin API. `profiles` does not store either locally, so we go
    through auth.users.

    Returns `{}` on any failure (e.g. the supabase-py version doesn't
    expose `get_user_by_id`); the admin UI renders "No email" gracefully.
    """
    ids = {uid for uid in user_ids if uid}
    if not ids:
        return {}
    try:
        auth_admin = supabase.auth.admin  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        return {}

    out: dict[str, dict] = {}
    for uid in ids:
        try:
            resp = auth_admin.get_user_by_id(uid)
        except Exception:  # noqa: BLE001
            continue
        user_obj = getattr(resp, "user", None) or (
            resp.get("user") if isinstance(resp, dict) else None
        )
        if not user_obj:
            continue

        def _get(field: str):
            if hasattr(user_obj, field):
                return getattr(user_obj, field)
            if isinstance(user_obj, dict):
                return user_obj.get(field)
            return None

        email = _get("email")
        created_at = _get("created_at")
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        out[uid] = {"email": email, "created_at": created_at}
    return out


def _compute_banned_until(duration: str) -> Optional[str]:
    """Translate a TravelerBanRequest.duration into a value safe for the
    `profiles.banned_until` column. Returns 'infinity' as a string for
    permanent bans (Postgres parses that literal), otherwise an ISO 8601
    timestamp in UTC.
    """
    delta = TRAVELER_BAN_DURATIONS.get(duration)
    if delta is None:
        return PostgresInfinity
    return (datetime.now(timezone.utc) + delta).isoformat()


def _is_admin_user(supabase, user_id: str) -> bool:
    result = (
        supabase.table("user_admin_roles")
        .select("role_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def _try_session_invalidate(supabase, user_id: str) -> None:
    """Best-effort: kill the user's refresh tokens so the next request can
    only be served by an unexpired access token (5-60 min)."""
    try:
        auth_admin = supabase.auth.admin  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        return
    for fn_name in ("sign_out", "signout"):
        fn = getattr(auth_admin, fn_name, None)
        if not callable(fn):
            continue
        try:
            fn(user_id, scope="global")
            return
        except TypeError:
            try:
                fn(user_id)
                return
            except Exception:  # noqa: BLE001
                return
        except Exception:  # noqa: BLE001
            return


def _sign_document_url(supabase, object_path: Optional[str]) -> Optional[str]:
    """Mint a short-lived signed URL for an object in the private
    `agent-documents` bucket. Returns None for missing / invalid paths so the
    frontend can display "No document uploaded"."""
    if not object_path or not isinstance(object_path, str):
        return None
    try:
        response = supabase.storage.from_(AGENT_DOCUMENTS_BUCKET).create_signed_url(
            object_path,
            AGENT_DOCUMENT_SIGNED_URL_TTL_SECONDS,
        )
    except Exception:  # noqa: BLE001
        return None

    if isinstance(response, dict):
        return response.get("signedURL") or response.get("signed_url") or response.get("signedUrl")
    return None


def _build_documents(supabase, profile_details: Optional[Dict[str, Any]]) -> AdminAgentDocuments:
    documents_block: Dict[str, Any] = {}
    if isinstance(profile_details, dict):
        candidate = profile_details.get("documents")
        if isinstance(candidate, dict):
            documents_block = candidate

    return AdminAgentDocuments(
        cnic_front_url=_sign_document_url(supabase, documents_block.get("cnic_front_path")),
        cnic_back_url=_sign_document_url(supabase, documents_block.get("cnic_back_path")),
        business_license_url=_sign_document_url(supabase, documents_block.get("business_license_path")),
    )


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
def get_admin_dashboard(
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
def get_admin_agents(
    _: dict = Depends(require_admin_user),
    supabase=Depends(get_supabase_client),
):
    pending_result = (
        supabase.table("travel_agent")
        .select(AGENT_LIST_COLUMNS)
        .eq("verification_status", "pending")
        .order("submitted_at", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    active_result = (
        supabase.table("travel_agent")
        .select(AGENT_LIST_COLUMNS)
        .in_("verification_status", APPROVED_AGENT_STATUSES)
        .order("created_at", desc=True)
        .execute()
    )

    all_agent_ids = [
        *(row["agent_id"] for row in pending_result.data or []),
        *(row["agent_id"] for row in active_result.data or []),
    ]
    trip_counts = _get_trip_counts_by_agent(supabase, all_agent_ids)
    ban_map = _bulk_get_bans(
        supabase,
        (
            *(row["user_id"] for row in pending_result.data or []),
            *(row["user_id"] for row in active_result.data or []),
        ),
    )

    return AdminAgentDirectoryResponse(
        pending=_serialize_agents(pending_result.data or [], trip_counts, ban_map),
        active=_serialize_agents(active_result.data or [], trip_counts, ban_map),
    )


@router.get("/agents/{agent_id}", response_model=AdminAgentDetailResponse)
def get_admin_agent_detail(
    agent_id: int,
    _: dict = Depends(require_admin_user),
    supabase=Depends(get_supabase_client),
):
    """Return the full applicant view for the admin: typed columns, raw
    jsonb (contact_info, profile_details), trip counts, and short-lived
    signed URLs for each uploaded document. Service-role auth bypasses
    bucket RLS so the admin can read PII docs without being the owner."""
    result = (
        supabase.table("travel_agent")
        .select(AGENT_DETAIL_COLUMNS)
        .eq("agent_id", agent_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Travel agent not found.",
        )

    row = result.data[0]
    trip_counts = _get_trip_counts_by_agent(supabase, [agent_id])
    ban_info = _bulk_get_bans(supabase, [row["user_id"]]).get(row["user_id"], {})
    rating = row.get("rating")
    documents = _build_documents(supabase, row.get("profile_details"))
    banned_until = ban_info.get("banned_until")

    return AdminAgentDetailResponse(
        agent_id=row["agent_id"],
        user_id=row["user_id"],
        name=row.get("name") or "Unnamed Agent",
        business_name=row.get("business_name"),
        email=row.get("email"),
        phone=row.get("phone"),
        cnic_number=row.get("cnic_number"),
        verification_status=row.get("verification_status"),
        created_at=row.get("created_at"),
        submitted_at=row.get("submitted_at"),
        rating=float(rating) if rating is not None else None,
        numberofreviews=row.get("numberofreviews") or 0,
        total_trips=trip_counts.get(agent_id, 0),
        contact_info=row.get("contact_info") if isinstance(row.get("contact_info"), dict) else None,
        profile_details=row.get("profile_details") if isinstance(row.get("profile_details"), dict) else None,
        documents=documents,
        banned_until=banned_until,
        ban_reason=ban_info.get("ban_reason"),
        is_banned=_is_ban_active(banned_until),
    )


@router.patch("/agents/{agent_id}/verification", response_model=AgentVerificationDecisionResponse)
def review_agent_verification(
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


# =============================================================================
# User management — travelers list + traveler bans + agent bans
# =============================================================================


@router.get("/users/travelers", response_model=AdminTravelersResponse)
def get_admin_travelers(
    q: Optional[str] = Query(None, description="Case-insensitive search on username (and email when available)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: dict = Depends(require_admin_user),
    supabase=Depends(get_supabase_client),
):
    """Return all traveler accounts: every `profiles` row except platform admins.

    Approved travel agents are included; the same person can book as a traveler
    and operate as an agent. Agent-specific moderation (CNIC blocklist, etc.)
    remains under Manage Agents; this list is for account-level traveler bans.

    Email is not stored on `profiles`, so we look up emails in batch via the
    Supabase Auth admin API after filtering. Search by `q` matches username
    case-insensitively at the DB layer; email matches are applied client-side
    after the auth lookup (best-effort, since the Auth admin API may be
    unavailable in older supabase-py versions).
    """
    # 1. Exclude only admins — never list admin accounts as "travelers".
    admin_rows = supabase.table("user_admin_roles").select("user_id").execute()
    excluded_ids = {row["user_id"] for row in (admin_rows.data or []) if row.get("user_id")}

    # 2. Build the traveler query with optional username search.
    base_query = supabase.table("profiles").select(
        "id, username, updated_at, banned_until, ban_reason",
        count="exact",
    )
    if q:
        base_query = base_query.ilike("username", f"%{q}%")
    if excluded_ids:
        # PostgREST `not.in.(a,b,c)` — supabase-py exposes this via .not_.in_.
        base_query = base_query.not_.in_("id", list(excluded_ids))
    base_query = base_query.order("updated_at", desc=True).range(offset, offset + limit - 1)
    profile_result = base_query.execute()

    rows: list[dict] = profile_result.data or []
    total = profile_result.count or len(rows)

    # 3. Best-effort lookup of email + join date from auth.users. If
    #    supabase-py can't reach auth.admin, the UI renders "No email" and
    #    falls back to profiles.updated_at for the join date.
    auth_info = _bulk_get_auth_users(supabase, (row["id"] for row in rows))

    # 4. Apply email-side search filter if we have emails and a query.
    if q and auth_info:
        q_lower = q.lower()
        rows = [
            row
            for row in rows
            if (row.get("username") or "").lower().find(q_lower) >= 0
            or (auth_info.get(row["id"], {}).get("email") or "").lower().find(q_lower) >= 0
        ]

    travelers: list[AdminTraveler] = []
    for row in rows:
        banned_until = row.get("banned_until")
        info = auth_info.get(row["id"], {})
        travelers.append(
            AdminTraveler(
                user_id=row["id"],
                username=row.get("username"),
                email=info.get("email"),
                # Prefer the real auth.users join date; fall back to
                # profiles.updated_at when the auth admin call is unavailable.
                created_at=info.get("created_at") or row.get("updated_at"),
                banned_until=banned_until,
                ban_reason=row.get("ban_reason"),
                is_banned=_is_ban_active(banned_until),
            )
        )

    return AdminTravelersResponse(travelers=travelers, total=total)


def _ensure_target_is_not_admin(supabase, user_id: str) -> None:
    if _is_admin_user(supabase, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins cannot be banned through this endpoint. Remove their admin role first.",
        )


def _apply_profile_ban(
    supabase,
    user_id: str,
    banned_until: Optional[str],
    reason: str,
    issued_by: str,
) -> dict:
    now_iso = datetime.now(timezone.utc).isoformat()
    result = (
        supabase.table("profiles")
        .update(
            {
                "banned_until": banned_until,
                "ban_reason": reason,
                "banned_at": now_iso,
                "banned_by": issued_by,
            }
        )
        .eq("id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found for this user.",
        )
    _try_session_invalidate(supabase, user_id)
    return result.data[0]


def _clear_profile_ban(supabase, user_id: str) -> dict:
    result = (
        supabase.table("profiles")
        .update(
            {
                "banned_until": None,
                "ban_reason": None,
                "banned_at": None,
                "banned_by": None,
            }
        )
        .eq("id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found for this user.",
        )
    return result.data[0]


@router.post("/users/{user_id}/ban", response_model=BanActionResponse)
def ban_traveler(
    user_id: str,
    body: TravelerBanRequest,
    admin_user: dict = Depends(require_admin_user),
    supabase=Depends(get_supabase_client),
):
    """Lock a traveler's account for a chosen duration (or permanently).
    Rejected on admin targets so admins can't ban each other from this UI."""
    _ensure_target_is_not_admin(supabase, user_id)

    if admin_user["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot ban your own account.",
        )

    banned_until = _compute_banned_until(body.duration)
    row = _apply_profile_ban(
        supabase,
        user_id=user_id,
        banned_until=banned_until,
        reason=body.reason,
        issued_by=admin_user["id"],
    )
    final_until = row.get("banned_until")
    return BanActionResponse(
        message=(
            "Account banned permanently."
            if body.duration == "permanent"
            else f"Account banned for {body.duration}."
        ),
        user_id=user_id,
        banned_until=final_until,
        is_banned=_is_ban_active(final_until),
    )


@router.post("/users/{user_id}/unban", response_model=BanActionResponse)
def unban_traveler(
    user_id: str,
    _: dict = Depends(require_admin_user),
    supabase=Depends(get_supabase_client),
):
    _clear_profile_ban(supabase, user_id)
    return BanActionResponse(
        message="Account unbanned.",
        user_id=user_id,
        banned_until=None,
        is_banned=False,
    )


@router.post("/agents/{agent_id}/ban", response_model=BanActionResponse)
def ban_agent(
    agent_id: int,
    body: AgentBanRequest,
    admin_user: dict = Depends(require_admin_user),
    supabase=Depends(get_supabase_client),
):
    """Permanently lock the agent's account AND blocklist their CNIC so the
    same CNIC cannot be used to become an agent from any other account.
    Re-registering with a different email is allowed (clean traveler), but
    that new account cannot pass agent verification with the banned CNIC."""
    agent_lookup = (
        supabase.table("travel_agent")
        .select("agent_id, user_id, cnic_number, business_name, name")
        .eq("agent_id", agent_id)
        .limit(1)
        .execute()
    )
    if not agent_lookup.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Travel agent not found.",
        )
    agent_row = agent_lookup.data[0]
    cnic = agent_row.get("cnic_number")
    user_id = agent_row.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Travel agent row is missing user_id; cannot ban.",
        )
    if not cnic:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot ban an agent without a recorded CNIC.",
        )

    _ensure_target_is_not_admin(supabase, user_id)
    if admin_user["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot ban your own account.",
        )

    # 1. Lock the account permanently. profiles.banned_until = 'infinity'.
    _apply_profile_ban(
        supabase,
        user_id=user_id,
        banned_until=PostgresInfinity,
        reason=body.reason,
        issued_by=admin_user["id"],
    )

    # 2. Upsert the CNIC blocklist row. Reuses an existing row (clears any
    #    prior lifted_at) so re-banning works as expected.
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        supabase.table("banned_cnics").upsert(
            {
                "cnic_number": cnic,
                "reason": body.reason,
                "banned_at": now_iso,
                "banned_by": admin_user["id"],
                "lifted_at": None,
                "lifted_by": None,
            },
            on_conflict="cnic_number",
        ).execute()
    except Exception as exc:  # noqa: BLE001
        # Rollback the profile ban so admin sees a clean failure rather
        # than an inconsistent half-ban state.
        _clear_profile_ban(supabase, user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record CNIC ban: {exc}",
        ) from exc

    # 3. Belt-and-braces: drop the agent's verification_status back to
    #    'rejected' so even if the suspension check is bypassed, they
    #    can't reach the agent dashboard or list trips.
    supabase.table("travel_agent").update({"verification_status": "rejected"}).eq(
        "agent_id", agent_id
    ).execute()

    return BanActionResponse(
        message=f"Agent banned and CNIC {cnic} blocklisted from future registration.",
        user_id=user_id,
        banned_until=PostgresInfinity,
        is_banned=True,
    )


@router.post("/agents/{agent_id}/unban", response_model=BanActionResponse)
def unban_agent(
    agent_id: int,
    admin_user: dict = Depends(require_admin_user),
    supabase=Depends(get_supabase_client),
):
    """Reverse both the account lock and the CNIC blocklist. The agent's
    `verification_status` is intentionally NOT restored to 'approved' — the
    admin should re-review them before they can list trips again."""
    agent_lookup = (
        supabase.table("travel_agent")
        .select("agent_id, user_id, cnic_number")
        .eq("agent_id", agent_id)
        .limit(1)
        .execute()
    )
    if not agent_lookup.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Travel agent not found.",
        )
    agent_row = agent_lookup.data[0]
    user_id = agent_row.get("user_id")
    cnic = agent_row.get("cnic_number")

    if user_id:
        _clear_profile_ban(supabase, user_id)

    if cnic:
        now_iso = datetime.now(timezone.utc).isoformat()
        # Keep historical row; just mark it lifted.
        supabase.table("banned_cnics").update(
            {"lifted_at": now_iso, "lifted_by": admin_user["id"]}
        ).eq("cnic_number", cnic).is_("lifted_at", "null").execute()

    return BanActionResponse(
        message="Agent unbanned. Re-review the agent before they can list trips.",
        user_id=user_id or "",
        banned_until=None,
        is_banned=False,
    )

