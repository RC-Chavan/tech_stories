"""OpenAI-compatible LLM client. Talks to any /chat/completions endpoint."""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

import httpx

from .config import Settings
from .prompts import build_messages
from .schemas import AIProcessingResult

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Raised when the LLM call fails or returns invalid output."""


@dataclass
class LLMResult:
    """Result of one LLM call. `result` is the validated structured output;
    `thinking` is the model's reasoning trace (e.g. qwen3's `message.reasoning`).
    `thinking` may be empty/None for providers that don't emit one."""

    result: AIProcessingResult
    thinking: Optional[str] = None


class LLMClient:
    def __init__(self, settings: Settings):
        self._base_url = settings.llm_base_url.rstrip("/")
        self._api_key = settings.llm_api_key
        self._model = settings.llm_model
        self._timeout = settings.request_timeout_seconds

    async def process_incident(
        self, raw_text: str, prompt_override: Optional[str] = None, model: Optional[str] = None
    ) -> LLMResult:
        """Send raw incident text to the LLM and return both the structured
        AI output and (when available) the model's reasoning trace.

        `model` overrides the default `self._model` for this one call (used
        by the admin model picker dropdown).
        """
        url = f"{self._base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model or self._model,
            "temperature": 0.4,
            # Note: we do NOT send `response_format: {type: json_object}` because
            # some hosted providers (DeepSeek via OpenRouter, etc.) reject it.
            # The strict JSON contract is enforced by the system prompt and
            # `_extract_json` is a defensive fallback for any ```json fences.
            "messages": build_messages(raw_text, prompt_override),
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            try:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                body = e.response.text[:500]
                logger.error("LLM HTTP %s: %s", e.response.status_code, body)
                raise LLMError(f"LLM provider returned {e.response.status_code}") from e
            except httpx.RequestError as e:
                logger.error("LLM request error: %s", e)
                raise LLMError("Could not reach the LLM provider") from e

        data = resp.json()
        try:
            choice = data["choices"][0]
            message = choice["message"]
            content = message["content"]
            # `reasoning` is the field Ollama uses for qwen3 thinking traces; some
            # other providers may use `reasoning_content` or none at all.
            thinking = (
                message.get("reasoning")
                or message.get("reasoning_content")
                or ""
            )
        except (KeyError, IndexError, TypeError) as e:
            raise LLMError("Unexpected LLM response shape") from e

        parsed_json = self._extract_json(content)
        try:
            validated = AIProcessingResult.model_validate(parsed_json)
        except Exception as e:
            logger.error("AI output failed validation: %s\nRaw: %s", e, content[:1000])
            raise LLMError(f"AI output failed schema validation: {e}") from e

        # Strip a bare leading/trailing whitespace and a single newline; otherwise
        # keep the trace exactly as the model emitted it.
        thinking_clean = thinking.strip() if isinstance(thinking, str) else ""
        return LLMResult(result=validated, thinking=thinking_clean or None)

    @staticmethod
    def _extract_json(content: str) -> dict:
        """Some providers wrap JSON in ```json fences despite response_format. Strip defensively."""
        text = content.strip()
        # Strip ```json ... ``` fences
        fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if fence_match:
            text = fence_match.group(1)
        return json.loads(text)