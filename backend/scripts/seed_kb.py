"""
seed_kb.py — One-time knowledge base ingestion script for TourWise RAG chatbot.

What this script does:
  - Connects to Supabase using the service role key (reads backend/.env).
  - Calls ingest_document() directly (no HTTP, no JWT needed).
  - For each document: upserts the kb_documents row, splits content into chunks,
    generates Gemini embeddings per chunk, and inserts into kb_chunks.
  - Safe to re-run: upserts are idempotent; old chunks are replaced on each run.

How to run:
  From the TOURWISE root directory:
    python backend/scripts/seed_kb.py

  Or from inside the backend/ directory:
    python scripts/seed_kb.py

Prerequisites:
  - backend/.env must contain GOOGLE_API_KEY (or GEMINI_API_KEY) and SUPABASE_* vars.
  - Supabase DB must have kb_documents and kb_chunks tables created
    (run backend/supabase/chatbot_rag_phase1.sql first).
  - Python path must resolve app/ (handled automatically below via sys.path).
"""

from __future__ import annotations

import sys
import os
import time

# ---------------------------------------------------------------------------
# Path setup — allow imports from backend/app without installing the package.
# Works whether you run the script from TOURWISE root or from backend/.
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))           # backend/scripts/
_BACKEND = os.path.dirname(_HERE)                             # backend/
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# Also ensure the .env inside backend/ is picked up by pydantic-settings.
os.chdir(_BACKEND)

# ---------------------------------------------------------------------------
# Imports (must come after sys.path / chdir setup)
# ---------------------------------------------------------------------------
from app.core.config import settings                          # noqa: E402
from app.services.chat_rag import ingest_document             # noqa: E402
from supabase import create_client                            # noqa: E402


# ---------------------------------------------------------------------------
# Supabase client — use service role key (bypasses RLS; safe for server scripts)
# ---------------------------------------------------------------------------
def _make_supabase_client():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


# ---------------------------------------------------------------------------
# Knowledge base documents
# Each dict maps exactly to ingest_document() parameters.
#
# Guidelines for writing content:
#   - Be factual and specific to TourWise.
#   - Longer content is fine — ingest_document() auto-chunks at ~900 chars.
#   - Avoid repeating the same sentences; varied phrasing improves retrieval.
#   - Use plain text (no markdown symbols like ## or **); these inflate chunk size.
# ---------------------------------------------------------------------------
DOCUMENTS = [
    # -----------------------------------------------------------------------
    # 1. Booking FAQ
    # -----------------------------------------------------------------------
    {
        "source_key": "tw-faq-bookings",
        "title": "TourWise Booking FAQ",
        "category": "faq",
        "metadata": {"version": "v1", "audience": "traveler"},
        "content": (
            "TourWise Booking FAQ\n\n"

            "How do I book a trip? "
            "Visit the Trips page, select any trip, and click Book Trip. "
            "Fill in passenger details and confirm. You will receive a booking confirmation "
            "immediately and a notification in your Notifications tab.\n\n"

            "Can I book multiple passengers? "
            "Yes. During booking you can add one or more passengers. Each passenger requires "
            "a full name and CNIC or passport number.\n\n"

            "What payment methods are accepted? "
            "TourWise currently supports full payment at booking time. "
            "The price shown on the trip card is the total per person. "
            "Payment integration supports PKR transactions.\n\n"

            "How do I check my booking status? "
            "Go to My Bookings from the top navigation. All confirmed, pending, and cancelled "
            "bookings appear there with their status, reference number, and trip details.\n\n"

            "What is a booking reference? "
            "Each booking gets a unique reference number (e.g. TW-20240315-ABCD). "
            "Use this reference when contacting support or the travel agent.\n\n"

            "Can I book the same trip twice? "
            "Yes, but each booking is treated independently with its own reference number "
            "and passenger list.\n\n"

            "What happens if seats run out? "
            "If no seats are available, the Book Trip button is disabled. "
            "You can add the trip to your wishlist and return when seats open up.\n\n"

            "Is there a booking deadline? "
            "Bookings close when available seats reach zero or the trip departure date passes. "
            "Book early to avoid missing out.\n\n"

            "Where do I see booking notifications? "
            "Every booking and cancellation generates a notification visible in the "
            "Notifications section. You can mark notifications as read once reviewed."
        ),
    },

    # -----------------------------------------------------------------------
    # 2. Cancellation and Refund Policy
    # -----------------------------------------------------------------------
    {
        "source_key": "tw-policy-cancellation",
        "title": "Cancellation and Refund Policy",
        "category": "policy",
        "metadata": {"version": "v1", "audience": "traveler"},
        "content": (
            "TourWise Cancellation and Refund Policy\n\n"

            "Can I cancel a booking? "
            "Yes. Go to My Bookings, find the booking you want to cancel, and click Cancel Booking. "
            "Cancellation is allowed up until the trip departure date.\n\n"

            "What happens after I cancel? "
            "Your booking status changes to Cancelled immediately. "
            "A cancellation notification is sent to your Notifications tab. "
            "A refund is initiated for the amount paid.\n\n"

            "How long does a refund take? "
            "Refunds for local TourWise bookings are processed within 5 to 7 business days "
            "back to the original payment source. "
            "For partner or external bookings, refund timelines depend on the travel agent "
            "and may take up to 10 business days.\n\n"

            "Are there cancellation fees? "
            "Cancellations made more than 48 hours before departure incur no fee. "
            "Cancellations within 48 hours of departure may incur a fee of up to 20 percent "
            "of the booking total, at the discretion of the travel agent.\n\n"

            "Can I cancel a partner (external) booking? "
            "Yes. Partner trip bookings appear in My Bookings with a Partner Trip badge. "
            "They can be cancelled the same way as local bookings. "
            "The cancellation is forwarded to the partner travel agent automatically.\n\n"

            "Can I modify a booking instead of cancelling? "
            "Currently TourWise does not support booking modification. "
            "Cancel the existing booking and create a new one with the correct details.\n\n"

            "What if I cancel after departure? "
            "Bookings cannot be cancelled after the trip departure date has passed. "
            "The cancel button will no longer appear for past trips.\n\n"

            "Will I receive a confirmation of my cancellation? "
            "Yes. A cancellation confirmation appears in the Notifications tab "
            "and the booking status in My Bookings updates to Cancelled."
        ),
    },

    # -----------------------------------------------------------------------
    # 3. External Partner Trips FAQ
    # -----------------------------------------------------------------------
    {
        "source_key": "tw-faq-external",
        "title": "External Partner Trips FAQ",
        "category": "faq",
        "metadata": {"version": "v1", "audience": "traveler"},
        "content": (
            "External Partner Trips on TourWise\n\n"

            "What are partner trips? "
            "Partner trips are travel packages offered by third-party travel agents who have "
            "integrated with TourWise. They appear alongside regular TourWise trips in search "
            "results and are marked with a Partner Trip badge in My Bookings.\n\n"

            "How do I identify a partner trip? "
            "On the Trips page, partner trips are included in the listing. "
            "After booking, partner trip entries in My Bookings display a Partner Trip badge "
            "in orange or amber color.\n\n"

            "Are partner trips safe to book? "
            "Yes. All partner travel agents on TourWise are verified integrations. "
            "Their trips follow the same booking and cancellation process as local trips.\n\n"

            "Can I add a partner trip to my wishlist? "
            "Wishlist (favorites) is currently supported for local TourWise trips only. "
            "Partner trips cannot be added to the wishlist at this time.\n\n"

            "Can I cancel a partner trip booking? "
            "Yes. Cancel from My Bookings exactly like a local booking. "
            "TourWise forwards the cancellation to the partner agent automatically.\n\n"

            "What is the refund process for partner trips? "
            "Refunds for partner bookings depend on the individual travel agent policies. "
            "Typical processing time is 5 to 10 business days.\n\n"

            "How are partner trip prices set? "
            "Prices are set by the partner travel agent and are displayed in PKR. "
            "TourWise does not add a markup; the price shown is what the agent charges.\n\n"

            "What information do I need to book a partner trip? "
            "Same as a local booking: passenger name, CNIC or passport number, "
            "and confirmation of payment amount. No extra steps are required.\n\n"

            "Who do I contact if there is a problem with a partner trip? "
            "Contact TourWise support first. For agent-specific issues, TourWise will "
            "escalate to the relevant partner travel agent on your behalf."
        ),
    },

    # -----------------------------------------------------------------------
    # 4. Platform Overview and How to Use
    # -----------------------------------------------------------------------
    {
        "source_key": "tw-guide-platform",
        "title": "TourWise Platform Overview",
        "category": "guide",
        "metadata": {"version": "v1", "audience": "traveler"},
        "content": (
            "TourWise Platform Overview\n\n"

            "What is TourWise? "
            "TourWise is a travel booking platform for Pakistan-based travelers. "
            "It allows users to discover, search, and book domestic trips from local travel "
            "agents as well as verified partner providers.\n\n"

            "Who can use TourWise? "
            "TourWise is designed for individual travelers and families planning domestic trips. "
            "Users must register and log in to book trips or manage bookings.\n\n"

            "How do I register? "
            "Click Sign Up on the login page. Provide your email and a secure password. "
            "After registration you will be taken to your home dashboard.\n\n"

            "What can I do on the home page? "
            "The home page shows AI-powered trip recommendations personalized to your preferences, "
            "plus trending trips. You can search trips by keyword from the search bar at the top.\n\n"

            "How do I search for trips? "
            "Use the search bar on the home page or go to the Trips page. "
            "You can filter by destination, price range, duration, and departure date.\n\n"

            "What is the Wishlist? "
            "The Wishlist (also called Favorites) lets you save trips you are interested in "
            "for later. Access it from the navigation menu. Only local TourWise trips can be "
            "added to the wishlist currently.\n\n"

            "How do AI recommendations work? "
            "TourWise uses your travel preferences saved in your Profile to generate "
            "personalized recommendations using an AI model. "
            "Preferences include trip style, budget, pace, group type, and free-text intent. "
            "Update your preferences in the Profile page to improve recommendations.\n\n"

            "What is the profile page for? "
            "The profile page lets you update your personal information (name, phone, bio) "
            "and travel preferences. Preferences directly influence your AI recommendations.\n\n"

            "What notifications does TourWise send? "
            "You receive in-app notifications for booking confirmations, cancellations, "
            "and upcoming trip reminders. View them in the Notifications tab.\n\n"

            "Is my data secure? "
            "TourWise uses Supabase for secure data storage with row-level security. "
            "Authentication is handled via JWT tokens. Your personal data is never shared "
            "with third parties without consent.\n\n"

            "What browsers and devices are supported? "
            "TourWise is a web application that works on modern browsers including Chrome, "
            "Firefox, Edge, and Safari on both desktop and mobile."
        ),
    },

    # -----------------------------------------------------------------------
    # 5. AI Recommendations and Preferences Guide
    # -----------------------------------------------------------------------
    {
        "source_key": "tw-guide-recommendations",
        "title": "AI Recommendations and Travel Preferences",
        "category": "guide",
        "metadata": {"version": "v1", "audience": "traveler"},
        "content": (
            "AI Recommendations on TourWise\n\n"

            "How are recommendations generated? "
            "TourWise uses Google Gemini AI to rank trips based on your saved preferences. "
            "The AI considers your trip style, budget, pace, group type, season preference, "
            "crowd preference, and free-text intent to pick the best matching trips.\n\n"

            "What preferences can I save? "
            "Go to Profile and scroll to Travel Preferences. You can select:\n"
            "  - Trip style: Adventure, Cultural, Beach, Nature, City, Religious, Family, Luxury\n"
            "  - Budget: Budget, Mid-range, Premium, Luxury\n"
            "  - Pace: Relaxed, Moderate, Fast-paced\n"
            "  - Group type: Solo, Couple, Family, Friends, Group\n"
            "  - Season: Spring, Summer, Autumn, Winter, Anytime\n"
            "  - Crowd preference: Crowded, Moderate, Off the beaten path\n"
            "  - Free text intent: Write what you are looking for in plain language\n\n"

            "What is the free text intent field? "
            "This is a plain language description of your trip goal, for example: "
            "family trip with kids to a cool hill station, not too far, relaxed pace. "
            "The AI reads this field to understand nuanced preferences that strict filters "
            "cannot capture.\n\n"

            "When do recommendations update? "
            "Recommendations refresh each time you load the home page. "
            "To get better recommendations, save updated preferences in your Profile first.\n\n"

            "What if AI recommendations are not showing? "
            "If the AI service is temporarily unavailable, TourWise falls back to "
            "rule-based recommendations using your preferences. "
            "The results may be less personalized but the page will still show trips.\n\n"

            "Can I search with a custom query? "
            "Yes. The recommendations endpoint supports a user query parameter. "
            "In future versions this will be exposed as a search intent field on the home page.\n\n"

            "Why do recommendations sometimes repeat similar trips? "
            "This can happen if your preferences closely match a narrow set of trips. "
            "Try adding more variety to your preference tags or updating your intent text "
            "to include different factors like duration, destination type, or group size."
        ),
    },
]


# ---------------------------------------------------------------------------
# Main ingestion loop
# ---------------------------------------------------------------------------
def main() -> None:
    print("=" * 60)
    print("TourWise Knowledge Base Ingestion Script")
    print("=" * 60)

    # Validate API key presence before starting
    api_key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
    if not api_key:
        print("\n[ERROR] No Gemini API key found.")
        print("  Set GOOGLE_API_KEY or GEMINI_API_KEY in backend/.env and retry.")
        sys.exit(1)

    print(f"\nEmbedding model : {getattr(settings, 'GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001')}")
    print(f"Supabase URL    : {settings.SUPABASE_URL}")
    print(f"Documents to seed: {len(DOCUMENTS)}\n")

    supabase = _make_supabase_client()

    total_chunks = 0
    failed = []

    for i, doc in enumerate(DOCUMENTS, start=1):
        source_key = doc["source_key"]
        title = doc["title"]
        print(f"[{i}/{len(DOCUMENTS)}] Ingesting: {title!r}  (source_key={source_key})")

        try:
            result = ingest_document(
                supabase=supabase,
                source_key=source_key,
                title=title,
                content=doc["content"],
                category=doc.get("category", "general"),
                metadata=doc.get("metadata", {}),
            )
            chunks = result["chunk_count"]
            total_chunks += chunks
            print(f"         OK — document_id={result['document_id']}, chunks inserted={chunks}")

        except Exception as exc:
            print(f"         FAILED — {exc}")
            failed.append(source_key)

        # Small delay between documents to avoid Gemini rate limiting.
        # Each chunk inside ingest_document calls the embedding API once.
        # The delay is placed between documents, not between chunks.
        if i < len(DOCUMENTS):
            time.sleep(1)

    print("\n" + "=" * 60)
    print(f"Ingestion complete.")
    print(f"  Documents attempted : {len(DOCUMENTS)}")
    print(f"  Documents succeeded : {len(DOCUMENTS) - len(failed)}")
    print(f"  Documents failed    : {len(failed)}")
    if failed:
        print(f"  Failed source_keys  : {', '.join(failed)}")
    print(f"  Total chunks stored : {total_chunks}")
    print("=" * 60)

    if failed:
        print("\n[HINT] Re-run the script to retry failed documents.")
        print("       Successful ones will be safely upserted again (no duplicates).")
        sys.exit(1)
    else:
        print("\nAll documents ingested successfully.")
        print("The RAG chatbot can now retrieve context from the knowledge base.")


if __name__ == "__main__":
    main()
