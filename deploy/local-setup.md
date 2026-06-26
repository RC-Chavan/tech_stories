# Local Setup & Run Guide — Incident Stories

This guide walks you through running both services on your machine and getting the app end-to-end working.

## Prerequisites

| Tool        | Version | Install                                           |
|-------------|---------|---------------------------------------------------|
| Python      | 3.11+   | https://python.org or `brew install python@3.11`  |
| Node.js     | 20+     | https://nodejs.org or `brew install node`         |
| npm         | 10+     | bundled with Node                                 |
| Supabase CLI (optional) | latest | `brew install supabase/tap/supabase`        |
| psql (optional) | latest | `brew install libpq` and `brew link --force libpq` |
| Git         | latest  | `brew install git`                                |
| Docker (optional, for the container path in section 11) | 24+ | https://docs.docker.com/get-docker/ |

You'll also need accounts on:
- **Supabase** — https://supabase.com (free tier)
- **An LLM provider** — MiniMax M3 cloud (default), or OpenAI / Groq / Ollama, etc.

---

## 1. Clone & inspect the repo

```bash
cd ~/Desktop/Rohit_Interview_Stories
ls
# you should see: backend/  frontend/  CLAUDE.md  README.md  plans/  execute/
```

---

## 2. Set up Supabase

### 2.1 Create a project
1. Go to https://supabase.com/dashboard → **New project**
2. Pick a region close to you, set a strong DB password, wait ~2 min for provisioning
3. From **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key (the secret one) → `SUPABASE_SERVICE_ROLE_KEY`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2.2 Run the schema migration
In the Supabase dashboard, go to **SQL Editor → New query**, paste the contents of:

```
backend/supabase/migrations/0001_init.sql
```

Click **Run**. You should see "Success. No rows returned".

### 2.3 Enable OAuth providers (for admin login)
1. **Authentication → Providers**
2. Enable **Google** — paste your OAuth client ID/secret from Google Cloud Console (or use Supabase's built-in Google provider if available on your plan)
3. Enable **GitHub** — create an OAuth app at https://github.com/settings/developers with callback `https://<your-project-ref>.supabase.co/auth/v1/callback`

### 2.4 Promote your account to admin
After you've signed in to the frontend once (so a `profiles` row exists for you):
1. **Authentication → Users** — copy your user's UUID
2. **SQL Editor** — run:
   ```sql
   update profiles set is_admin = true where id = '<paste-your-uuid>';
   ```

---

## 3. Configure the backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Open `backend/.env` and fill in:

```env
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...          # secret, server-only

LLM_BASE_URL=https://api.minimax.com/v1
LLM_API_KEY=your-minimax-key
LLM_MODEL=minimax-m3

ALLOWED_ORIGINS=http://localhost:3000
```

> **Swapping LLM?** See `plans/project-plan.md` → "Swappable LLM" for other provider URLs/models.

---

## 4. Run the backend

```bash
# from /backend with venv activated
uvicorn app.main:app --reload --port 8000
```

Verify:
- Open http://localhost:8000/health — should return `{"status":"ok","model":"minimax-m3"}`
- Open http://localhost:8000/docs — interactive API explorer

### Quick smoke test

```bash
curl -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "raw_text": "Friday 11pm, our payment service started returning 5xx for ~18% of requests. Root cause: a stale read replica after an unplanned failover. We forced reads to the primary, scaled the API tier, and ran the missed migration manually. Restored in 40 minutes."
  }'
```

You should get back a JSON `SubmitResponse` with `title`, `tldr`, and `moderation_flags`.

---

## 5. Configure the frontend

In a new terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
```

Open `frontend/.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...          # anon key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## 6. Run the frontend

```bash
# from /frontend
npm run dev
```

Open http://localhost:3000

You should see:
- **Homepage** — empty list (or whatever's been approved)
- **/submit** — paste/type/voice form
- **/admin** — redirects to login if not signed in

---

## 7. End-to-end smoke test

1. Visit http://localhost:3000/submit
2. Paste an incident (≥ 20 chars). Click **Submit**
3. You should see a confirmation page with the AI-generated title + TL;DR
4. Visit http://localhost:3000/admin
5. Sign in with Google or GitHub (must be promoted to admin in step 2.4)
6. You should see your submission in the queue with raw vs. AI output side-by-side
7. Click **Approve** — the submission disappears from the queue
8. Visit http://localhost:3000 — your story is now visible to the public
9. Click into it — you should see the STAR story, technical points, and TL;DR

---

## 8. Common commands cheat sheet

### Backend
```bash
cd backend
source .venv/bin/activate

uvicorn app.main:app --reload --port 8000   # dev server
pytest                                       # run tests
ruff check app tests                         # lint
```

### Frontend
```bash
cd frontend

npm run dev                                  # dev server
npm test                                     # tests
npm run lint                                 # lint
npm run build                                # production build
npm start                                    # serve production build
```

### Reset / inspect Supabase data
```sql
-- See pending queue
select id, title, created_at, status
from incidents
where status = 'pending'
order by created_at desc;

-- Wipe everything (DANGER)
delete from incident_versions;
delete from incidents;
```

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` on admin endpoints | JWT expired or user not admin | Sign in again; verify `profiles.is_admin = true` |
| `LLM error` on submit | Wrong API key or base URL | Double-check `LLM_BASE_URL` and `LLM_API_KEY`; test with curl against the LLM directly |
| CORS error in browser console | Backend `ALLOWED_ORIGINS` missing your frontend origin | Add `http://localhost:3000` to `backend/.env` |
| Homepage says "Could not load stories" | Backend not running or wrong `NEXT_PUBLIC_API_BASE_URL` | Make sure backend is up at port 8000; check `.env.local` |
| Voice button missing or disabled | Browser doesn't support Web Speech API | Use Chrome or Edge; Safari/Firefox not supported in v1 |
| `23505` duplicate key error on insert | Slug collision — title slugifies to an existing slug | Tweak the title; or add suffixing logic to the LLM client |
| Submit succeeds but home page is empty | You submitted but didn't approve yet | Go to `/admin` and approve; only approved stories are public |

---

## 10. Deploy to production

When you're ready to ship:
- **Vercel:** import this repo, set root to `frontend`, add frontend env vars
- **Render:** new web service, root `backend`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, add backend env vars
- **Supabase:** already running — just make sure your OAuth callback URLs include the deployed frontend domain

See `CLAUDE.md` → "Deploy" for the full checklist.

---

## 11. Docker quickstart (alternative to sections 3–7)

If you prefer running both services in containers instead of installing Python + Node locally, this repo includes Dockerfiles and a `docker-compose.yml`.

### Prerequisites

- Docker Engine 24+
- Docker Compose v2 (`docker compose`, not `docker-compose`)

### One-time setup

```bash
# From repo root
cp .env.example .env
# Edit .env and fill in SUPABASE_*, LLM_*, etc.
```

### Run the stack

```bash
docker compose up --build
```

This will:
1. Build the backend image (`backend/Dockerfile`)
2. Build the frontend image (`frontend/Dockerfile`) with `NEXT_PUBLIC_*` vars baked in at build time
3. Start both containers with healthchecks
4. Wait for the backend to become healthy before starting the frontend

### Access the app

- Frontend: http://localhost:3000
- Backend:  http://localhost:8000
- API docs: http://localhost:8000/docs

### Common Docker commands

```bash
docker compose up --build       # build images and start
docker compose up               # start (use cached images)
docker compose down             # stop and remove containers
docker compose down -v          # also remove anonymous volumes
docker compose logs -f backend  # tail backend logs
docker compose logs -f frontend # tail frontend logs
docker compose ps               # list containers + health
docker compose exec backend bash   # shell into backend container
docker compose restart frontend    # rebuild not needed, just restart
docker compose build --no-cache    # force rebuild without cache
```

### Rebuilding after code changes

- **Backend code changed:** `docker compose up --build` (or just `docker compose build backend && docker compose up -d backend`)
- **Frontend code changed:** `docker compose up --build frontend` (Next.js needs a rebuild; no hot-reload inside the container)
- **Only env vars changed:** `docker compose up -d` (no rebuild for backend; `docker compose up --build frontend` for frontend, since `NEXT_PUBLIC_*` are baked in at build time)

### Notes & gotchas

- **`NEXT_PUBLIC_*` vars are inlined at build time.** Changing them in `.env` requires rebuilding the frontend image.
- **Supabase runs in the cloud** in this setup. The docker-compose stack does not include a local Supabase. If you want that too:
  ```bash
  brew install supabase/tap/supabase
  supabase init
  supabase start
  # Then set SUPABASE_URL=http://localhost:54321 in your .env
  ```
  The backend and frontend will both connect to it transparently.
- **Voice input** uses the browser's `SpeechRecognition` API — it works the same whether the frontend runs in Docker or `npm run dev`. Use Chrome or Edge.
- **Hot reload** is intentionally **not** wired up in the base compose file. For active frontend development, prefer `npm run dev` locally and only use the base compose for "ship-it" parity. For backend, Uvicorn's `--reload` is also off in the container. See section 12 below for a dev override that enables both.

---

## 12. Docker dev override (hot reload inside containers)

If you want hot reload **inside** Docker (so the container reflects edits without rebuilding), use the dev override file.

### Run with hot reload

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Or, more conveniently, add a Makefile target or shell alias:

```bash
# Add to ~/.zshrc or ~/.bashrc
alias dcup-dev='docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build'
alias dcup-prod='docker compose up --build'
```

### What changes in dev mode

| Concern | Base (prod-like) | Dev override |
|---|---|---|
| Dockerfile | `Dockerfile` (multi-stage, slim) | `Dockerfile.dev` (single-stage, dev deps) |
| Backend command | `uvicorn` (no `--reload`) | `uvicorn --reload --reload-dir /app/app` |
| Frontend command | `npm start` (production server) | `npm run dev` (Next dev server) |
| Source mount | none — code is baked into image | bind-mounted from host |
| `node_modules` | baked into image | preserved as anonymous volume (host's won't work in container) |
| Frontend healthcheck | enabled | disabled |
| `depends_on: service_healthy` | yes — frontend waits for backend | removed — both start in parallel |
| Log level | INFO | DEBUG |

### Iterating after edits

- **Backend:** edit any file in `backend/app/` → uvicorn auto-reloads in ~1s
- **Frontend:** edit any file in `frontend/app/`, `frontend/components/`, etc. → Next dev server hot-reloads
- **Env var changes:**
  - `backend/.env` → just save; uvicorn picks it up on next reload (or restart container)
  - `frontend/.env.local` → just save; Next picks it up on next render (no restart needed)
  - `docker-compose.yml` env changes → `docker compose up -d` (no rebuild)
- **Adding new npm packages:** rebuild the frontend image so `node_modules` is reinstalled:
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build frontend
  ```
  Or nuke the anonymous volume:
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.dev.yml down
  docker volume rm incident-stories_frontend-node-modules
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
  ```
- **Adding new pip packages:** same idea, with `backend-venv` volume.

### File-watching on macOS / Windows

If hot reload seems flaky on macOS Docker Desktop or Windows WSL2, the override already sets `WATCHPACK_POLLING=true` and `CHOKIDAR_USEPOLLING=true`. If you still see issues, increase the polling interval by adding to the frontend container's env:

```yaml
environment:
  WATCHPACK_POLLING: "true"
  CHOKIDAR_INTERVAL: "1000"
```

### Cleanup

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down       # stop
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v    # also drop volumes
```

### When to use which

- **Editing code daily?** → use the dev override
- **Testing production-like behavior?** → use the base compose file
- **CI / deploy validation?** → use the base compose file
- **Just want it running once to demo?** → either works; base is leaner