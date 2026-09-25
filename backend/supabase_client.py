import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError(
        "Set SUPABASE_URL and SUPABASE_ANON_KEY (see backend/.env.example)."
    )

BUCKET = "known-faces"


def anon_client() -> Client:
    """Client scoped to no user — used for public check-in inserts and reads."""
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def client_as(access_token: str | None) -> Client:
    """Client that carries the caller's Supabase session, so RLS runs as them."""
    c = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    if access_token:
        c.postgrest.auth(access_token)
        c.storage._client.headers["Authorization"] = f"Bearer {access_token}"
    return c
