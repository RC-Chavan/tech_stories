# Incident Stories — Project Plan

## Goal

A web app where engineers paste rough notes about technical incidents (bullet points, voice-to-text dumps, raw prose — anything) and an AI turns them into polished, interview-ready stories. Each story has three views:

1. **STAR story** — Situation, Task, Action, Result (interview-ready)
2. **Technical points** — bullet list of root cause, technologies, key decisions
3. **TL;DR** — 30-second read of the entire incident (problem + resolution + thinking)

Visitors browse approved stories. Admins review AI-moderated submissions and approve/reject them.

## Stack (confirmed)

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS → **Vercel**
- **Backend:** FastAPI (Python 3.11) → **Render**
- **DB + Auth:** Supabase (Postgres + OAuth + RLS)
- **AI:** Any OpenAI-compatible `/chat/completions` endpoint. Default: **MiniMax M3 cloud**. Swappable via env vars.
- **Voice (v1):** Browser Web Speech API only. Audio file upload deferred to v2.

## Architecture

```
┌─────────────┐   HTTPS    ┌──────────────┐   SDK    ┌──────────────┐
│   Browser   │ ─────────► │  Next.js     │ ───────► │  Supabase    │
│  (public +  │            │  (Vercel)    │          │  (Auth + DB) │
│   admin)    │            └──────┬───────┘          └──────▲───────┘
└─────────────┘                  │                            │
                                │ HTTPS                       │
                                ▼                            │
                         ┌──────────────┐                    │
                         │   FastAPI    │ ───────────────────┘
                         │   (Render)   │   service-role key
                         └──────┬───────┘   (bypasses RLS)
                                │
                                ▼
                         ┌──────────────┐
                         │  LLM API     │  OpenAI-compatible
                         │  (MiniMax,   │  (swappable)
                         │   Ollama,    │
                         │   OpenAI…)   │
                         └──────────────┘
```

The two services share Supabase as the source of truth. The backend never calls the frontend.

## Repository Layout

```
/                              # repo root
├── frontend/                  # Next.js 14 (Vercel)
│   ├── app/                   # App Router pages
│   │   ├── page.tsx           # public story list (ISR)
│   │   ├── stories/[slug]/    # public story detail
│   │   ├── submit/            # public submit form + voice
│   │   └── admin/             # admin dashboard + OAuth login
│   ├── components/            # IncidentCard, StarSection, ModerationFlags
│   ├── hooks/                 # useVoiceInput (Web Speech API)
│   ├── lib/                   # supabase clients, api wrapper, types
│   └── package.json
├── backend/                   # FastAPI service (Render)
│   ├── app/                   # main.py, routes, schemas, llm, db, deps
│   ├── supabase/migrations/   # SQL schema (0001_init.sql)
│   └── requirements.txt
├── plans/                     # project plans (this folder)
├── execute/                   # local-run & deploy guides
├── CLAUDE.md                  # dev guide
└── README.md
```

## Data Model (Supabase / Postgres)

- **`incidents`** — `id, slug, title, raw_text, status (pending|approved|rejected), moderation_flags jsonb, moderation_notes text, created_at, approved_at`
- **`incident_versions`** — `id, incident_id, star jsonb, technical_points jsonb, tldr text, created_at` (history of regenerations)
- **`profiles`** — `id (FK auth.users), is_admin boolean`

**RLS policies:**
- Public can `SELECT` only `incidents` rows where `status = 'approved'`
- Public can `SELECT` `incident_versions` only via approved parent incidents
- Writes happen via the backend's service-role key (bypasses RLS)
- Admins verify JWT, then `is_admin` is checked against `profiles`

## AI Contract (strict JSON)

The backend makes one chat completion per submission. The model must return:

```json
{
  "title": "string (5-12 words)",
  "slug": "string (kebab-case)",
  "star": {
    "situation": "string",
    "task": "string",
    "action": "string",
    "result": "string"
  },
  "technical_points": ["string", "..."],
  "tldr": "string (1-3 sentences, ~30 second read)",
  "moderation_flags": {
    "toxicity": false,
    "pii_detected": [],
    "off_topic": false,
    "low_quality": false,
    "notes": ""
  }
}
```

Pydantic enforces this. If validation fails, raw text is still saved as `pending` so an admin can review manually.

## Moderation Flags Taxonomy

Surfaced in the admin dashboard, highlighted when set to `true`:
- `toxicity` — abusive or harassing content
- `pii_detected` — list of PII types found (email, phone, api_key, customer_name, ip_address)
- `off_topic` — not actually a technical incident
- `low_quality` — too vague to process meaningfully
- `notes` — free-form explanation from the model

## API Surface

**Public:**
- `POST /api/incidents` — submit raw text; returns AI-generated preview
- `GET /api/incidents?page=&page_size=` — list approved
- `GET /api/incidents/{slug}` — detail of one approved

**Admin (Bearer JWT + `is_admin`):**
- `GET /api/admin/incidents?status=pending` — review queue (returns full detail per row)
- `POST /api/admin/incidents/{id}/approve`
- `POST /api/admin/incidents/{id}/reject` — body `{ "reason": "..." }`
- `POST /api/admin/incidents/{id}/regenerate` — body `{ "prompt_override": "..." }` (optional)

## Swappable LLM

Single `LLMClient` in `backend/app/llm.py` that talks to any OpenAI-compatible endpoint. Switch by changing env vars only:

| Provider    | LLM_BASE_URL                        | LLM_MODEL          |
|-------------|-------------------------------------|--------------------|
| MiniMax M3  | `https://api.minimax.com/v1`        | `minimax-m3`       |
| Ollama      | `http://localhost:11434/v1`         | `llama3.1:70b`     |
| OpenAI      | `https://api.openai.com/v1`         | `gpt-4o-mini`      |
| Groq        | `https://api.groq.com/openai/v1`    | `llama-3.1-70b`    |
| OpenRouter  | `https://openrouter.ai/api/v1`      | `any/model`        |

## Environment Variables

**Backend** (`backend/.env`):
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LLM_BASE_URL=https://api.minimax.com/v1
LLM_API_KEY=
LLM_MODEL=minimax-m3
ALLOWED_ORIGINS=http://localhost:3000
```

**Frontend** (`frontend/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Voice Input (v1)

Implemented as a React hook (`frontend/hooks/useVoiceInput.ts`) using the browser's `SpeechRecognition` API. Live transcript appears below the textarea while listening. User clicks "Append" to merge into the form. If unsupported (Firefox/Safari), UI shows a fallback message to type/paste instead.

## Admin Promotion

After first OAuth sign-in, run once in Supabase SQL editor:
```sql
update profiles set is_admin = true where id = '<your-user-uuid>';
```

## Deploy

- **Vercel:** import repo, root = `frontend`, add frontend env vars, framework = Next.js
- **Render:** web service, root = `backend`, build = `pip install -r requirements.txt`, start = `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, add backend env vars
- **Supabase:** run `0001_init.sql`, enable Google + GitHub OAuth providers

## Out of Scope for v1

- Audio file upload / transcription
- Comments / reactions on stories
- Search / filtering beyond newest-first
- Email notifications to submitters
- Multi-language support