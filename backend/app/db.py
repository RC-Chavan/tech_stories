"""Supabase data-access layer. Uses the service-role key on the server only."""
from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from supabase import Client, create_client

from .config import Settings
from .schemas import (
    AIProcessingResult,
    IncidentDetail,
    IncidentSummary,
    ModerationFlags,
    StarStory,
)

logger = logging.getLogger(__name__)


class Database:
    def __init__(self, settings: Settings):
        self.client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    # ---------- writes ----------

    def create_incident(self, raw_text: str, ai: AIProcessingResult, thinking_notes: Optional[str] = None) -> str:
        """Insert incident + first version. Returns the new incident id."""
        insert_payload = {
            "slug": ai.slug,
            "title": ai.title,
            "raw_text": raw_text,
            "status": "pending",
            "moderation_flags": ai.moderation_flags.model_dump(),
        }
        resp = self.client.table("incidents").insert(insert_payload).execute()
        if not resp.data:
            raise RuntimeError("Failed to insert incident")
        incident_id = resp.data[0]["id"]

        self._insert_version(incident_id, ai, thinking_notes=thinking_notes)
        return incident_id

    def create_pending_incident(
        self,
        raw_text: str,
        user_title: str = "",
        submitted_email: str = "",
    ) -> str:
        """Insert a placeholder incident immediately (no LLM yet).

        Returns the new incident id. If the user supplied a title, use it;
        otherwise derive a placeholder from the raw text. The AI will fill in
        the real values via ``update_incident_with_ai``.
        """
        user_title = (user_title or "").strip()
        title = user_title if user_title else self._make_placeholder_title(raw_text)
        slug = (
            self._slugify(user_title)
            if user_title
            else self._make_placeholder_slug(raw_text)
        )
        insert_payload = {
            "slug": slug,
            "title": title,
            "raw_text": raw_text,
            "status": "pending",
            "submitted_email": (submitted_email or "").strip().lower(),
            "moderation_flags": {"notes": "AI processing in progress."},
        }
        resp = self.client.table("incidents").insert(insert_payload).execute()
        if not resp.data:
            raise RuntimeError("Failed to insert pending incident")
        return resp.data[0]["id"]

    @staticmethod
    def _slugify(text: str) -> str:
        text = re.sub(r"[^a-zA-Z0-9\s-]", "", text.lower()).strip()
        text = re.sub(r"[\s_-]+", "-", text).strip("-")
        return text[:80] or "incident"

    def update_incident_with_ai(
        self, incident_id: str, ai: AIProcessingResult, thinking_notes: Optional[str] = None
    ) -> None:
        """Fill in AI-generated title/slug/flags and append the first version row."""
        self.client.table("incidents").update(
            {
                "title": ai.title,
                "slug": ai.slug,
                "moderation_flags": ai.moderation_flags.model_dump(),
            }
        ).eq("id", incident_id).execute()
        self._insert_version(incident_id, ai, thinking_notes=thinking_notes)

    def mark_pending_failed(self, incident_id: str, error: str) -> None:
        """Record that the background LLM call failed. Keep the row pending for admin review."""
        self.client.table("incidents").update(
            {
                "title": "(AI processing failed)",
                "moderation_flags": {
                    "notes": f"AI processing failed: {error}. Admin review required.",
                },
            }
        ).eq("id", incident_id).execute()

    @staticmethod
    def _make_placeholder_slug(raw_text: str) -> str:
        """Derive a unique-looking slug from the first words of the raw text + a short hash."""
        text = re.sub(r"\s+", " ", raw_text or "").strip().lower()
        words = re.findall(r"[a-z0-9]+", text)[:6]
        base = "-".join(words) or "pending-incident"
        digest = hashlib.sha1(raw_text.encode("utf-8")).hexdigest()[:8]
        return f"{base}-{digest}"

    @staticmethod
    def _make_placeholder_title(raw_text: str) -> str:
        """Use the first ~80 chars of the raw text as a placeholder title."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return "(untitled incident)"
        if len(text) <= 80:
            return text
        return text[:77].rstrip() + "..."

    def _insert_version(self, incident_id: str, ai: AIProcessingResult, thinking_notes: Optional[str] = None) -> None:
        row: Dict[str, Any] = {
            "incident_id": incident_id,
            "star": ai.star.model_dump(),
            "technical_points": ai.technical_points,
            "summary": ai.summary,
        }
        if thinking_notes:
            row["thinking_notes"] = thinking_notes
        self.client.table("incident_versions").insert(row).execute()

    def regenerate_incident(self, incident_id: str, ai: AIProcessingResult, thinking_notes: Optional[str] = None) -> None:
        """Update incident title/slug/flags and add a new version row."""
        self.client.table("incidents").update(
            {
                "title": ai.title,
                "slug": ai.slug,
                "moderation_flags": ai.moderation_flags.model_dump(),
            }
        ).eq("id", incident_id).execute()
        self._insert_version(incident_id, ai, thinking_notes=thinking_notes)

    def approve_incident(self, incident_id: str) -> None:
        self.client.table("incidents").update(
            {
                "status": "approved",
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "moderation_notes": None,
            }
        ).eq("id", incident_id).execute()

    def reject_incident(self, incident_id: str, reason: str) -> None:
        self.client.table("incidents").update(
            {"status": "rejected", "moderation_notes": reason}
        ).eq("id", incident_id).execute()

    def reopen_incident(self, incident_id: str) -> None:
        """Move a rejected (or already-approved) incident back to pending and clear rejection notes."""
        self.client.table("incidents").update(
            {"status": "pending", "moderation_notes": None}
        ).eq("id", incident_id).execute()

    def archive_incident(self, incident_id: str, reason: str = "") -> None:
        """Move any incident to the archived tab. Sets archived_at; preserves
        approved_at so the original approval history is not lost. Does NOT
        delete the row or its incident_versions — archive is reversible via
        unarchive_incident (which moves the row back to pending)."""
        self.client.table("incidents").update(
            {
                "status": "archived",
                "archived_at": datetime.now(timezone.utc).isoformat(),
                "archived_reason": reason or None,
            }
        ).eq("id", incident_id).execute()

    def unarchive_incident(self, incident_id: str) -> None:
        """Move an archived incident back to pending. Clears archived_at and
        archived_reason. The admin can then approve, reject, or regenerate it
        from the pending queue."""
        self.client.table("incidents").update(
            {
                "status": "pending",
                "archived_at": None,
                "archived_reason": None,
            }
        ).eq("id", incident_id).execute()

    # ---------- reads ----------

    def list_approved(self, page: int, page_size: int) -> Dict[str, Any]:
        start = (page - 1) * page_size
        end = start + page_size - 1
        resp = (
            self.client.table("incidents")
            .select("id, slug, title, created_at, approved_at", count="exact")
            .eq("status", "approved")
            .order("approved_at", desc=True)
            .range(start, end)
            .execute()
        )
        # The select above won't actually return summary directly because it's on incident_versions.
        # Fetch the latest version summary per incident in a second query for simplicity (v1).
        items = self._hydrate_summaries(resp.data or [])
        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": resp.count or 0,
        }

    def get_approved_by_slug(self, slug: str) -> Optional[IncidentDetail]:
        resp = (
            self.client.table("incidents")
            .select("*")
            .eq("slug", slug)
            .eq("status", "approved")
            .limit(1)
            .execute()
        )
        if not resp.data:
            return None
        return self._hydrate_detail(resp.data[0])

    def get_by_id_admin(self, incident_id: str) -> Optional[IncidentDetail]:
        resp = (
            self.client.table("incidents")
            .select("*")
            .eq("id", incident_id)
            .limit(1)
            .execute()
        )
        if not resp.data:
            return None
        return self._hydrate_detail(resp.data[0])

    def list_admin(self, status: str = "pending", page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        start = (page - 1) * page_size
        end = start + page_size - 1
        # Archived tab sorts by archived_at desc (most recently archived first);
        # all other tabs sort by created_at desc. The frontend expects
        # most-recent-first for every tab.
        order_col = "archived_at" if status == "archived" else "created_at"
        resp = (
            self.client.table("incidents")
            .select("*", count="exact")
            .eq("status", status)
            .order(order_col, desc=True)
            .range(start, end)
            .execute()
        )
        items: List[IncidentDetail] = []
        for row in resp.data or []:
            try:
                items.append(self._hydrate_detail(row))
            except Exception:
                # Don't break the whole queue on one bad row, but DO log so
                # we can see why rows are silently dropping out of the admin queue.
                logger.exception("Failed to hydrate incident %s", row.get("id"))
                continue
        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": resp.count or 0,
        }

    # ---------- version hydration ----------

    def _latest_version(self, incident_id: str) -> Dict[str, Any] | None:
        resp = (
            self.client.table("incident_versions")
            .select("star, technical_points, summary, thinking_notes, created_at")
            .eq("incident_id", incident_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    def _hydrate_summaries(self, rows: List[Dict[str, Any]]) -> List[IncidentSummary]:
        out: List[IncidentSummary] = []
        for row in rows:
            v = self._latest_version(row["id"])
            if not v:
                continue
            out.append(
                IncidentSummary(
                    id=row["id"],
                    slug=row["slug"],
                    title=row["title"],
                    summary=v["summary"],
                    created_at=row["created_at"],
                    approved_at=row.get("approved_at"),
                )
            )
        return out

    def _hydrate_detail(self, row: Dict[str, Any]) -> IncidentDetail:
        v = self._latest_version(row["id"])
        if not v:
            # Should not happen for valid rows; degrade gracefully.
            empty_star = {"situation": "", "task": "", "action": "", "result": ""}
            v = {"star": empty_star, "technical_points": [], "summary": "", "thinking_notes": None}
        return IncidentDetail(
            id=row["id"],
            slug=row["slug"],
            title=row["title"],
            raw_text=row.get("raw_text", ""),
            status=row["status"],
            moderation_flags=ModerationFlags.model_validate(row.get("moderation_flags") or {}),
            moderation_notes=row.get("moderation_notes"),
            star=StarStory.model_validate(v["star"]),
            technical_points=v["technical_points"],
            summary=v["summary"],
            thinking_notes=v.get("thinking_notes"),
            created_at=row["created_at"],
            approved_at=row.get("approved_at"),
            archived_at=row.get("archived_at"),
            archived_reason=row.get("archived_reason"),
        )

    def get_status_for_submitter(
        self, incident_id: str, email: str
    ) -> Optional[Dict[str, Any]]:
        """Return a minimal status dict ONLY if the email matches submitted_email.

        Used by the public /status endpoint. Returns None when the id is unknown
        or the email doesn't match (we deliberately don't distinguish — same 404).
        """
        email_norm = (email or "").strip().lower()
        if not email_norm:
            return None
        resp = (
            self.client.table("incidents")
            .select("id, slug, title, status, moderation_notes, created_at, approved_at, submitted_email")
            .eq("id", incident_id)
            .limit(1)
            .execute()
        )
        if not resp.data:
            return None
        row = resp.data[0]
        if (row.get("submitted_email") or "").strip().lower() != email_norm:
            return None
        return {
            "id": row["id"],
            "slug": row.get("slug"),
            "title": row["title"],
            "status": row["status"],
            "moderation_notes": row.get("moderation_notes"),
            "created_at": row["created_at"],
            "approved_at": row.get("approved_at"),
        }


def get_user_by_jwt(supabase_url: str, supabase_anon_key: str, access_token: str) -> Optional[Dict[str, Any]]:
    """Resolve a Supabase access token to a user dict using the anon client. None if invalid."""
    anon = create_client(supabase_url, supabase_anon_key)
    try:
        resp = anon.auth.get_user(access_token)
        return resp.user.model_dump() if resp and resp.user else None
    except Exception:
        return None


def is_admin(supabase_service: Client, user_id: str) -> bool:
    """Check the profiles.is_admin flag for a user. Uses the service-role client."""
    try:
        uid = UUID(user_id)
    except ValueError:
        return False
    resp = (
        supabase_service.table("profiles")
        .select("is_admin")
        .eq("id", str(uid))
        .limit(1)
        .execute()
    )
    if not resp.data:
        return False
    return bool(resp.data[0].get("is_admin"))