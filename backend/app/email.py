"""Resend email client.

Lazy-initialized: if RESEND_API_KEY is empty, every send is a logged no-op so
local dev without Resend still works. Failures never propagate — emails are
fire-and-forget by design (a missing notification must not roll back approval).
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from .config import Settings

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"


class EmailClient:
    def __init__(self, settings: Settings):
        self._api_key = (settings.resend_api_key or "").strip()
        self._from = (settings.resend_from_email or "").strip()
        self._site_url = (settings.public_site_url or "").rstrip("/")
        self._enabled = bool(self._api_key and self._from)

        if not self._enabled:
            logger.warning(
                "EmailClient disabled (RESEND_API_KEY or RESEND_FROM_EMAIL missing). "
                "Approve/reject notifications will be no-ops."
            )

    @property
    def enabled(self) -> bool:
        return self._enabled

    def _post(self, subject: str, to: str, html: str, text: str) -> None:
        if not self._enabled:
            logger.info("EmailClient disabled — skipping '%s' to %s", subject, to)
            return
        try:
            resp = httpx.post(
                RESEND_URL,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": self._from,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    "text": text,
                },
                timeout=15.0,
            )
            if resp.status_code >= 400:
                logger.warning(
                    "Resend returned %s for '%s' to %s: %s",
                    resp.status_code,
                    subject,
                    to,
                    resp.text[:300],
                )
        except Exception as e:  # never let email failures bubble up
            logger.warning("Resend send failed for '%s' to %s: %s", subject, to, e)

    # ---------- public templates ----------

    def send_approved(self, to: str, title: str, slug: str) -> None:
        url = f"{self._site_url}/stories/{slug}" if self._site_url else ""
        subject = f"Your story was approved: {title}"
        text = (
            f"Great news — your incident story was approved and is now public.\n\n"
            f"Title: {title}\n"
            + (f"View: {url}\n" if url else "")
            + "\nThanks for sharing it."
        )
        link_html = (
            f'<p><a href="{url}">{url}</a></p>' if url else ""
        )
        html = (
            f"<p>Great news &mdash; your incident story was approved and is now public.</p>"
            f"<p><strong>{title}</strong></p>"
            f"{link_html}"
            f"<p>Thanks for sharing it.</p>"
        )
        self._post(subject, to, html, text)

    def send_rejected(self, to: str, title: str, reason: Optional[str]) -> None:
        subject = f"Your story was not approved: {title}"
        reason_text = (reason or "No reason provided.").strip()
        text = (
            f"Your incident story was reviewed and not approved.\n\n"
            f"Title: {title}\n"
            f"Reason: {reason_text}\n\n"
            f"You're welcome to revise and resubmit."
        )
        html = (
            f"<p>Your incident story was reviewed and not approved.</p>"
            f"<p><strong>{title}</strong></p>"
            f"<p>Reason: {reason_text}</p>"
            f"<p>You're welcome to revise and resubmit.</p>"
        )
        self._post(subject, to, html, text)