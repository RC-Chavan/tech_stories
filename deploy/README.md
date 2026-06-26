# Deploy — Incident Stories

Everything you need to ship Incident Stories to production, in one folder.

> **Audience:** the next person (or you, 3 months from now) who needs to deploy this
> without reading every file in the repo. Read this file top to bottom.

---

## What's in here

| File | What it is | When you use it |
|---|---|---|
| `README.md` | This file. The end-to-end deploy guide. | First stop. |
| `env.production.example` | Every env var in one annotated file: required value, secret?, which dashboard it goes in, what happens if you skip it. | Cross-reference while filling out Render + Vercel. |
| `render.yaml` | Render Blueprint — provisions the backend service as infrastructure-as-code. | Optional but recommended. Use "New + → Blueprint" instead of "New + → Web Service" and point Render at this file. |
| `render.env.example` | Just the backend envs, copy-paste formatted for the Render dashboard "Add Environment Variable" form. | If you deploy via the Render dashboard instead of the Blueprint. |
| `vercel.md` | Vercel-specific steps (which envs to add, when the redeploy happens, the gotcha about `NEXT_PUBLIC_*` being build-time). | After Render is live. |
| `vercel.env.example` | Just the frontend envs, copy-paste formatted for the Vercel dashboard. | Vercel dashboard deployment. |
| `secrets-checklist.md` | Where to fetch each secret value from (Supabase, OpenRouter). The one page you open in a second tab while filling in the dashboards. | While filling env vars. |
| `supabase/README.md` | Run order for the SQL migrations + how to apply via Supabase SQL Editor or `psql`. | Before deploying anything. |
| `supabase/*.sql` | Copy of every migration, snapshotted at deploy time. Self-contained so the deploy folder is portable. | Run in the Supabase SQL Editor. |
| `smoke-test.sh` | One bash script that curls the health endpoint, CORS preflight, public list, and admin queue. Exits non-zero on failure. | Right after both deploys, then on every future deploy. |
| `TROUBLESHOOTING.md` | Common failure modes (cold start, CORS, OpenRouter 429, Vercel env-not-rebuilt) with one-line fixes. | When something breaks in prod. |

---

## The 5-step deploy

> **Order matters.** Do them in this order, top to bottom. The full rationale is at the
> bottom of this file; the short version is that the frontend bundle inlines the backend
> URL at build time, so the backend has to be live before the frontend can know where to call.

### Step 1 — Database (Supabase)

1. Open the Supabase SQL Editor for your project.
2. Run the migrations in `deploy/supabase/` in numeric order. See `deploy/supabase/README.md`
   for the exact order and how to verify each one.
3. **Expected time:** 2 minutes.

### Step 2 — Backend (Render)

Two ways to do this; pick one:

**Option A — Render Blueprint (recommended, reproducible):**
1. Render dashboard → **New + → Blueprint**.
2. Point at `deploy/render.yaml` in your repo.
3. Render reads the file and provisions the `incident-stories-api` web service.
4. Fill in the `env:` values from `deploy/render.env.example` (Render shows them as form
   fields with the secret ones toggleable to "Secret").

**Option B — Render dashboard, manual:**
1. Render dashboard → **New + → Web Service** → connect repo.
2. **Root directory:** `backend` *(critical — do not leave blank)*.
3. **Runtime:** Docker.
4. **Instance type:** Free.
5. Fill envs from `deploy/render.env.example`.
6. Click **Create Web Service**.

3. Wait for the build (~3-5 min on free tier) and the deploy badge to turn green.
4. Copy the URL Render gives you — it looks like `https://incident-stories-api.onrender.com`.

**Expected time:** 5-10 minutes (mostly waiting for the build).

### Step 3 — Wire frontend to backend (Vercel)

1. Vercel dashboard → your `incident-stories` project → **Settings → Environment Variables**.
2. Set the three `NEXT_PUBLIC_*` envs per `deploy/vercel.env.example`. The most important
   one is `NEXT_PUBLIC_API_BASE_URL` — paste the Render URL from Step 2 here.
3. **Vercel does not auto-rebuild when you change env vars.** After saving, go to
   **Deployments → latest → ⋯ → Redeploy**. (Or push a no-op commit to `main`.)
4. See `deploy/vercel.md` for the full walk-through and a "did it work?" check.

**Expected time:** 2 minutes.

### Step 4 — Backfill CORS on the backend

Now that you know the real Vercel URL (you can find it in the Vercel dashboard after
Step 3's redeploy), edit `ALLOWED_ORIGINS` on Render:

1. Render → your service → **Environment** → edit `ALLOWED_ORIGINS`.
2. Set it to your Vercel URL (no trailing slash). Example:
   ```
   ALLOWED_ORIGINS = https://incident-stories.vercel.app
   ```
3. Save. Render auto-redeploys (~2 min).

**Expected time:** 3 minutes (mostly waiting for Render's redeploy).

### Step 5 — Smoke test

From your terminal:

```bash
cd deploy
RENDER_URL=https://incident-stories-api.onrender.com \
VERCEL_ORIGIN=https://incident-stories.vercel.app \
  ./smoke-test.sh
```

The script hits:
1. `GET /health` → expect 200 with `{"status":"ok","model":"..."}`.
2. `OPTIONS /api/incidents` with your Vercel origin → expect `Access-Control-Allow-Origin`.
3. `GET /api/incidents?page=1&page_size=3` → expect 200 with at least one item, each
   having a `summary` field (proves the SQL rename migration ran).
4. `POST /api/incidents` with a fake submission → expect 202 (proves writes work).

Open the live Vercel URL in a browser, sign in at `/admin/login`, and confirm the
admin queue loads.

**Expected time:** 1 minute (plus ~30-60s cold-start on the first request after Render's
free instance wakes up).

---

## After deploy

- **Email notifications** (approve/reject emails): skip until you set up Resend.
  See `deploy/secrets-checklist.md` for the env vars to add when you're ready.
- **Custom domain:** add a CNAME to your DNS pointing at `cname.vercel-dns.com` (Vercel)
  and at `<your-service>.onrender.com` (Render). Then update `ALLOWED_ORIGINS` and
  `PUBLIC_SITE_URL` on Render, and `NEXT_PUBLIC_API_BASE_URL` on Vercel.
- **Monitoring:** Render's free tier doesn't ship with external monitoring. Add
  Better Stack / Sentry / etc. when you start caring about uptime.

---

## Why this exact order

The frontend is a Next.js app that builds once and ships a static JS bundle. The bundle
contains the value of every `NEXT_PUBLIC_*` env var at the moment of `next build`. So:

- If you deploy the frontend **before** the backend is live, Vercel builds with
  `NEXT_PUBLIC_API_BASE_URL=https://incident-stories-api.onrender.com` but that URL doesn't
  resolve yet. The site looks broken until you trigger a manual redeploy.
- If you change `NEXT_PUBLIC_API_BASE_URL` on Vercel but **forget to redeploy**, the live
  bundle still calls the old URL. You have to hit "Redeploy" explicitly.
- If the backend's `ALLOWED_ORIGINS` doesn't include the real Vercel URL, the browser
  blocks the cross-origin `/api/*` calls with a CORS error even though both services are
  individually healthy.

Order: **DB → Backend → Wire Vercel env → Redeploy Vercel → Backfill CORS → Smoke test.**
Each step unblocks the next.

---

## Files you should NOT edit

- `backend/Dockerfile` — production image is correct. Don't change `EXPOSE`, `CMD`, or
  the `appuser` user without understanding the security implications.
- `frontend/Dockerfile` — same. Don't change the standalone build step.
- `docker-compose.yml` — local dev only; not used by Render.
- `supabase/migrations/*` in `backend/` — those are the canonical local-dev path. The
  deploy folder has its own copies. If you change a migration, update both.

---

## Quick rollback

If a deploy goes sideways:

1. **Backend bad?** Render → your service → **Manual Deploy → Deploy latest commit** to
   pick up the previous green build, or click **Rollback to a previous deploy**.
2. **Frontend bad?** Vercel → Deployments → find a green one → **⋯ → Promote to
   Production**.
3. **DB bad?** You can't easily rollback a `rename column`. If 0004 is the issue, the
   reverse is `alter table public.incident_versions rename column summary to tldr;` —
   run it in SQL Editor. For 0005 (archived), `alter table public.incidents drop column
   if exists archived_at, archived_reason;` + recreate the old CHECK constraint.
