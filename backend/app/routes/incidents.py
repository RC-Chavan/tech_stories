"""Public incident endpoints."""
from __future__ import annotations

import asyncio
import logging
import threading
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr

from ..db import Database
from ..deps import get_db, get_llm
from ..llm import LLMClient, LLMError
from ..schemas import (
    IncidentCreate,
    IncidentDetail,
    IncidentList,
    IncidentStatusResponse,
    ModerationFlags,
    SubmitResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/incidents", tags=["incidents"])


# Dedicated thread pool for AI work — keeps each background task on its own
# event loop without conflicting with uvicorn's request loop.
_ai_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ai-worker")


def _run_ai_sync(incident_id: str, raw_text: str, db: Database, llm: LLMClient) -> None:
    """Run the async LLM call on a fresh event loop in a worker thread."""
    logger.info("Background AI processing starting for %s", incident_id)
    try:
        llm_result = asyncio.run(llm.process_incident(raw_text))
        db.update_incident_with_ai(
            incident_id,
            llm_result.result,
            thinking_notes=llm_result.thinking,
        )
        logger.info("Background AI processing succeeded for %s", incident_id)
    except LLMError as e:
        logger.warning("Background AI processing failed for %s: %s", incident_id, e)
        try:
            db.mark_pending_failed(incident_id, str(e))
        except Exception:
            logger.exception("Failed to record failure on %s", incident_id)
    except Exception as e:
        logger.exception("Unexpected background failure for %s", incident_id)
        try:
            db.mark_pending_failed(incident_id, f"unexpected: {e}")
        except Exception:
            logger.exception("Failed to record failure on %s", incident_id)


@router.post(
    "",
    response_model=SubmitResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_incident(
    payload: IncidentCreate,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_db),
    llm: LLMClient = Depends(get_llm),
) -> SubmitResponse:
    """Public endpoint. Saves the raw notes immediately and returns right away;
    the AI STAR/summary is generated in the background and an admin approves.
    """
    user_title = (payload.title or "").strip()
    incident_id = db.create_pending_incident(
        payload.raw_text,
        user_title=user_title,
        submitted_email=str(payload.email),
    )

    # Fire-and-forget onto a dedicated worker thread so the request loop is
    # not blocked and we get a fresh event loop for the LLM call.
    background_tasks.add_task(
        _ai_executor.submit, _run_ai_sync, incident_id, payload.raw_text, db, llm
    )

    display_title = user_title or db._make_placeholder_title(payload.raw_text)
    return SubmitResponse(
        id=incident_id,
        status="pending",
        title=display_title,
        summary="Your incident was saved. The AI is generating the STAR writeup in the background — an admin will review shortly.",
        moderation_flags=ModerationFlags(notes="AI processing in progress."),
        message="Submitted! AI processing is happening in the background. You'll see the polished writeup once an admin approves it.",
    )


@router.get("", response_model=IncidentList)
def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Database = Depends(get_db),
) -> IncidentList:
    return IncidentList(**db.list_approved(page=page, page_size=page_size))


class StatusLookup(BaseModel):
    email: EmailStr


@router.post("/{incident_id}/status", response_model=IncidentStatusResponse)
def get_submitter_status(
    incident_id: str,
    payload: StatusLookup,
    db: Database = Depends(get_db),
) -> IncidentStatusResponse:
    """Public endpoint: the submitter proves ownership with their email.

    Always returns 404 for both unknown id and email mismatch — we don't leak
    which side is wrong. Only a minimal subset of the row is exposed.
    """
    row = db.get_status_for_submitter(incident_id, payload.email)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    return IncidentStatusResponse(
        id=row["id"],
        status=row["status"],
        title=row["title"],
        slug=row.get("slug"),
        created_at=row["created_at"],
        approved_at=row.get("approved_at"),
        rejection_reason=row.get("moderation_notes") if row["status"] == "rejected" else None,
    )


@router.get("/{slug}", response_model=IncidentDetail)
def get_incident(slug: str, db: Database = Depends(get_db)) -> IncidentDetail:
    incident = db.get_approved_by_slug(slug)
    if not incident:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    return incident