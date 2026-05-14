from supabase import create_client, Client
from app.core.config import settings

# Module-level singletons — created once at startup, reused for every request.
# Avoids the overhead of re-initialising the HTTP session and auth headers on
# each incoming request.
_supabase_client: Client | None = None
_supabase_anon_client: Client | None = None


def get_supabase_client() -> Client:
    """Return the shared service-role Supabase client (created once)."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _supabase_client


def get_supabase_anon_client() -> Client:
    """Return the shared anon Supabase client (created once)."""
    global _supabase_anon_client
    if _supabase_anon_client is None:
        _supabase_anon_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY,
        )
    return _supabase_anon_client

