from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Generator, List, Optional
from urllib import error, parse, request

from app.core.config import settings

# ---------------------------------------------------------------------------
# Keywords that signal the user is asking about their own personal data.
# When matched, live DB context (bookings, profile) is injected alongside
# the static RAG chunks before sending to Gemini.
# ---------------------------------------------------------------------------
_PERSONAL_KEYWORDS = (
    # --- direct ownership ---
    "my booking", "my bookings",
    "my trip", "my trips",
    "my tour", "my tours",
    "my reservation", "my reservations",
    "my refund", "my refunds",
    "my profile", "my account",
    "my preference", "my preferences",
    "my travel preference", "my travel preferences",
    "my travel style", "my travel settings",
    "my details", "my info", "my information",
    "my history", "my travel history",
    "my itinerary", "my itineraries",
    "my schedule", "my schedules",
    "my wishlist", "my favorites", "my favourites", "my saved",
    "my review", "my reviews", "my rating", "my ratings",
    "my notification", "my notifications",
    "my payment", "my payments",
    "my seat", "my seats", "my ticket", "my tickets",
    "my cancelled", "my pending", "my confirmed",
    "my active", "my completed", "my upcoming",
    "my past", "my recent",
    "my agent", "my guide",
    # --- action + ownership phrases ---
    "show me my", "show my",
    "list my", "list all my",
    "give me my", "give me details",
    "tell me my", "tell me about my",
    "check my", "check on my",
    "view my", "view all my",
    "see my", "see all my",
    "find my", "find all my",
    "get my", "get all my",
    "fetch my", "retrieve my",
    "display my", "pull up my",
    "look up my", "look at my",
    "what are my", "what is my",
    "what's my", "whats my",
    "where are my", "where is my",
    "how many of my",
    # --- question starters about self ---
    "do i have", "don't i have",
    "have i booked", "have i made", "have i got",
    "have i any", "have i taken",
    "did i book", "did i make", "did i pay",
    "i booked", "i have booked", "i've booked",
    "i made a booking", "i made a reservation",
    "i want to see my", "i need to see my",
    "i want to know my", "i need to know my",
    "i'd like to see my", "i would like to see my",
    "can you show me my", "can you tell me my",
    "can you check my", "can you find my",
    "can you list my", "can you pull up my",
    # --- status-specific booking queries ---
    "cancelled trip", "cancelled trips",
    "cancelled booking", "cancelled bookings",
    "cancelled reservation", "cancelled reservations",
    "canceled trip", "canceled booking",
    "pending trip", "pending booking",
    "confirmed trip", "confirmed booking",
    "upcoming trip", "upcoming booking",
    "active booking", "active trip",
    "past trip", "past booking",
    "completed trip", "completed booking",
    "recent trip", "recent booking",
    "booked trip", "booked package",
    # --- cancellation / refund ---
    "cancel my", "cancellation status",
    "refund status", "refund for my",
    # --- time / navigation ---
    "when is my", "when are my",
    "where am i going", "where are we going",
    "how many trips", "how many bookings",
    "how many times have i",
    "any bookings", "any trips", "any tours",
    "any upcoming", "any pending", "any confirmed",
    "status of my", "status on my",
    "update on my", "details of my",
    "info on my", "information about my",
    # --- preferences in natural language ---
    "about my travel", "about my preferences",
    "about my profile", "about my account",
    "about my booking", "about my trip",
)


# Words that indicate the user is talking about themselves
_PERSONAL_PRONOUNS = {
    # standard
    "my", "i", "me", "mine", "myself",
    # contractions
    "i've", "i'm", "i'd", "i'll", "i've",
    # informal / typo-tolerant
    "ive", "im", "id",
}

# Data domain words — if a personal pronoun appears alongside any of these,
# it is a personal data query regardless of word order or intervening words.
_PERSONAL_DATA_WORDS = {
    # --- preferences & profile ---
    "preference", "preferences", "preferance", "preferances",  # common typos
    "travel", "style", "budget", "pace", "pace", "group",
    "profile", "account", "details", "info", "information",
    "settings", "setup",
    # --- bookings & reservations ---
    "booking", "bookings", "reservation", "reservations",
    "order", "orders", "purchase", "purchases",
    # --- trips & journeys ---
    "trip", "trips", "journey", "journeys",
    "tour", "tours", "package", "packages",
    "itinerary", "itineraries", "schedule", "schedules",
    "destination", "destinations", "route", "routes",
    # --- status words ---
    "cancelled", "cancellation", "cancel", "canceled",
    "pending", "confirmed", "confirmation",
    "upcoming", "active", "past", "completed", "finished",
    "approved", "rejected", "failed",
    # --- financial ---
    "refund", "refunds", "payment", "payments",
    "price", "cost", "charge", "charges", "invoice",
    # --- history & activity ---
    "history", "records", "data", "activity",
    "booked", "visited", "planned", "registered",
    "bought", "paid",
    # --- agent / platform specific ---
    "agent", "guide", "operator",
    "seat", "seats", "ticket", "tickets",
    "departure", "arrival", "date", "dates",
    "notification", "notifications", "alert", "alerts",
    "wishlist", "favorites", "favourites", "saved",
    "review", "reviews", "rating", "ratings",
}


def _is_personal_query(message: str) -> bool:
    """
    Return True if the user is asking about their own data.
    Uses two strategies:
      1. Fast exact-phrase substring match (original keywords).
      2. Flexible word-presence check — personal pronoun + data-domain word
         anywhere in the sentence, regardless of word order or filler words.
    """
    lower = message.lower()

    # Strategy 1: exact phrase match
    for kw in _PERSONAL_KEYWORDS:
        if kw in lower:
            print(f"[DEBUG] _is_personal_query=True  phrase='{kw}'  msg='{message}'", flush=True)
            return True

    # Strategy 2: word-presence match
    words = set(lower.split())
    pronoun_hit = _PERSONAL_PRONOUNS & words
    data_hit = _PERSONAL_DATA_WORDS & words
    if pronoun_hit and data_hit:
        print(
            f"[DEBUG] _is_personal_query=True  "
            f"pronouns={pronoun_hit}  data_words={data_hit}  msg='{message}'",
            flush=True,
        )
        return True

    print(f"[DEBUG] _is_personal_query=False  no match  msg='{message}'", flush=True)
    return False


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
        print(f"[DEBUG] profiles fetch rows={len(profile_res.data or [])}", flush=True)
        if profile_res.data:
            row = profile_res.data[0]
            username = row.get("username") or "not set"
            lines.append(f"User profile: username={username}")
            prefs = row.get("preferences") or {}
            print(f"[DEBUG] raw preferences value: {prefs!r}", flush=True)
            pref_parts = []
            if prefs.get("trip_style"):
                pref_parts.append(f"  - Trip style: {prefs['trip_style']}")
            if prefs.get("budget_band"):
                pref_parts.append(f"  - Budget range: {prefs['budget_band']}")
            if prefs.get("pace"):
                pref_parts.append(f"  - Travel pace: {prefs['pace']}")
            if prefs.get("group_type"):
                pref_parts.append(f"  - Group type: {prefs['group_type']}")
            if prefs.get("intent_text"):
                pref_parts.append(f"  - What they are looking for: {prefs['intent_text']}")
            if pref_parts:
                lines.append("Travel preferences (saved by the user):\n" + "\n".join(pref_parts))
            else:
                lines.append(
                    "Travel preferences: None saved yet. "
                    "The user has not set any travel preferences on their profile."
                )
    except Exception as _pref_exc:
        print(f"[DEBUG] preferences fetch FAILED: {_pref_exc}", flush=True)

    # --- Local bookings with trip details ---
    try:
        bookings_res = (
            supabase.table("booking")
            .select(
                "booking_id, trip_id, status, booking_date, number_of_seats, "
                "total_price, booking_reference, confirmed_at, cancelled_at"
            )
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
            .select(
                "external_booking_id, provider_id, status, booking_date, "
                "number_of_seats, total_price, booking_reference"
            )
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


# ---------------------------------------------------------------------------
# Prompt payload builder — shared by both sync and streaming generation
# ---------------------------------------------------------------------------

def _build_generation_payload(
    *,
    user_message: str,
    contexts: List[Dict[str, Any]],
    live_context: Optional[str] = None,
) -> Dict[str, Any]:
    context_lines = []
    for idx, item in enumerate(contexts, start=1):
        title = item.get("title") or "Untitled"
        chunk = (item.get("chunk_text") or "").strip()
        context_lines.append(f"[{idx}] {title}\n{chunk}")
    rag_block = "\n\n".join(context_lines) if context_lines else "No knowledge base context found."

    if live_context and live_context.strip():
        full_context = (
            "=== User Personal Data (live from database) ===\n"
            f"{live_context.strip()}\n\n"
            "=== Platform Knowledge Base ===\n"
            f"{rag_block}"
        )
        system_prompt = (
            "You are TourWise Assistant, a friendly in-app travel helper for TourWise users. "
            "The context below has two sections: "
            "1) the user's personal live data fetched directly from the database "
            "(their bookings, travel preferences, username, profile details), and "
            "2) the TourWise platform knowledge base (policies, FAQs, how-to guides). "
            "\n\n"
            "DATA-FIRST RULE — this is the most important instruction: "
            "Whenever the User Personal Data section contains information that answers the user's question, "
            "you MUST read that data and present it directly to the user. "
            "This applies to ALL types of personal data: bookings, travel preferences, profile details, booking statuses, etc. "
            "\n"
            "Specific examples of what you MUST do: "
            "- If the user asks about their travel preferences and the data contains saved preferences, "
            "  read them out clearly (trip style, budget, pace, group type, intent). "
            "  Do NOT explain how to set or update preferences — just show what is already saved. "
            "- If the user asks about their cancelled/upcoming/confirmed bookings and the data contains bookings, "
            "  list them with reference numbers, routes, dates, and statuses. "
            "  Do NOT explain how to cancel or manage bookings — just show what exists. "
            "- If the data says preferences are 'None saved yet', tell the user that clearly "
            "  and briefly mention they can set them from their profile — do not write a long guide. "
            "- If the data shows no bookings of a certain status, say that directly "
            "  instead of explaining the process for that action. "
            "\n\n"
            "PROCEDURE RULE: "
            "Only draw from the knowledge base to explain how to do something "
            "when the user explicitly asks HOW (e.g. 'how do I cancel a booking?') "
            "AND the personal data section does not already contain the answer. "
            "Never replace a data answer with a procedure answer. "
            "\n\n"
            "Write in a warm, polished, conversational tone. "
            "Start with the direct answer first, then add the most useful details. "
            "Use short paragraphs or a brief list when showing multiple items. "
            "Avoid robotic wording and phrases like 'based on the provided context'. "
            "Use natural phrases such as 'Here is what I found', 'Your saved preferences are', "
            "'You currently have', or 'Looking at your account'. "
            "Be specific: use real values from the data (references, statuses, routes, dates, preference values). "
            "If something is genuinely missing from the data, say that plainly and suggest the next step. "
            "Do not invent facts. Keep the answer easy to read. "
            "Never start a response with a greeting or the user's name "
            "(e.g. do not say 'Hello Muiz', 'Hi there', 'Sure!', or any filler opener). "
            "Go straight to the answer."
        )
    else:
        full_context = rag_block
        system_prompt = (
            "You are TourWise Assistant, a friendly in-app travel helper. "
            "Answer only from the provided context. "
            "Write in a warm, natural, polished, user-friendly tone. "
            "Start with the direct answer, then give the most useful next detail. "
            "Use short paragraphs, and use simple bullets only when they improve readability. "
            "Avoid robotic wording, excessive formatting, and phrases like 'based on the provided context'. "
            "Sound helpful and human, not scripted. "
            "If the context is incomplete, say that clearly, avoid guessing, and provide the best next step or guidance. "
            "When useful, end with one short follow-up sentence offering further help. "
            "Keep the answer easy to scan and pleasant to read. "
            "Never start a response with a greeting or the user's name "
            "(e.g. do not say 'Hello', 'Hi there', 'Sure!', or any filler opener). "
            "Go straight to the answer."
        )

    return {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": json.dumps(
                            {"question": user_message, "context": full_context}
                        )
                    }
                ],
            }
        ],
    }


# ---------------------------------------------------------------------------
# Sync generation (used by the original /query endpoint)
# ---------------------------------------------------------------------------

def _generate_answer(
    *,
    user_message: str,
    contexts: List[Dict[str, Any]],
    live_context: Optional[str] = None,
) -> str:
    key = _gemini_api_key()
    model = settings.GEMINI_MODEL
    payload = _build_generation_payload(
        user_message=user_message, contexts=contexts, live_context=live_context
    )
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


# ---------------------------------------------------------------------------
# Streaming generation (used by the new /query/stream endpoint)
# ---------------------------------------------------------------------------

def _generate_answer_stream(
    *,
    user_message: str,
    contexts: List[Dict[str, Any]],
    live_context: Optional[str] = None,
) -> Generator[str, None, None]:
    """Yields raw text chunks from the Gemini streaming (SSE) API."""
    key = _gemini_api_key()
    model = settings.GEMINI_MODEL
    payload = _build_generation_payload(
        user_message=user_message, contexts=contexts, live_context=live_context
    )
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:streamGenerateContent?alt=sse&key={parse.quote(key)}"
    )
    req = request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    # readline() returns as soon as a \n is found — one SSE line at a time,
    # avoiding the buffering that read(N) causes with small Gemini chunks.
    with request.urlopen(req) as resp:
        while True:
            raw_line = resp.readline()
            if not raw_line:
                break
            line = raw_line.decode("utf-8").rstrip()
            if not line.startswith("data: "):
                continue
            payload_str = line[6:].strip()
            if payload_str == "[DONE]":
                return
            try:
                chunk_data = json.loads(payload_str)
                text = (
                    chunk_data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                if text:
                    yield text
            except Exception:
                continue


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _parallel_retrieve(
    *,
    supabase,
    query_embedding: List[float],
    top_k: int,
    category: Optional[str],
    user_id: Optional[str],
    is_personal: bool,
):
    """
    Runs KB retrieval and (when personal) live DB fetch in parallel threads.
    Returns (contexts, live_context, used_live_context).
    """
    if is_personal and user_id:
        with ThreadPoolExecutor(max_workers=2) as pool:
            kb_fut = pool.submit(
                _retrieve_context,
                supabase=supabase,
                query_embedding=query_embedding,
                top_k=top_k,
                category=category,
            )
            live_fut = pool.submit(
                _fetch_user_live_context,
                supabase=supabase,
                user_id=user_id,
            )
            contexts = kb_fut.result()
            live_context: Optional[str] = live_fut.result()
    else:
        contexts = _retrieve_context(
            supabase=supabase,
            query_embedding=query_embedding,
            top_k=top_k,
            category=category,
        )
        live_context = None

    used_live = bool(live_context and live_context.strip())
    return contexts, live_context, used_live


def answer_with_rag(
    *,
    user_message: str,
    supabase,
    top_k: int = 5,
    category: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    # Step 1: embed
    query_embedding = _embed_text(user_message)

    # Step 2: parallel retrieval
    is_personal = bool(user_id and _is_personal_query(user_message))
    contexts, live_context, used_live_context = _parallel_retrieve(
        supabase=supabase,
        query_embedding=query_embedding,
        top_k=top_k,
        category=category,
        user_id=user_id,
        is_personal=is_personal,
    )

    # Step 3: generate answer
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


def stream_answer_with_rag(
    *,
    user_message: str,
    supabase,
    top_k: int = 5,
    category: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Generator[Dict[str, Any], None, None]:
    """
    Yields SSE-ready dicts:
      {"text": "chunk"}   — one per streamed Gemini token group
      {"done": True, "sources": [...], "used_context_count": N, "used_live_context": bool}
    """
    # Step 1: embed
    query_embedding = _embed_text(user_message)

    # Step 2: parallel retrieval
    is_personal = bool(user_id and _is_personal_query(user_message))
    print(f"[DEBUG] stream_answer_with_rag: is_personal={is_personal}  user_id={user_id!r}", flush=True)
    contexts, live_context, used_live_context = _parallel_retrieve(
        supabase=supabase,
        query_embedding=query_embedding,
        top_k=top_k,
        category=category,
        user_id=user_id,
        is_personal=is_personal,
    )
    print(f"[DEBUG] used_live_context={used_live_context}  live_context preview: {repr(live_context[:300]) if live_context else None}", flush=True)

    sources = [
        {
            "document_id": item.get("document_id"),
            "title": item.get("title"),
            "source_key": item.get("source_key"),
            "similarity": item.get("similarity"),
        }
        for item in contexts
    ]

    # Step 3: stream generation
    for text_chunk in _generate_answer_stream(
        user_message=user_message,
        contexts=contexts,
        live_context=live_context,
    ):
        yield {"text": text_chunk}

    yield {
        "done": True,
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
