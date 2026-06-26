# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Incident Stories

Web app that turns rough engineer-written incident notes into polished STAR-format writeups with a quick summary using a swappable OpenAI-compatible LLM. Public read, admin-approved write, with AI moderation flags surfaced to admins. The STAR shape is intentionally framework-neutral so the writeups are reusable across interviews, on-call reviews, design reviews, and incident retros.

## Repository layout

```
/                      # repo root
├── frontend/          # Next.js 14 app (Vercel)
│   ├── app/           # App Router pages
│   ├── components/    # Shared UI
│   ├── lib/           # Supabase client, API helpers
│   └── hooks/         # useVoiceInput (Web Speech API)
├── backend/           # FastAPI service (Render)
│   ├── app/           # main.py, routes, schemas, llm client
│   ├── supabase/migrations/  # SQL schema
│   └── requirements.txt
├── deploy/            # Production deploy toolkit — read deploy/README.md first
│   ├── README.md      # End-to-end deploy guide (DB → Render → Vercel → smoke test)
│   ├── render.yaml    # Render Blueprint (infrastructure-as-code for backend)
│   ├── vercel.md      # Vercel-specific steps + the redeploy trap
│   ├── smoke-test.sh  # One-shot curl that hits health, CORS, list, submit
│   ├── TROUBLESHOOTING.md  # Common failure modes with one-line fixes
│   └── supabase/      # Snapshot of migrations + run order
├── CLAUDE.md
└── README.md
```

The two services are **deployed independently** (frontend on Vercel, backend on Render). They share Supabase as the source of truth. The backend never calls the frontend; the frontend calls the backend over HTTPS.

## Common commands

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000        # dev server
pytest                                            # all tests
pytest tests/test_routes/test_submit.py -k "valid" # single test
ruff check app tests                              # lint
```

### Frontend
```bash
cd frontend
npm install
npm run dev                                       # http://localhost:3000
npm test                                          # all tests
npm test -- --watch StoryCard                     # single test pattern
npm run lint
npm run build                                     # production build
```

### Database
Apply migrations to Supabase via psql or Supabase SQL editor:
```bash
psql "$SUPABASE_DB_URL" -f backend/supabase/migrations/0001_init.sql
```

## Environment variables

### Backend (`backend/.env`)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # server-only, never exposed to browser
LLM_BASE_URL=                # e.g. https://api.minimax.com/v1 or http://localhost:11434/v1
LLM_API_KEY=
LLM_MODEL=                   # e.g. minimax-m3, llama3.1:70b, gpt-4o-mini
ALLOWED_ORIGINS=             # comma-separated frontend origins for CORS

# Email notifications (optional — leave blank to skip)
RESEND_API_KEY=              # https://resend.com/api-keys
RESEND_FROM_EMAIL=           # e.g. "Incident Stories <noreply@yourdomain.com>"
PUBLIC_SITE_URL=             # e.g. https://incident-stories.vercel.app (used in approve emails)
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=    # e.g. https://incident-stories-api.onrender.com
```

## AI contract (must match `backend/app/prompts.py` and `backend/app/schemas.py`)

The backend makes one chat completion per submission and expects strict JSON:

```json
{
  "title": "string",
  "slug": "kebab-case-unique",
  "star": {
    "situation": "string",
    "task": "string",
    "action": "string",
    "result": "string"
  },
  "technical_points": ["string", "..."],
  "summary": "string (1-3 sentences, ~30 second read)",
  "moderation_flags": {
    "toxicity": false,
    "pii_detected": ["email", "phone", "api_key"],
    "off_topic": false,
    "low_quality": false,
    "notes": "string"
  }
}
```

Pydantic validation in `backend/app/schemas.py:AIProcessingResult` enforces this shape. If validation fails, the raw submission is still saved as `pending` so an admin can see it. The schema's `title` field also strips any incidental `interview` framing words from model output as a defensive cleanup.

## Moderation flags taxonomy

Defined in `backend/app/schemas.py:ModerationFlags`. All flags are surfaced in the admin dashboard:
- `toxicity` — abusive or harassing content
- `pii_detected` — list of PII types found (emails, phone numbers, API keys, customer names)
- `off_topic` — not a technical incident (e.g., personal stories, generic career advice)
- `low_quality` — too vague to process (e.g., single sentence with no detail)
- `notes` — free-form explanation from the model

Incidents with any non-empty flag still go to the admin queue, but the flags are highlighted.

## Swapping the LLM

The backend uses a single `LLMClient` in `backend/app/llm.py` that talks to any OpenAI-compatible `/chat/completions` endpoint. To switch providers, change only the env vars — no code changes:

| Provider    | LLM_BASE_URL                        | LLM_MODEL          |
|-------------|-------------------------------------|--------------------|
| MiniMax M3  | `https://api.minimax.com/v1`        | `minimax-m3`       |
| Ollama      | `http://localhost:11434/v1`         | `llama3.1:70b`     |
| OpenAI      | `https://api.openai.com/v1`         | `gpt-4o-mini`      |
| Groq        | `https://api.groq.com/openai/v1`    | `llama-3.1-70b`    |
| OpenRouter  | `https://openrouter.ai/api/v1`      | `any/model`        |

## Data model (Supabase / Postgres)

- `incidents` — `id, slug, title, raw_text, status (pending|approved|rejected), moderation_flags jsonb, moderation_notes text, submitted_email text NOT NULL, created_at, approved_at`
- `incident_versions` — `id, incident_id, star jsonb, technical_points jsonb, summary text, thinking_notes text, created_at` (history of regenerations)
- `profiles` — `id (FK auth.users), is_admin boolean`

Row-level security: public can `SELECT` only rows where `status = 'approved'`. Writes go through the backend with the service-role key (which bypasses RLS). Admin actions verify the caller's JWT has `is_admin = true` in `profiles`.

The `submitted_email` column is **required** at the API layer (Pydantic `EmailStr` on `IncidentCreate`) and at the DB layer (`NOT NULL`). It is used to:
1. Notify the submitter via Resend when their writeup is approved or rejected.
2. Gate the public `POST /api/incidents/{id}/status` endpoint — submitter proves ownership by knowing the email + id (we don't expose the email to public reads).

Run `0002_submitter_email.sql` once after `0001_init.sql` to add the column.

## API surface

Public:
- `POST /api/incidents` — submit raw text + email + optional title; returns the generated version immediately (status 202). The raw row is saved in `pending` and the AI runs in the background on a worker thread.
- `GET /api/incidents?page=&page_size=` — list approved incidents
- `GET /api/incidents/{slug}` — detail of one approved incident
- `POST /api/incidents/{id}/status` — submitter status lookup. Body: `{ "email": "..." }`. Returns 404 for both unknown id and email mismatch (no leak). Response includes `rejection_reason` when status is `rejected`.

Admin (requires Bearer JWT + `is_admin`):
- `GET /api/admin/incidents?status=pending|approved|rejected` — review queue for the given status
- `POST /api/admin/incidents/{id}/approve` — sets status=approved; best-effort sends Resend email
- `POST /api/admin/incidents/{id}/reject` — body: `{ "reason": "..." }`; sends rejection email
- `POST /api/admin/incidents/{id}/reopen` — moves rejected (or approved) incident back to pending; clears moderation_notes
- `POST /api/admin/incidents/{id}/regenerate` — body: `{ "prompt_override": "..." }` (optional)

## Email notifications (Resend)

Best-effort on approve and reject. Lazy-init: if `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is empty, every send is a logged no-op (no exception, no startup error) so local dev without Resend still works. Email failures never roll back an approval or rejection — they're logged at WARN.

## Admin promotion

After signing in via Supabase OAuth (Google/GitHub) for the first time, run once in the Supabase SQL editor to grant admin:
```sql
update profiles set is_admin = true where id = '<your-user-uuid>';
```

## Voice input (v1)

Implemented as a React hook at `frontend/hooks/useVoiceInput.ts` using the browser's `SpeechRecognition` API. The hook returns `{ transcript, isListening, start, stop, supported }`. If unsupported (Firefox/Safari), the UI shows a fallback to paste/type. Audio file upload is intentionally deferred to v2.

## Deploy

- **Vercel:** import repo, set root directory to `frontend`, add frontend env vars, framework = Next.js
- **Render:** new web service from repo, root directory `backend`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, add backend env vars
- **Supabase:** create project, run `0001_init.sql`, enable Google and GitHub OAuth providers in Authentication → Providers

## What is NOT in v1

Audio file transcription, comments, search/filtering, email notifications to submitters, multi-language support. These are tracked separately.