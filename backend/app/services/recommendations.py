from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib import error, parse, request

from app.core.config import settings
from app.integrations.catalog import all_external_offers

logger = logging.getLogger(__name__)


def _to_iso(value: Any) -> str:
    if isinstance(value, str):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _load_system_prompt() -> str:
    prompt_path = Path(__file__).parent / "prompts" / "recommendation_system_prompt.txt"
    return prompt_path.read_text(encoding="utf-8")


def _extract_first_json_block(text: str) -> Dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model response")
    return json.loads(text[start : end + 1])


def _candidate_score(
    trip: Dict[str, Any],
    preference_text: str,
    favorite_ids: set[int],
    preferred_destinations: set[str],
) -> float:
    score = 0.0
    trip_text = " ".join(
        [
            str(trip.get("origin_city", "")),
            str(trip.get("destination_city", "")),
            str(trip.get("destination_province", "")),
            str(trip.get("transport_type", "")),
            str(trip.get("suitability", "")),
        ]
    ).lower()

    if trip["trip_id"] in favorite_ids:
        score += 1.5

    if preference_text:
        for token in preference_text.split():
            if len(token) > 3 and token in trip_text:
                score += 0.15

    destination_city = str(trip.get("destination_city", "")).lower()
    destination_province = str(trip.get("destination_province", "")).lower()
    if destination_city in preferred_destinations or destination_province in preferred_destinations:
        score += 2.0

    if str(trip.get("source")) == "local":
        score += 0.2

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

    return score


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
    req = request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=settings.GEMINI_TIMEOUT_SECONDS) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except error.URLError as exc:
        raise RuntimeError(f"Gemini call failed: {exc}") from exc

    text = (
        body.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )
    if not text:
        raise RuntimeError("Gemini returned empty content")
    return _extract_first_json_block(text)


def get_recommendations_for_user(
    *,
    user_id: str,
    supabase,
    limit: int = 4,
    user_query: Optional[str] = None,
) -> Dict[str, Any]:
    profile_res = (
        supabase.table("profiles")
        .select("preferences, profile_details")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile = (profile_res.data or [{}])[0]
    preferences = profile.get("preferences") or {}
    profile_details = profile.get("profile_details") or {}

    favorite_res = supabase.table("favorites").select("trip_id").eq("user_id", user_id).execute()
    favorite_ids = {int(row["trip_id"]) for row in (favorite_res.data or []) if row.get("trip_id") is not None}

    local = _build_local_candidates(supabase)
    external = _build_external_candidates()
    all_candidates = local + external

    if not all_candidates:
        return {"trips": [], "total": 0, "ai_used": False, "fallback_used": True, "summary": None}

    preference_text = json.dumps({"preferences": preferences, "profile_details": profile_details}).lower()
    preferred_destinations = set()
    for key in ("destination_city", "destination_province", "city", "province"):
        val = preferences.get(key) if isinstance(preferences, dict) else None
        if isinstance(val, str) and val.strip():
            preferred_destinations.add(val.strip().lower())

    scored = [
        (trip, _candidate_score(trip, preference_text, favorite_ids, preferred_destinations))
        for trip in all_candidates
    ]
    scored.sort(
        key=lambda x: (
            x[1],
            -float(x[0].get("price") or 0),
        ),
        reverse=True,
    )
    pre_ranked = [trip for trip, _ in scored[:30]]
    ranked_by_id = {trip["trip_id"]: trip for trip in pre_ranked}

    explicit_intent = None
    if isinstance(preferences, dict):
        maybe_intent = preferences.get("intent_text")
        if isinstance(maybe_intent, str) and maybe_intent.strip():
            explicit_intent = maybe_intent.strip()
    query_text = (user_query or "").strip() or explicit_intent

    user_summary = {
        "user_id": user_id,
        "preferences": preferences,
        "profile_details": profile_details,
        "favorite_trip_ids": sorted(list(favorite_ids))[:20],
        "user_query": query_text,
    }

    try:
        model_result = _call_gemini_ranker(user_summary=user_summary, candidates=pre_ranked, limit=limit)
        requested_ids = model_result.get("ranked_trip_ids") or []
        reasons = model_result.get("reasons") or {}
        summary = model_result.get("summary")
        valid_ids: List[int] = []
        seen: set[int] = set()
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
                trip["recommendation_reason"] = reason.strip()[:120]
            trips.append(trip)

        if len(trips) < limit:
            for trip in pre_ranked:
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
            "summary": summary.strip()[:220] if isinstance(summary, str) and summary.strip() else None,
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
