"""Pydantic schemas for API requests/responses and AI output validation."""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ---------- AI output (strict JSON contract) ----------

class StarStory(BaseModel):
    situation: str = Field(..., min_length=1)
    task: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)
    result: str = Field(..., min_length=1)

    @model_validator(mode="before")
    @classmethod
    def _coerce_star(cls, data):
        # Tolerant read-side coercion: existing rows in DB may have an empty
        # STAR (e.g. AI worker crashed mid-flight). Treat None / whitespace as
        # a placeholder so the admin queue still surfaces these incidents
        # instead of silently dropping them. Strict AI contract still applies
        # when the model *creates* AIProcessingResult from a fresh LLM reply.
        if not isinstance(data, dict):
            return data
        placeholder = "(awaiting AI regeneration)"
        fixed = {}
        for key in ("situation", "task", "action", "result"):
            val = data.get(key)
            if isinstance(val, str):
                stripped = val.strip()
                fixed[key] = stripped if stripped else placeholder
            else:
                fixed[key] = placeholder
        return fixed


class ModerationFlags(BaseModel):
    toxicity: bool = False
    pii_detected: List[str] = Field(default_factory=list)
    off_topic: bool = False
    low_quality: bool = False
    notes: str = ""

    @field_validator("pii_detected")
    @classmethod
    def _lower_pii(cls, v: List[str]) -> List[str]:
        return [s.lower() for s in v]


class AIProcessingResult(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    slug: str = Field(..., min_length=3, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    star: StarStory
    technical_points: List[str] = Field(..., min_length=1)
    summary: str = Field(..., min_length=10, max_length=600)
    moderation_flags: ModerationFlags = Field(default_factory=ModerationFlags)

    @field_validator("title")
    @classmethod
    def _strip_interview_word(cls, v: str) -> str:
        """The title must be interview-framed but never contain the literal word
        'interview' (or 'interview story', 'on-call interview', etc.). Defensive
        cleanup — the prompt instructs the model not to emit these, but if any
        model regresses we strip the offending tokens here instead of failing
        validation and sending the row to the admin failure queue.
        """
        import re
        cleaned = re.sub(
            r"\b(interview[\s-]?(?:ready|story|questions?|prep|answer)?"
            r"|on[\s-]?call[\s-]?interview)\b",
            "",
            v,
            flags=re.IGNORECASE,
        )
        # Collapse leftover whitespace from the removal (e.g. "Diagnosed  and").
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" -:")
        return cleaned or v  # If we accidentally stripped everything, fall back.


# ---------- Public API ----------

class IncidentCreate(BaseModel):
    raw_text: str = Field(..., min_length=20, max_length=20000)
    title: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional user-provided title. Falls back to a derived placeholder.",
    )
    email: EmailStr = Field(
        ...,
        description="Required. Used to notify the submitter when their story is approved or rejected.",
    )


class IncidentSummary(BaseModel):
    id: str
    slug: str
    title: str
    summary: str
    created_at: datetime
    approved_at: Optional[datetime] = None


class IncidentDetail(BaseModel):
    id: str
    slug: str
    title: str
    raw_text: str
    status: Literal["pending", "approved", "rejected", "archived"]
    moderation_flags: ModerationFlags
    moderation_notes: Optional[str] = None
    star: StarStory
    technical_points: List[str]
    summary: str
    thinking_notes: Optional[str] = Field(
        default=None,
        description=(
            "LLM's reasoning trace (qwen3 'thinking' / OpenAI o-series reasoning). "
            "Optional — only present if the provider emitted one for this generation."
        ),
    )
    created_at: datetime
    approved_at: Optional[datetime] = None
    archived_at: Optional[datetime] = Field(
        default=None,
        description="Set when status='archived'. NULL for all other statuses. Sorted by this column in the Archived admin tab.",
    )
    archived_reason: Optional[str] = Field(
        default=None,
        description="Optional free-text reason the admin provided when archiving.",
    )


class IncidentList(BaseModel):
    items: List[IncidentSummary]
    page: int
    page_size: int
    total: int


class SubmitResponse(BaseModel):
    """Returned to the public submitter. Excludes raw_text and admin-only fields."""
    id: str
    status: Literal["pending", "approved", "rejected"]
    title: str
    summary: str
    moderation_flags: ModerationFlags
    message: str = "Your incident has been submitted and is awaiting admin review."


# ---------- Admin API ----------

class AdminRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class AdminRegenerateRequest(BaseModel):
    prompt_override: Optional[str] = Field(
        default=None,
        description="Optional extra instructions appended to the system prompt",
        max_length=1000,
    )
    model: Optional[str] = Field(
        default=None,
        description=(
            "Optional OpenRouter model id to use for this regeneration only "
            "(e.g. 'meta-llama/llama-3.3-70b-instruct:free'). If omitted, the "
            "server's LLM_MODEL env var is used."
        ),
        max_length=200,
    )


class AdminActionResponse(BaseModel):
    id: str
    status: Literal["pending", "approved", "rejected", "archived"]
    moderation_notes: Optional[str] = None


class AdminIncidentList(BaseModel):
    """Admin list returns full detail (raw_text, star, etc.) per row."""
    items: List[IncidentDetail]
    page: int
    page_size: int
    total: int


# ---------- Submitter status lookup ----------

class IncidentStatusResponse(BaseModel):
    """Public, gated by submitter email. Omits raw_text / AI output / moderation_flags."""
    id: str
    status: Literal["pending", "approved", "rejected"]
    title: str
    slug: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None