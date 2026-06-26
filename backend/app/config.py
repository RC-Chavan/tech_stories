"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_service_role_key: str = Field(..., description="Service role key (server-only)")

    # LLM
    llm_base_url: str = Field(..., description="OpenAI-compatible base URL")
    llm_api_key: str = Field(..., description="API key for the LLM provider")
    llm_model: str = Field(default="minimax-m3", description="Model identifier")

    # CORS — accept a single comma-separated string from env so pydantic-settings
    # doesn't try to JSON-decode it. We split it ourselves in the validator below
    # and expose it as `allowed_origins_list`.
    allowed_origins: str = Field(
        default="http://localhost:3000",
        description="Comma-separated CORS origins",
    )

    # Misc
    log_level: str = "INFO"
    request_timeout_seconds: int = 60

    # Email (Resend). All optional — if RESEND_API_KEY is unset, email notifications
    # are silently skipped and a warning is logged on startup.
    resend_api_key: str = Field(default="", description="Resend API key")
    resend_from_email: str = Field(
        default="",
        description='From address, e.g. "Incident Stories <noreply@yourdomain.com>"',
    )
    public_site_url: str = Field(
        default="http://localhost:3000",
        description="Used to build public story links in notification emails",
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _strip_origins(cls, v):
        if isinstance(v, list):
            return ",".join(str(o) for o in v)
        return v

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]