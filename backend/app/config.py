import os

from dotenv import load_dotenv


load_dotenv()


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL is not configured")


if not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY is not configured")

if SUPABASE_SERVICE_ROLE_KEY.startswith("sb_publishable_"):
    raise ValueError(
        "SUPABASE_SERVICE_ROLE_KEY must be a Supabase secret/service-role key, "
        "not a publishable key"
    )

FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]