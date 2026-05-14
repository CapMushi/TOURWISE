from __future__ import annotations

import json
import logging
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from urllib import error, parse, request

from app.core.config import settings
from app.integrations.catalog import all_external_offers

logger = logging.getLogger(__name__)

# Recommendation calls send large payloads (up to 25 trip objects).
# Use a dedicated timeout that is longer than the shared chat timeout.
_RECOMMENDATION_TIMEOUT: int = max(
    getattr(settings, "GEMINI_RECOMMENDATION_TIMEOUT_SECONDS", 45),
    settings.GEMINI_TIMEOUT_SECONDS,
)

# Cache the system prompt in memory — no need to hit disk on every request.
_SYSTEM_PROMPT_CACHE: Optional[str] = None

# How many candidates to diversify and pass to Gemini
_GEMINI_CANDIDATE_LIMIT = 25
# Maximum trips per destination city in the diversified pool
_MAX_PER_DESTINATION = 5
# How many past bookings to look at for taste inference
_HISTORY_LOOKBACK = 15


def _to_iso(value: Any) -> str:
    if isinstance(value, str):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _load_system_prompt() -> str:
    global _SYSTEM_PROMPT_CACHE
    if _SYSTEM_PROMPT_CACHE is None:
        prompt_path = Path(__file__).parent / "prompts" / "recommendation_system_prompt.txt"
        _SYSTEM_PROMPT_CACHE = prompt_path.read_text(encoding="utf-8")
    return _SYSTEM_PROMPT_CACHE


def _extract_first_json_block(text: str) -> Dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model response")
    return json.loads(text[start : end + 1])


# ---------------------------------------------------------------------------
# Data fetchers
# ---------------------------------------------------------------------------

def _fetch_profile(supabase, user_id: str) -> Dict[str, Any]:
    res = (
        supabase.table("profiles")
        .select("preferences, profile_details")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    return (res.data or [{}])[0]


def _fetch_favorites(supabase, user_id: str) -> Set[int]:
    res = supabase.table("favorites").select("trip_id").eq("user_id", user_id).execute()
    return {int(row["trip_id"]) for row in (res.data or []) if row.get("trip_id") is not None}


def _fetch_booking_history(supabase, user_id: str) -> Dict[str, Any]:
    """
    Fetch the user's last N bookings and extract taste signals.

    Returns a dict with:
      - booked_trip_ids: set[int]  — trips already booked (do not re-recommend)
      - visited_cities: list[str]  — destination cities visited most often
      - visited_provinces: list[str]
      - preferred_transports: list[str] — most-used transport types
      - preferred_suitabilities: list[str] — suitability categories booked most
    """
    try:
        res = (
            supabase.table("booking")
            .select(
                "trip_id, "
                "trips(destination_city, destination_province, transport_type, suitability)"
            )
            .eq("user_id", user_id)
            .order("booking_date", desc=True)
            .limit(_HISTORY_LOOKBACK)
            .execute()
        )
    except Exception as exc:
        logger.warning("Could not fetch booking history: %s", exc)
        return {
            "booked_trip_ids": set(),
            "visited_cities": [],
            "visited_provinces": [],
            "preferred_transports": [],
            "preferred_suitabilities": [],
        }

    booked_trip_ids: Set[int] = set()
    city_counter: Counter = Counter()
    province_counter: Counter = Counter()
    transport_counter: Counter = Counter()
    suitability_counter: Counter = Counter()

    for row in res.data or []:
        raw_trip_id = row.get("trip_id")
        if raw_trip_id is not None:
            try:
                booked_trip_ids.add(int(raw_trip_id))
            except (TypeError, ValueError):
                pass

        trip_info = row.get("trips")
        if isinstance(trip_info, list) and trip_info:
            trip_info = trip_info[0]
        if not isinstance(trip_info, dict):
            continue

        city = (trip_info.get("destination_city") or "").strip().lower()
        province = (trip_info.get("destination_province") or "").strip().lower()
        transport = (trip_info.get("transport_type") or "").strip().lower()
        suitability = (trip_info.get("suitability") or "").strip()

        if city:
            city_counter[city] += 1
        if province:
            province_counter[province] += 1
        if transport:
            transport_counter[transport] += 1
        if suitability:
            suitability_counter[suitability] += 1

    return {
        "booked_trip_ids": booked_trip_ids,
        "visited_cities": [c for c, _ in city_counter.most_common(5)],
        "visited_provinces": [p for p, _ in province_counter.most_common(5)],
        "preferred_transports": [t for t, _ in transport_counter.most_common(3)],
        "preferred_suitabilities": [s for s, _ in suitability_counter.most_common(3)],
    }


def _build_local_candidates(supabase) -> List[Dict[str, Any]]:
    result = (
        supabase.table("trips")
        .select(
            """
            *,
            travel_agent:agent_id (
                name
            )
            """
        )
        .gt("available_seats", 0)
        .order("departure_time", desc=False)
        .execute()
    )
    out: List[Dict[str, Any]] = []
    for row in result.data or []:
        travel_agent = row.get("travel_agent")
        agent_name = None
        if isinstance(travel_agent, list) and travel_agent:
            agent_name = travel_agent[0].get("name")
        elif isinstance(travel_agent, dict):
            agent_name = travel_agent.get("name")

        out.append(
            {
                "trip_id": int(row["trip_id"]),
                "agent_id": int(row.get("agent_id") or 0),
                "origin_city": row.get("origin_city"),
                "destination_province": row.get("destination_province"),
                "destination_city": row.get("destination_city"),
                "departure_time": _to_iso(row.get("departure_time")),
                "arrival_time": _to_iso(row.get("arrival_time")),
                "price": float(row.get("price") or 0),
                "transport_type": row.get("transport_type"),
                "total_seats": int(row.get("total_seats") or 0),
                "available_seats": int(row.get("available_seats") or 0),
                "created_at": _to_iso(row.get("created_at")),
                "agent_name": agent_name,
                "image_url": row.get("image_url"),
                "suitability": row.get("suitability"),
                "image_gallery": [],
                "source": "local",
                "provider_id": None,
                "external_ref": None,
            }
        )
    return out


def _build_external_candidates() -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for offer in all_external_offers():
        if offer.available_seats <= 0:
            continue
        created = offer.created_at or offer.departure_time
        out.append(
            {
                "trip_id": int(offer.trip_id),
                "agent_id": int(offer.agent_id),
                "origin_city": offer.origin_city,
                "destination_province": offer.destination_province,
                "destination_city": offer.destination_city,
                "departure_time": offer.departure_time.isoformat(),
                "arrival_time": offer.arrival_time.isoformat(),
                "price": float(offer.price),
                "transport_type": offer.transport_type,
                "total_seats": int(offer.total_seats),
                "available_seats": int(offer.available_seats),
                "created_at": created.isoformat(),
                "agent_name": offer.agent_name,
                "image_url": offer.image_url,
                "suitability": offer.suitability,
                "image_gallery": list(offer.image_gallery),
                "source": "external",
                "provider_id": offer.provider_id,
                "external_ref": offer.external_ref,
            }
        )
    return out


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _infer_budget_signal(preferences: Dict[str, Any]) -> Optional[str]:
    """
    Derive a budget tier from the preferences dict.
    Looks for keys: budget_tier, budget, trip_style (cheap/luxury).
    Returns 'budget', 'mid-range', 'premium', or None.
    """
    tier = str(preferences.get("budget_tier") or preferences.get("budget") or "").lower()
    if tier in ("budget", "cheap", "low", "economy"):
        return "budget"
    if tier in ("premium", "luxury", "high", "business"):
        return "premium"
    if tier in ("mid", "mid-range", "moderate", "standard"):
        return "mid-range"

    style = str(preferences.get("trip_style") or "").lower()
    if any(w in style for w in ("luxury", "premium", "business")):
        return "premium"
    if any(w in style for w in ("budget", "cheap", "backpack")):
        return "budget"

    return None


def _price_in_budget(price: float, budget_signal: Optional[str], all_prices: List[float]) -> bool:
    """Check whether a price fits the user's budget tier given the current candidate pool."""
    if not all_prices or budget_signal is None:
        return False
    sorted_prices = sorted(all_prices)
    n = len(sorted_prices)
    bottom_third = sorted_prices[n // 3] if n >= 3 else sorted_prices[-1]
    top_third = sorted_prices[int(n * 2 / 3)] if n >= 3 else sorted_prices[-1]

    if budget_signal == "budget":
        return price <= bottom_third
    if budget_signal == "premium":
        return price >= top_third
    if budget_signal == "mid-range":
        return bottom_third <= price <= top_third
    return False


def _candidate_score(
    trip: Dict[str, Any],
    preference_text: str,
    favorite_ids: Set[int],
    preferred_destinations: Set[str],
    prefs_dict: Dict[str, Any],
    history: Dict[str, Any],
    budget_signal: Optional[str],
    all_prices: List[float],
) -> float:
    score = 0.0

    trip_id = trip["trip_id"]
    dest_city = str(trip.get("destination_city") or "").strip().lower()
    dest_province = str(trip.get("destination_province") or "").strip().lower()
    transport = str(trip.get("transport_type") or "").strip().lower()
    suitability = str(trip.get("suitability") or "").strip()
    price = float(trip.get("price") or 0)

    # Hard exclusion: already booked — push to bottom of ranking
    if trip_id in history.get("booked_trip_ids", set()):
        score -= 5.0

    # Favorited
    if trip_id in favorite_ids:
        score += 2.0

    # Explicit destination preference
    if dest_city in preferred_destinations or dest_province in preferred_destinations:
        score += 2.5

    # Transport type matches explicit preference
    pref_transport = str(prefs_dict.get("transport_type") or "").strip().lower()
    if pref_transport and pref_transport == transport:
        score += 1.5

    # Suitability matches explicit preference
    pref_suitability = str(prefs_dict.get("suitability") or prefs_dict.get("trip_style") or "").strip()
    if pref_suitability and pref_suitability.lower() in suitability.lower():
        score += 1.5

    # Price aligns with budget preference
    if _price_in_budget(price, budget_signal, all_prices):
        score += 1.5

    # Inferred taste from booking history — destination
    visited_cities = {c.lower() for c in history.get("visited_cities", [])}
    visited_provinces = {p.lower() for p in history.get("visited_provinces", [])}
    if dest_city in visited_cities or dest_province in visited_provinces:
        score += 1.0

    # Inferred taste from booking history — transport
    hist_transports = {t.lower() for t in history.get("preferred_transports", [])}
    if transport and transport in hist_transports:
        score += 0.8

    # Inferred taste from booking history — suitability
    hist_suitabilities = {s for s in history.get("preferred_suitabilities", [])}
    if suitability and suitability in hist_suitabilities:
        score += 0.6

    # Keyword overlap with full preference text
    trip_text = " ".join([
        str(trip.get("origin_city") or ""),
        dest_city,
        dest_province,
        transport,
        suitability,
    ]).lower()
    if preference_text:
        for token in preference_text.split():
            if len(token) > 3 and token in trip_text:
                score += 0.1

    # Departing soon (within 14 days)
    try:
        dep = datetime.fromisoformat(str(trip.get("departure_time")).replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if dep.tzinfo is None:
            dep = dep.replace(tzinfo=timezone.utc)
        hours_to_departure = (dep - now).total_seconds() / 3600.0
        if 0 < hours_to_departure < 24 * 14:
            score += 1.0
    except Exception:
        pass

    # Slight preference for locally-listed trips
    if str(trip.get("source")) == "local":
        score += 0.2

    return score


# ---------------------------------------------------------------------------
# Diversity
# ---------------------------------------------------------------------------

def _diversify_candidates(
    scored_trips: List[tuple],  # list of (trip_dict, score)
    limit: int = _GEMINI_CANDIDATE_LIMIT,
    max_per_destination: int = _MAX_PER_DESTINATION,
) -> List[Dict[str, Any]]:
    """
    Select up to `limit` candidates from the scored list while enforcing:
    - No more than `max_per_destination` trips share the same destination_city.
    - At least two distinct price tiers if the pool is large enough (budget + premium/mid).

    Algorithm: greedy pass through sorted candidates, track per-city counts.
    If the first pass doesn't fill the limit, a second pass relaxes the constraint.
    """
    dest_counts: Counter = Counter()
    selected: List[Dict[str, Any]] = []
    remainder: List[Dict[str, Any]] = []

    for trip, _score in scored_trips:
        city = str(trip.get("destination_city") or "").strip().lower()
        if dest_counts[city] < max_per_destination:
            selected.append(trip)
            dest_counts[city] += 1
        else:
            remainder.append(trip)
        if len(selected) >= limit:
            break

    # Fill up if diversity constraints left us short
    for trip in remainder:
        if len(selected) >= limit:
            break
        selected.append(trip)

    return selected


# ---------------------------------------------------------------------------
# Gemini call
# ---------------------------------------------------------------------------

def _call_gemini_ranker(
    *,
    user_summary: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    limit: int,
) -> Dict[str, Any]:
    api_key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY/GOOGLE_API_KEY is missing")

    prompt = _load_system_prompt()
    payload = {
        "system_instruction": {"parts": [{"text": prompt}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": json.dumps(
                            {
                                "task": "Rank travel trips for this user",
                                "limit": limit,
                                "user_summary": user_summary,
                                "candidate_trips": candidates,
                            }
                        )
                    }
                ],
            }
        ],
    }

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent?key={parse.quote(api_key)}"
    )
    encoded = json.dumps(payload).encode("utf-8")

    last_exc: Exception = RuntimeError("Unknown error")
    for attempt in range(2):  # try once, retry once on failure
        req = request.Request(
            url=url,
            data=encoded,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=_RECOMMENDATION_TIMEOUT) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            text = (
                body.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            if not text:
                raise RuntimeError("Gemini returned empty content")
            return _extract_first_json_block(text)
        except Exception as exc:
            last_exc = exc
            logger.warning("Gemini ranker attempt %d failed: %s", attempt + 1, exc)

    raise RuntimeError(f"Gemini ranker failed after 2 attempts: {last_exc}") from last_exc


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def get_recommendations_for_user(
    *,
    user_id: str,
    supabase,
    limit: int = 4,
    user_query: Optional[str] = None,
) -> Dict[str, Any]:
    # Run all four independent data fetches in parallel
    with ThreadPoolExecutor(max_workers=4) as pool:
        profile_fut = pool.submit(_fetch_profile, supabase, user_id)
        favorites_fut = pool.submit(_fetch_favorites, supabase, user_id)
        local_fut = pool.submit(_build_local_candidates, supabase)
        history_fut = pool.submit(_fetch_booking_history, supabase, user_id)

        profile = profile_fut.result()
        favorite_ids = favorites_fut.result()
        local = local_fut.result()
        history = history_fut.result()

    preferences: Dict[str, Any] = profile.get("preferences") or {}
    profile_details: Dict[str, Any] = profile.get("profile_details") or {}

    external = _build_external_candidates()
    all_candidates = local + external

    if not all_candidates:
        return {"trips": [], "total": 0, "ai_used": False, "fallback_used": True, "summary": None}

    # Build preference context
    preference_text = json.dumps({"preferences": preferences, "profile_details": profile_details}).lower()

    preferred_destinations: Set[str] = set()
    for key in ("destination_city", "destination_province", "city", "province"):
        val = preferences.get(key) if isinstance(preferences, dict) else None
        if isinstance(val, str) and val.strip():
            preferred_destinations.add(val.strip().lower())

    budget_signal = _infer_budget_signal(preferences)
    all_prices = [float(t.get("price") or 0) for t in all_candidates]

    # Score every candidate
    scored = [
        (
            trip,
            _candidate_score(
                trip,
                preference_text,
                favorite_ids,
                preferred_destinations,
                preferences,
                history,
                budget_signal,
                all_prices,
            ),
        )
        for trip in all_candidates
    ]
    scored.sort(key=lambda x: x[1], reverse=True)

    # Diversify and cap at _GEMINI_CANDIDATE_LIMIT
    pre_ranked = _diversify_candidates(scored, limit=_GEMINI_CANDIDATE_LIMIT)
    ranked_by_id = {trip["trip_id"]: trip for trip in pre_ranked}

    # Build explicit intent
    explicit_intent: Optional[str] = None
    if isinstance(preferences, dict):
        maybe_intent = preferences.get("intent_text")
        if isinstance(maybe_intent, str) and maybe_intent.strip():
            explicit_intent = maybe_intent.strip()
    query_text = (user_query or "").strip() or explicit_intent

    # Build a rich, structured user summary for Gemini
    user_summary = {
        "user_id": user_id,
        "preferences": preferences,
        "profile_details": profile_details,
        "inferred_taste": {
            "visited_cities": history["visited_cities"],
            "visited_provinces": history["visited_provinces"],
            "preferred_transports": history["preferred_transports"],
            "preferred_suitabilities": history["preferred_suitabilities"],
        },
        "favorite_trip_ids": sorted(list(favorite_ids))[:20],
        "already_booked_trip_ids": sorted([int(i) for i in history["booked_trip_ids"]])[:30],
        "budget_signal": budget_signal,
        "user_query": query_text,
    }

    try:
        model_result = _call_gemini_ranker(user_summary=user_summary, candidates=pre_ranked, limit=limit)
        requested_ids = model_result.get("ranked_trip_ids") or []
        reasons = model_result.get("reasons") or {}
        summary = model_result.get("summary")
        valid_ids: List[int] = []
        seen: Set[int] = set()

        for raw_id in requested_ids:
            try:
                trip_id = int(raw_id)
            except Exception:
                continue
            if trip_id in ranked_by_id and trip_id not in seen:
                valid_ids.append(trip_id)
                seen.add(trip_id)
            if len(valid_ids) >= limit:
                break

        if not valid_ids:
            raise RuntimeError("No valid IDs returned by model")

        trips: List[Dict[str, Any]] = []
        for trip_id in valid_ids:
            trip = dict(ranked_by_id[trip_id])
            reason = reasons.get(str(trip_id)) or reasons.get(trip_id)
            if isinstance(reason, str) and reason.strip():
                trip["recommendation_reason"] = reason.strip()[:200]
            trips.append(trip)

        # Pad up to `limit` from heuristic if Gemini returned fewer
        if len(trips) < limit:
            for trip, _ in scored:
                if trip["trip_id"] in seen:
                    continue
                trips.append(trip)
                seen.add(trip["trip_id"])
                if len(trips) >= limit:
                    break

        return {
            "trips": trips[:limit],
            "total": len(trips[:limit]),
            "ai_used": True,
            "fallback_used": False,
            "summary": summary.strip()[:300] if isinstance(summary, str) and summary.strip() else None,
        }
    except Exception as exc:
        logger.exception("Gemini recommendation failed; using fallback. Reason: %s", exc)
        fallback = pre_ranked[:limit]
        return {
            "trips": fallback,
            "total": len(fallback),
            "ai_used": False,
            "fallback_used": True,
            "summary": None,
        }
