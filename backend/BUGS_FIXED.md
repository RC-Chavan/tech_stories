# Bugs fixed during local development

These were real bugs in the code (not just env config). They were
fixed in the same session where the frontend ↔ backend plumbing
debugging happened. Listed here so future contributors don't undo
them by accident.

## 1. `db.list_approved` selected a non-existent column

**File:** `backend/app/db.py`, `list_approved`

**Symptom:** `GET /api/incidents` returned HTTP 500 with body
`Internal Server Error`. Home page and admin pages couldn't load
stories.

**Cause:** the select list included `tldr_via_version`. There is no
such column on `incidents` (the `tldr` lives on `incident_versions`).
PostgREST rejected the query and the supabase-py client raised inside
`.execute()`.

**Fix:** removed `tldr_via_version` from the select. Hydration of
`tldr` is done by `_hydrate_summaries` → `_latest_version`, which
queries `incident_versions` separately.

```python
# before
.select("id, slug, title, tldr_via_version, created_at, approved_at", count="exact")
# after
.select("id, slug, title, created_at, approved_at", count="exact")
```

## 2. `get_status_for_submitter` was misindented

**File:** `backend/app/db.py`, around `get_status_for_submitter`

**Symptom:** any call to `POST /api/incidents/{id}/status` would have
raised `AttributeError: 'Database' object has no attribute
'get_status_for_submitter'` — though it was never exercised before,
it was a latent bug waiting for the first user to hit `/track`.

**Cause:** the function was defined at module scope (no `class`
indentation) but with `self` as the first parameter, making it look
like a method. It was being called as `db.get_status_for_submitter(...)`.

**Fix:** moved the definition inside the `Database` class so `self`
is correctly bound.

## 3. `thinking_notes` column on `incident_versions`

**File:** `backend/app/db.py`, `_latest_version`

**Context:** a third migration
(`backend/supabase/migrations/0003_thinking_notes.sql`) was added to
introduce a `thinking_notes text` column on `incident_versions`,
populated from Ollama's `message.reasoning` field (qwen3 thinking
mode). The select in `_latest_version` was updated to include it.

**Before running the migration, the column does not exist** — and any
list/hydrate call would 500 the same way bug #1 did.

**Action item:** run migration `0003` against Supabase before
deploying:

```bash
psql "$SUPABASE_DB_URL" -f backend/supabase/migrations/0003_thinking_notes.sql
```

The migration is idempotent (`add column if not exists`), so it's
safe to re-run.