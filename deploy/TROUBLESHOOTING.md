# Troubleshooting — Incident Stories production

Symptom → diagnose → one-line fix.

---

## "Backend works in /health but frontend shows network errors"

**Symptom:** Render `/health` returns 200, but the live Vercel site shows
"Failed to fetch" or similar.

**Diagnose:** open browser DevTools → Network → click any API call →
check the request URL. If it's `https://localhost:8000/...` or some
old URL, the frontend bundle has a stale `NEXT_PUBLIC_API_BASE_URL`.

**Fix:** Vercel dashboard → Settings → Environment Variables → update
`NEXT_PUBLIC_API_BASE_URL` → **Deployments → ⋯ → Redeploy**.

---

## "Browser console: 'CORS policy: No Access-Control-Allow-Origin'"

**Symptom:** direct curl works fine, but browser blocks the request.

**Diagnose:** `curl -i -X OPTIONS https://<render-url>/api/incidents -H "Origin: https://<vercel-url>"`. Look for `access-control-allow-origin:` in the response.

**Fix:** Render → your service → **Environment** → set `ALLOWED_ORIGINS` to
your Vercel URL **with no trailing slash**. Render auto-redeploys in ~2 min.

Common typos:
- `https://incident-stories.vercel.app/` ← trailing slash breaks it
- `incident-stories.vercel.app` ← missing `https://`
- `*` ← works but blocks credentials; don't use this in prod

---

## "First request after idle takes 30-60s then succeeds"

**Not a bug.** Render free instances sleep after 15 min of no traffic.
The first request after sleep wakes the instance (~30-60s on free tier).
Subsequent requests are fast.

**Fix when you outgrow it:**
- $7/mo: Render Starter plan — always warm.
- Free alternative: Fly.io free allowance (always on, ~1s cold start).
- DIY: Better Stack or similar uptime ping every 10 min keeps the instance awake
  (but that burns through your free Render hours faster — do the math).

---

## "API returns 502 Bad Gateway"

**Symptom:** every request fails with 502.

**Diagnose:** Render → your service → Logs. Look for the last few lines
before the failure.

**Common causes:**
- Bad env var (typo in URL, missing service role key) → pydantic validation
  error on startup → container exits → Render returns 502 until you fix and redeploy.
- Out of memory on free tier (512 MB). Your backend uses ~150 MB at idle;
  free models can spike to 300 MB during AI generation. If you see OOM kills
  in the logs, upgrade to Render Starter ($7/mo, 512 MB still) or
  reduce `REQUEST_TIMEOUT_SECONDS`.

**Fix:** fix the env, click **Manual Deploy → Deploy latest commit**, watch
the logs turn green.

---

## "Backend works but admin queue is empty / submit never appears"

**Symptom:** `POST /api/incidents` returns 202 with an id, but `/admin/incidents?status=pending` returns `items: []`.

**Diagnose:** Render logs → search for `Background AI processing failed for <id>`. If you see `LLMError` or HTTP 429, the AI generation crashed.

**Common causes:**
- **OpenRouter 429 rate limit:** the `:free` model is shared across all
  OpenRouter users and hits per-minute caps. Switch `LLM_MODEL` to another
  free model from `frontend/lib/freeModels.ts` and redeploy.
- **OpenRouter key invalid / revoked:** Rotate the key in OpenRouter
  dashboard, update `LLM_API_KEY` on Render. Render auto-restarts.
- **Supabase service role key wrong:** Render logs will show a supabase
  Auth error. Re-paste from Supabase → Settings → API → service_role.

**Important:** even when the AI fails, the raw submission is saved
as `pending` so an admin can see it. If the queue is empty AND the AI
logs are clean, the request never reached the backend — check
`NEXT_PUBLIC_API_BASE_URL` on Vercel first.

---

## "Vercel shows 'Build Failed' with 'NEXT_PUBLIC_SUPABASE_URL is not defined'"

**Symptom:** Vercel deploy fails at `next build` time.

**Diagnose:** Vercel → Deployments → click the failed build → "Build Logs".

**Fix:** Settings → Environment Variables → add the missing `NEXT_PUBLIC_*`
var → redeploy. Next.js refuses to build a page that references an
undefined `process.env.NEXT_PUBLIC_*`.

---

## "Vercel deploy succeeds but the env var is clearly not updated"

**Symptom:** you changed `NEXT_PUBLIC_API_BASE_URL` an hour ago and saved
it, but the live site still calls the old URL.

**Diagnose:** Vercel → Deployments → check the timestamp of the latest
deployment. If it's older than when you saved the env var, you forgot
to redeploy.

**Fix:** Deployments → click the latest → ⋯ → **Redeploy**.

This is the #1 cause of "my env var change did nothing" reports. Vercel
treats env saves as cheap and doesn't trigger a build.

---

## "OpenRouter 429 Too Many Requests in Render logs"

**Symptom:** `LLMError: LLM provider returned 429` in Render logs.
Public submits succeed but the AI generation fails.

**Fix:** swap to a different free model:

| Model | Context | Speed |
|---|---|---|
| `meta-llama/llama-3.3-70b-instruct:free` (default) | 131K | Fast |
| `qwen/qwen3-next-80b-a3b-instruct:free` | 262K | Slower |
| `google/gemma-4-31b-it:free` | 262K | Medium |
| `openai/gpt-oss-120b:free` | 131K | Fast |

Render → service → Environment → edit `LLM_MODEL` → save → auto-redeploys.

Or upgrade to OpenRouter's paid tier ($5 minimum) for higher rate limits.

---

## "Curl works locally but not from Render"

**Symptom:** `curl https://supabase.co/...` from your Mac works, but
backend on Render can't reach Supabase.

**Diagnose:** unlikely (Supabase is on the public internet). More
likely: the URL in `SUPABASE_URL` has a typo or trailing `/rest/v1/`.
It must be exactly `https://<project-ref>.supabase.co` with no path.

**Fix:** Supabase dashboard → Settings → API → Project URL → copy
verbatim → update `SUPABASE_URL` on Render.

---

## "I need to rollback a deploy"

**Frontend:** Vercel → Deployments → find a green one before the broken
deploy → ⋯ → **Promote to Production**. Takes ~10 seconds.

**Backend:** Render → your service → top-right **"Manual Deploy" → "Deploy
latest commit"** for the previous good commit, OR click **Rollback** to
pick from Render's deploy history. Takes ~2-3 min.

**DB migration:** If you ran a migration that broke production and you
have a reverse migration, run it in Supabase SQL Editor. For 0004 (rename
tldr), the reverse is:
```sql
alter table public.incident_versions rename column summary to tldr;
```
Then also revert `backend/app/schemas.py` (rename `summary` back to
`tldr`) and redeploy. **Don't do this unless you have to** — the new
schema is the source of truth going forward.

---

## "Supabase connection: 'Tenant or user not found'"

**Diagnose:** `SUPABASE_URL` env var has the wrong project ref.

**Fix:** Open Supabase → Settings → API → confirm your project ref
(e.g. `oydbjkhudtvseqvgdhy`). The URL must be
`https://<that-ref>.supabase.co`. Update Render env, redeploy.

---

## "Everything works but submits are slow (10-30s before returning)"

**Diagnose:** AI generation. OpenRouter's free models are slow during peak hours.

**Fix:** none at the architecture level — that's the cost of free. Either
accept the latency, swap to a faster paid model, or upgrade OpenRouter to
their $5 minimum for priority routing.

The frontend already shows a "queued" state with a spinner during this wait,
so users see feedback even if it takes 20s.

---

## Useful one-liners

```bash
# Last 100 lines of Render logs (from your machine, with the render CLI installed):
render logs -r incident-stories-api --tail 100

# Or hit Render's log streaming URL directly:
curl -N https://api.render.com/v1/services/<service-id>/logs \
  -H "Authorization: Bearer <your-render-api-key>"

# Check if your Supabase project is up:
curl -fsS https://oydbjkhudtvseqvgdhy.supabase.co/auth/v1/health

# Tail Vercel deploy logs:
vercel logs <deployment-url> --follow
```
