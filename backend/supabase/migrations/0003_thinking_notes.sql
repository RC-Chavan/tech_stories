-- Persist the LLM's reasoning/insight trace on each incident_version.
-- Populated from Ollama's `message.reasoning` field (qwen3 thinking mode).
-- Nullable: older versions, or providers that don't emit thinking, leave it NULL.
-- No size cap here — reasoning traces can be 10k+ chars; the public incident page
-- renders this in a collapsed disclosure so cost is paid on click, not on load.

alter table public.incident_versions
    add column if not exists thinking_notes text;