# Vercel deploy guide

The frontend is a Next.js 14 app, deployed to Vercel. The repo already has a
working `frontend/Dockerfile` (for Docker-based deploys), but Vercel's native
Next.js support is what we use in production — it builds with `next build`
and serves via Vercel's edge network. No Docker involved.

---

## Initial setup (only once per project)

1. Go to https://vercel.com/new and **Import** your GitHub repo.
2. Vercel detects Next.js automatically. Confirm:
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend` *(critical — if you leave it as `.`, Vercel
     builds the whole monorepo and fails)*
   - **Build Command:** `next build` (default — leave blank)
   - **Output Directory:** `.next` (default — leave blank)
3. Click **Deploy**. The first deploy will fail because the `NEXT_PUBLIC_*`
   env vars aren't set yet — that's expected. Cancel the build or let it
   fail; we're going to set envs first.

## Set the env vars (Step 3 of the deploy guide)

1. Vercel dashboard → your project → **Settings → Environment Variables**.
2. Add three vars. The **Production** column matters most; you can also
   set them for **Preview** if you want preview deploys to work.

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://oydbjkhudtvseqvgdhy.supabase.co` | Same as Render's `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(anon JWT from Supabase)* | **anon** public key, NOT service_role |
| `NEXT_PUBLIC_API_BASE_URL` | *(your Render URL from Step 2)* | **The most common source of deploy bugs.** Should look like `https://incident-stories-api.onrender.com`, no trailing slash. |

3. Click **Save** for each.

## The redeploy trap (READ THIS)

**Vercel does NOT auto-rebuild when you change env vars.** This is by design
(env changes are cheap and frequent during setup; rebuilds are slow).

If you only save the env vars and don't redeploy:
- The live site keeps using the old `NEXT_PUBLIC_*` values baked into
  the previous build.
- Symptoms: site calls a stale backend URL → 404, 502, or CORS error.

**To force the rebuild after saving env vars:**
- **Vercel dashboard → Deployments → click the latest deployment → ⋯ → Redeploy.**
  OR
- Push a no-op commit to `main` (e.g. `git commit --allow-empty -m "trigger rebuild"`).

The new deployment will appear in the Deployments tab with status
"Building" → "Ready". Wait for it to be Ready before running smoke tests.

## Verify the new env is in the bundle

After redeploy completes, open your live Vercel URL, view source, and
search for the Render hostname:

```bash
curl -s https://<your-vercel-url>/ | grep onrender
```

You should see the Render URL inlined in the JS bundle (or in the HTML
as a server-side prop). If you see `localhost:8000` instead, the redeploy
didn't pick up the new env.

## Custom domain (later)

If you want `incidentstories.com` instead of `*.vercel.app`:
1. Vercel → Settings → Domains → add your domain.
2. Add a CNAME record at your DNS provider pointing `incidentstories.com`
   to `cname.vercel-dns.com`.
3. After Vercel provisions the cert (~1 min), update Render's
   `ALLOWED_ORIGINS` to include the new domain and Render auto-redeploys.

## Why Vercel only needs 3 env vars

The Next.js build **only** inlines env vars whose names start with
`NEXT_PUBLIC_`. Everything else (LLM keys, service-role keys, Resend)
stays on the backend in Render. The frontend never has a reason to know
those values exist.

If you ever see a Vercel deployment that's "successfully" deployed but
shows 500 errors on every page, check Vercel → Deployments → click the
build → "Build Logs". The most common cause is a missing
`NEXT_PUBLIC_*` var being referenced in the bundle.
