# Secrets checklist

Where to fetch every secret you need to paste into Render + Vercel.
Keep this open in a second tab while you fill out the dashboards.

---

## 1. Supabase project URL + keys

Source: https://supabase.com/dashboard/project/oydbjkhudtvseqvgdhy/settings/api

| Secret | Value to copy | Goes to |
|---|---|---|
| **Project URL** | looks like `https://oydbjkhudtvseqvgdhy.supabase.co` | Render `SUPABASE_URL` + Vercel `NEXT_PUBLIC_SUPABASE_URL` (same value both places) |
| **`service_role` (secret)** | long JWT starting with `eyJ...` — full row, including the trailing signature | Render `SUPABASE_SERVICE_ROLE_KEY` only |
| **`anon` (public)** | long JWT starting with `eyJ...` — different signature than service_role | Vercel `NEXT_PUBLIC_SUPABASE_ANON_KEY` only |

⚠️  **Never paste `service_role` into Vercel.** It bypasses Row Level Security — anyone
who loads the JS bundle would have admin DB access. The frontend only needs the
`anon` key, which is safe to expose because RLS protects every table.

If the dashboard hides the values behind a 👁 toggle, click it once to reveal,
copy, then paste into Render with the Secret toggle on (so the value is masked
in Render's dashboard view too).

---

## 2. OpenRouter API key

Source: https://openrouter.ai/keys

If you don't have an account:
1. Sign up with Google/GitHub (free).
2. **Keys** → **Create Key** → name it "incident-stories" → copy the key
   (starts with `sk-or-v1-...`).
3. Free tier gives ~50 requests/minute across all `:free` models, enough for
   hobby/demo use.

| Secret | Goes to |
|---|---|
| `sk-or-v1-...` | Render `LLM_API_KEY` (mark as Secret) |

`LLM_BASE_URL` is always `https://openrouter.ai/api/v1` — no need to fetch.

`LLM_MODEL` is just a string id from https://openrouter.ai/models. Free models end
in `:free`. Production-tested options:
- `meta-llama/llama-3.3-70b-instruct:free` (default, balanced)
- `qwen/qwen3-next-80b-a3b-instruct:free` (slower but larger context)
- `google/gemma-4-31b-it:free` (262K context)

---

## 3. Vercel URL (you don't "fetch" it — you read it from Vercel)

After your Vercel project is set up, the URL is at the top of the project
dashboard. Format: `https://<project-name>.vercel.app`. If you attached a custom
domain, that's your public URL instead.

You'll need this for:
- Render `ALLOWED_ORIGINS`
- Render `PUBLIC_SITE_URL`
- (After Render is live, paste the Render URL into Vercel's
  `NEXT_PUBLIC_API_BASE_URL` and redeploy.)

---

## 4. Render URL (same deal — read from Render)

After deploying the backend, Render shows the public URL at the top of the service
dashboard. Format: `https://<service-name>.onrender.com` (default if the name
`incident-stories-api` is available; otherwise Render appends a suffix like
`incident-stories-api-xyz1`).

You'll need this for:
- Vercel `NEXT_PUBLIC_API_BASE_URL`
- Smoke test script (`RENDER_URL=...`)

---

## Quick checklist to tape to your monitor

```
[ ] Supabase URL                → Render SUPABASE_URL + Vercel NEXT_PUBLIC_SUPABASE_URL
[ ] Supabase service_role       → Render SUPABASE_SERVICE_ROLE_KEY    [Secret]
[ ] Supabase anon               → Vercel NEXT_PUBLIC_SUPABASE_ANON_KEY
[ ] OpenRouter key              → Render LLM_API_KEY                   [Secret]
[ ] OpenRouter model id         → Render LLM_MODEL (string, not secret)
[ ] Vercel URL                  → Render ALLOWED_ORIGINS (after Vercel redeploy)
[ ] Render URL                  → Vercel NEXT_PUBLIC_API_BASE_URL + trigger redeploy

Skipped for now:
[ ] Resend API key              → Render RESEND_API_KEY                [Secret]
[ ] Resend verified domain      → Render RESEND_FROM_EMAIL
```
