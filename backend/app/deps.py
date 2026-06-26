"""FastAPI dependency providers."""
from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, Header, HTTPException, status

from .config import Settings, get_settings
from .db import Database, get_user_by_jwt, is_admin
from .email import EmailClient
from .llm import LLMClient


@lru_cache
def get_db() -> Database:
    return Database(get_settings())


@lru_cache
def get_llm() -> LLMClient:
    return LLMClient(get_settings())


@lru_cache
def get_email() -> EmailClient:
    return EmailClient(get_settings())


async def require_admin(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    db: Database = Depends(get_db),
) -> str:
    """Validate the Supabase Bearer token and ensure the caller has is_admin=true. Returns user id."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    user = get_user_by_jwt(settings.supabase_url, settings.supabase_service_role_key, token)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    if not is_admin(db.client, user["id"]):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user["id"]