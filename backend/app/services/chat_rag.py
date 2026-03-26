from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from urllib import error, parse, request

from app.core.config import settings

# ---------------------------------------------------------------------------
# Keywords that signal the user is asking about their own personal data.
# When matched, live DB context (bookings, profile) is injected alongside
# the static RAG chunks before sending to Gemini.
# ---------------------------------------------------------------------------
_PERSONAL_KEYWORDS = (
    "my booking",
    "my bookings",
    "my trip",
    "my trips",
    "i booked",
    "i have booked",
    "upcoming trip",
    "upcoming booking",
    "my reservation",
    "my reservations",
    "booked trip",
    "cancel my",
    "cancellation status",
    "refund status",
    "my refund",
    "my profile",
    "my preference",
    "my preferences",
    "my details",
    "my account",
    "past trip",
    "past booking",
    "travel history",
    "my history",
    "how many trips",
    "how many bookings",
    "when is my",
    "where am i going",
    "did i book",
)


def _is_personal_query(message: str) -> bool:
    """Return True if the user is asking about their own data."""
    lower = message.lower()
    return any(kw in lower for kw in _PERSONAL_KEYWORDS)


def _gemini_api_key() -> str:
    key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
    if not key:
        raise RuntimeError("GEMINI_API_KEY/GOOGLE_API_KEY is missing")
    return key


def _embedding_model_name() -> str:
    return getattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")


def _fetch_user_live_context(*, supabase, user_id: str) -> str:
    """
    Fetch live user-specific data from the DB and format it as plain text.
    Called only when _is_personal_query() returns True.
    Returns an empty string if any fetch fails (never raises).
    """
    lines: List[str] = []

    # --- Profile and preferences ---
    try:
        profile_res = (
            supabase.table("profiles")
            .select("username, preferences, profile_details")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if profile_res.data:
            row = profile_res.data[0]
            username = row.get("username") or "not set"
            lines.append(f"User profile: username={username}")
            prefs = row.get("preferences") or {}
            if prefs:
                pref_parts = []
                if prefs.get("trip_style"):
                    pref_parts.append(f"trip_style={prefs['trip_style']}")
                if prefs.get("budget_band"):
                    pref_parts.append(f"budget={prefs['budget_band']}")
                if prefs.get("pace"):
                    pref_parts.append(f"pace={prefs['pace']}")
                if prefs.get("group_type"):
                    pref_parts.append(f"group={prefs['group_type']}")
                if prefs.get("intent_text"):
                    pref_parts.append(f"intent=\"{prefs['intent_text']}\"")
                if pref_parts:
                    lines.append("Travel preferences: " + ", ".join(pref_parts))
    except Exception:
        pass

    # --- Local bookings with trip details ---
    try:
        bookings_res = (
            supabase.table("booking")
            .select("booking_id, trip_id, status, booking_date, number_of_seats, total_price, booking_reference, confirmed_at, cancelled_at")
            .eq("user_id", user_id)
            .order("booking_date", desc=True)
            .limit(10)
            .execute()
        )
        local_bookings = bookings_res.data or []
        if local_bookings:
            lines.append(f"\nLocal bookings ({len(local_bookings)} most recent):")
            for b in local_bookings:
                trip_detail = ""
                try:
                    t_res = (
                        supabase.table("trips")
                        .select("origin_city, destination_city, departure_time")
                        .eq("trip_id", b["trip_id"])
                        .limit(1)
                        .execute()
                    )
                    if t_res.data:
                        t = t_res.data[0]
                        trip_detail = (
                            f" | {t['origin_city']} -> {t['destination_city']}"
                            f" on {t['departure_time']}"
                        )
                except Exception:
                    pass
                lines.append(
                    f"  Ref={b['booking_reference']} status={b['status']}"
                    f" seats={b['number_of_seats']} price=PKR{b['total_price']}"
                    f"{trip_detail}"
                )
        else:
            lines.append("\nNo local bookings found for this user.")
    except Exception:
        pass

    # --- External (partner) bookings ---
    try:
        ext_res = (
            supabase.table("external_bookings")
            .select("external_booking_id, provider_id, status, booking_date, number_of_seats, total_price, booking_reference")
            .eq("user_id", user_id)
            .order("booking_date", desc=True)
            .limit(5)
            .execute()
        )
        ext_bookings = ext_res.data or []
        if ext_bookings:
            lines.append(f"\nPartner/external bookings ({len(ext_bookings)} most recent):")
            for b in ext_bookings:
                lines.append(
                    f"  Ref={b['booking_reference']} provider={b['provider_id']}"
                    f" status={b['status']} seats={b['number_of_seats']}"
                    f" price=PKR{b['total_price']}"
                )
    except Exception:
        pass

    return "\n".join(lines)


def _embed_text(text: str) -> List[float]:
    key = _gemini_api_key()
    model = _embedding_model_name()
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:embedContent?key={parse.quote(key)}"
    )
    payload = {
        "content": {
            "parts": [{"text": text}],
        }
    }
    req = request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=settings.GEMINI_TIMEOUT_SECONDS) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    values = body.get("embedding", {}).get("values") or []
    if not values:
        raise RuntimeError("Embedding response missing values")
    return [float(v) for v in values]


def _split_text(text: str, *, chunk_size: int = 900, overlap: int = 120) -> List[str]:
    clean = " ".join(text.split())
    if not clean:
        return []
    if len(clean) <= chunk_size:
        return [clean]
    out: List[str] = []
    start = 0
    while start < len(clean):
        end = min(start + chunk_size, len(clean))
        out.append(clean[start:end])
        if end >= len(clean):
            break
        start = max(0, end - overlap)
    return out


def _retrieve_context(
    *,
    supabase,
    query_embedding: List[float],
    top_k: int,
    category: Optional[str],
) -> List[Dict[str, Any]]:
    rpc_args: Dict[str, Any] = {
        "query_embedding": query_embedding,
        "match_count": top_k,
    }
    if category:
        rpc_args["category_filter"] = category
    result = supabase.rpc("match_kb_chunks", rpc_args).execute()
    return list(result.data or [])


def _generate_answer(
    *,
    user_message: str,
    contexts: List[Dict[str, Any]],
    live_context: Optional[str] = None,
) -> str:
    key = _gemini_api_key()
    model = settings.GEMINI_MODEL

    # Build RAG knowledge base context block
    context_lines = []
    for idx, item in enumerate(contexts, start=1):
        title = item.get("title") or "Untitled"
        chunk = (item.get("chunk_text") or "").strip()
        context_lines.append(f"[{idx}] {title}\n{chunk}")
    rag_block = "\n\n".join(context_lines) if context_lines else "No knowledge base context found."

    # Build the full context sent to Gemini
    if live_context and live_context.strip():
        full_context = (
            "=== User Personal Data (live from database) ===\n"
            f"{live_context.strip()}\n\n"
            "=== Platform Knowledge Base ===\n"
            f"{rag_block}"
        )
        system_prompt = (
            "You are TourWise Assistant. The context below has two sections: "
            "1) The user's personal live data (bookings, profile, preferences). "
            "2) Platform knowledge base (policies, FAQs, guides). "
            "Answer using both sections as needed. "
            "If you reference booking details, be specific (use reference numbers, statuses, dates). "
            "If context is insufficient, say so and provide best effort guidance. "
            "Keep answers concise and practical."
        )
    else:
        full_context = rag_block
        system_prompt = (
            "You are TourWise Assistant. Answer only from provided context. "
            "If context is insufficient, say you are not fully sure and provide best effort guidance. "
            "Keep answer concise and practical."
        )

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": json.dumps(
                            {
                                "question": user_message,
                                "context": full_context,
                            }
                        )
                    }
                ],
            }
        ],
    }

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={parse.quote(key)}"
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
        raise RuntimeError(f"Gemini generation failed: {exc}") from exc

    text = (
        body.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )
    if not text:
        return "I could not generate a response right now. Please try again."
    return text.strip()


def answer_with_rag(
    *,
    user_message: str,
    supabase,
    top_k: int = 5,
    category: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    # Step 1: embed the query and retrieve static KB chunks
    query_embedding = _embed_text(user_message)
    contexts = _retrieve_context(
        supabase=supabase,
        query_embedding=query_embedding,
        top_k=top_k,
        category=category,
    )

    # Step 2: if this looks like a personal query, fetch live user data from DB
    live_context: Optional[str] = None
    used_live_context = False
    if user_id and _is_personal_query(user_message):
        live_context = _fetch_user_live_context(supabase=supabase, user_id=user_id)
        used_live_context = bool(live_context and live_context.strip())

    # Step 3: generate answer combining both context sources
    answer = _generate_answer(
        user_message=user_message,
        contexts=contexts,
        live_context=live_context,
    )

    sources = [
        {
            "document_id": item.get("document_id"),
            "title": item.get("title"),
            "source_key": item.get("source_key"),
            "similarity": item.get("similarity"),
        }
        for item in contexts
    ]
    return {
        "answer": answer,
        "sources": sources,
        "used_context_count": len(contexts),
        "used_live_context": used_live_context,
    }


def ingest_document(
    *,
    supabase,
    source_key: str,
    title: str,
    content: str,
    category: str = "general",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    doc_payload = {
        "source_key": source_key,
        "title": title,
        "category": category,
        "metadata": metadata or {},
    }
    upsert_res = (
        supabase.table("kb_documents")
        .upsert(doc_payload, on_conflict="source_key")
        .execute()
    )
    if not upsert_res.data:
        raise RuntimeError("Failed to upsert kb_documents row")
    document_id = int(upsert_res.data[0]["document_id"])

    chunks = _split_text(content)
    if not chunks:
        raise RuntimeError("Cannot ingest empty content")

    # Replace old chunks to keep index fresh for this source.
    supabase.table("kb_chunks").delete().eq("document_id", document_id).execute()

    rows: List[Dict[str, Any]] = []
    for idx, chunk in enumerate(chunks):
        embedding = _embed_text(chunk)
        rows.append(
            {
                "document_id": document_id,
                "chunk_text": chunk,
                "chunk_index": idx,
                "metadata": {"source_key": source_key, "chunk_index": idx},
                "embedding": embedding,
            }
        )

    insert_res = supabase.table("kb_chunks").insert(rows).execute()
    inserted = len(insert_res.data or [])
    return {
        "document_id": document_id,
        "source_key": source_key,
        "chunk_count": inserted,
    }
