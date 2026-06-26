"""Admin-only endpoints. All require a valid Supabase JWT with is_admin=true."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional

from ..db import Database
from ..deps import get_db, get_email, get_llm, require_admin
from ..email import EmailClient
from ..llm import LLMClient, LLMError
from ..schemas import (
    AdminActionResponse,
    AdminIncidentList,
    AdminRejectRequest,
    AdminRegenerateRequest,
    IncidentDetail,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/incidents", tags=["admin"])


@router.get("", response_model=AdminIncidentList)
def admin_list(
    status_filter: str = Query("pending", alias="status", pattern="^(pending|approved|rejected|archived)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Database = Depends(get_db),
    _admin: str = Depends(require_admin),
) -> AdminIncidentList:
    return AdminIncidentList(**db.list_admin(status=status_filter, page=page, page_size=page_size))


@router.post("/{incident_id}/approve", response_model=AdminActionResponse)
def admin_approve(
    incident_id: str,
    db: Database = Depends(get_db),
    email: EmailClient = Depends(get_email),
    _admin: str = Depends(require_admin),
) -> AdminActionResponse:
    if not db.get_by_id_admin(incident_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    db.approve_incident(incident_id)
    # Best-effort notify the submitter. Email failures must not roll back the approval.
    try:
        row = (
            db.client.table("incidents")
            .select("title, slug, submitted_email")
            .eq("id", incident_id)
            .limit(1)
            .execute()
        )
        if row.data:
            r = row.data[0]
            if r.get("submitted_email"):
                email.send_approved(r["submitted_email"], r["title"], r.get("slug", ""))
    except Exception:
        logger.exception("Failed to send approval email for %s", incident_id)
    return AdminActionResponse(id=incident_id, status="approved")


@router.post("/{incident_id}/reject", response_model=AdminActionResponse)
def admin_reject(
    incident_id: str,
    payload: AdminRejectRequest,
    db: Database = Depends(get_db),
    email: EmailClient = Depends(get_email),
    _admin: str = Depends(require_admin),
) -> AdminActionResponse:
    if not db.get_by_id_admin(incident_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    db.reject_incident(incident_id, payload.reason)
    try:
        row = (
            db.client.table("incidents")
            .select("title, submitted_email")
            .eq("id", incident_id)
            .limit(1)
            .execute()
        )
        if row.data:
            r = row.data[0]
            if r.get("submitted_email"):
                email.send_rejected(r["submitted_email"], r["title"], payload.reason)
    except Exception:
        logger.exception("Failed to send rejection email for %s", incident_id)
    return AdminActionResponse(id=incident_id, status="rejected", moderation_notes=payload.reason)


@router.post("/{incident_id}/reopen", response_model=AdminActionResponse)
def admin_reopen(
    incident_id: str,
    db: Database = Depends(get_db),
    _admin: str = Depends(require_admin),
) -> AdminActionResponse:
    """Move a rejected (or approved) incident back to the pending queue. No email."""
    if not db.get_by_id_admin(incident_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    db.reopen_incident(incident_id)
    return AdminActionResponse(id=incident_id, status="pending")


class AdminArchiveRequest(BaseModel):
    reason: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional reason recorded in archived_reason for future reference.",
    )


@router.post("/{incident_id}/archive", response_model=AdminActionResponse)
def admin_archive(
    incident_id: str,
    payload: AdminArchiveRequest,
    db: Database = Depends(get_db),
    _admin: str = Depends(require_admin),
) -> AdminActionResponse:
    """Move any incident (pending, approved, or rejected) to the archived tab.
    Reversible via /unarchive which puts it back into pending."""
    if not db.get_by_id_admin(incident_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    db.archive_incident(incident_id, reason=payload.reason or "")
    return AdminActionResponse(id=incident_id, status="archived")


@router.post("/{incident_id}/unarchive", response_model=AdminActionResponse)
def admin_unarchive(
    incident_id: str,
    db: Database = Depends(get_db),
    _admin: str = Depends(require_admin),
) -> AdminActionResponse:
    """Move an archived incident back to pending. The admin can then approve,
    reject, or regenerate from the pending queue. No email."""
    if not db.get_by_id_admin(incident_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    db.unarchive_incident(incident_id)
    return AdminActionResponse(id=incident_id, status="pending")


@router.post("/{incident_id}/regenerate", response_model=IncidentDetail)
async def admin_regenerate(
    incident_id: str,
    payload: AdminRegenerateRequest,
    db: Database = Depends(get_db),
    llm: LLMClient = Depends(get_llm),
    _admin: str = Depends(require_admin),
) -> IncidentDetail:
    existing = db.get_by_id_admin(incident_id)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    try:
        llm_result = await llm.process_incident(
            existing.raw_text,
            prompt_override=payload.prompt_override,
            model=payload.model,
        )
    except LLMError as e:
        logger.exception("Regenerate failed for %s", incident_id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"LLM error: {e}") from e

    db.regenerate_incident(
        incident_id,
        llm_result.result,
        thinking_notes=llm_result.thinking,
    )
    updated = db.get_by_id_admin(incident_id)
    assert updated is not None
    return updated