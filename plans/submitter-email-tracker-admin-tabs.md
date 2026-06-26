# Plan: Submitter email + Resend notifications + status tracker + admin tabs

**Date:** 2026-06-27
**Status:** Implemented

## Context

The "submit with story + optional title, save immediately, run LLM in background, admin approval" flow was already built end-to-end. The user asked to:

1. Accept the submission with story + (optional) title and save it immediately, then run the LLM in the background to create the polished post.
2. Add an admin approval dashboard where admins can approve/reject posts; only approved posts are public.

Both flows already existed. The user then expanded scope to include:

- **Submitter email** (required on submit) used to notify on approve/reject.
- **Resend email** notifications when posts are approved or rejected.
- **Submitter status tracker** so anonymous submitters can come back and check the status of their post.
- **Admin dashboard tabs** for Pending / Approved / Rejected, with an "Un-reject" action.

After asking clarifying questions, the decisions were:
- Anonymous submission (no login required).
- Email **required** on submit.
- Tracker access: show the incident ID + email with copy buttons on the submit success screen (no login, no magic link).
- Notifications: email via Resend.
- Admin: Pending / Approved / Rejected tabs.

## Plan

### 1. Required submitter email (backend + frontend)
- `backend/app/schemas.py`: add `email: EmailStr` (required) to `IncidentCreate`.
- `backend/app/db.py`: extend `create_pending_incident` to accept `submitted_email` and persist it.
- `backend/supabase/migrations/0002_submitter_email.sql`: add `submitted_email text NOT NULL` + index, with a backfill for existing rows.
- `frontend/app/submit/page.tsx`: required email input with helper text. Client-side validation gates the Submit button. Email stored in `localStorage` on success.

### 2. Resend email client (new module)
- `backend/app/email.py` (new): `EmailClient` class with `send_approved` and `send_rejected`. Lazy-init — if `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is empty, sends are logged no-ops (local dev without Resend still works). Failures are logged at WARN and never roll back an approval or rejection.
- `backend/app/config.py`: add `resend_api_key`, `resend_from_email`, `public_site_url` settings (all optional).
- `backend/app/deps.py`: add `get_email` dependency provider.
- `backend/app/routes/admin.py`: on approve, fire-and-forget `send_approved` with the submitter's email, title, and slug (to build the public link). On reject, fire-and-forget `send_rejected` with title + reason.
- `backend/.env.example`: document the new env vars.

### 3. Submitter status tracker (backend endpoint + frontend page)
- `backend/app/routes/incidents.py`: new `POST /api/incidents/{id}/status`. Body is `{ "email": "..." }`. Returns the minimal `IncidentStatusResponse` (id, status, title, slug, created_at, approved_at, rejection_reason) **only if** the email matches `submitted_email` (case-insensitive). Returns 404 for both unknown id and email mismatch — we don't leak which side is wrong.
- `backend/app/db.py`: new `get_status_for_submitter(id, email)` helper.
- `backend/app/schemas.py`: new `IncidentStatusResponse` and `StatusLookup` models.
- `frontend/lib/types.ts`: new `IncidentStatus` type.
- `frontend/lib/api.ts`: new `getStatus(id, email)` method.
- `frontend/app/track/page.tsx` (new): client page with a form (incident ID + email). Auto-fills from `localStorage` + `?prefill=` query param. Shows different visuals for pending / approved (with link to live story) / rejected (with admin reason).
- `frontend/components/SiteHeader.tsx`: add "Track" nav item.
- Submit success screen now shows the incident ID and email with Copy buttons + a deep link `/track?prefill=<id>`.

### 4. Admin dashboard tabs (frontend refactor)
- `frontend/app/admin/page.tsx`: refactored into a single page with three tabs (Pending / Approved / Rejected). Each tab uses the existing `api.listAdmin(status, ...)` and shows a per-tab count.
- Per-card actions depend on tab:
  - **Pending**: Approve / Reject (with optional reason) / Regenerate.
  - **Approved**: Regenerate + "View live" link.
  - **Rejected**: Reopen → back to pending / Regenerate. The rejection reason is shown prominently.
- `frontend/lib/api.ts`: new `reopen(id, token)` method.
- `backend/app/routes/admin.py`: new `POST /api/admin/incidents/{id}/reopen` (sets status=pending, clears moderation_notes).
- `backend/app/db.py`: new `reopen_incident` helper.

### 5. Documentation
- `CLAUDE.md`: updated env vars section, data model (added `submitted_email`), API surface (new endpoints), added "Email notifications (Resend)" section.
- `README.md`: added submitter flow walkthrough, added Resend to the stack.

## Files touched

**Backend (modified):**
- `backend/app/schemas.py`
- `backend/app/db.py`
- `backend/app/config.py`
- `backend/app/deps.py`
- `backend/app/routes/admin.py`
- `backend/app/routes/incidents.py`
- `backend/.env.example`

**Backend (new):**
- `backend/app/email.py`
- `backend/supabase/migrations/0002_submitter_email.sql`

**Frontend (modified):**
- `frontend/lib/types.ts`
- `frontend/lib/api.ts`
- `frontend/app/submit/page.tsx`
- `frontend/app/admin/page.tsx`
- `frontend/components/SiteHeader.tsx`

**Frontend (new):**
- `frontend/app/track/page.tsx`

**Docs:**
- `CLAUDE.md`
- `README.md`

## Out of scope

- Subscriber login / accounts (anonymous submission chosen).
- Edit-after-submit by the submitter.
- Server-side rate limiting.
- Editing the LLM prompt.

---

## Implementation summary

Everything in the plan above was implemented and verified.

### Verification results

| Check | Result |
|-------|--------|
| Backend `ruff check app` | ✔ clean (1 pre-existing `threading` F401 unrelated to this change) |
| Backend modules compile (`py_compile`) | ✔ all 8 modules clean |
| Frontend `npm run lint` | ✔ no ESLint warnings or errors |
| Frontend `npm run build` | ✔ all 7 routes compile + type-check |
| Build hangs on `/` with `localhost:8000`? | Pre-existing — only happens when `NEXT_PUBLIC_API_BASE_URL` points to a host with no backend running. Reproduced both with and without these changes. Setting it to a non-existent host makes the build fast again. |

### Final route list (from build output)

```
○ /                       176 B   94.2 kB
○ /_not-found              141 B  87.4 kB
○ /admin                 7.59 kB   139 kB
○ /admin/login            2.65 kB   134 kB
ƒ /stories/[slug]         1.45 kB  95.4 kB
○ /submit                 7.61 kB   102 kB
○ /track                  4.71 kB  98.7 kB  ← new
```

### Backend endpoint surface (after)

Public:
- `POST /api/incidents` — submit raw text + email + optional title; returns 202 immediately; AI runs in background.
- `GET /api/incidents?page=&page_size=` — list approved.
- `GET /api/incidents/{slug}` — detail of one approved.
- `POST /api/incidents/{id}/status` — **(new)** submitter status lookup, gated by email.

Admin (Bearer JWT + `is_admin`):
- `GET /api/admin/incidents?status=pending|approved|rejected`
- `POST /api/admin/incidents/{id}/approve` — sends Resend email
- `POST /api/admin/incidents/{id}/reject` — sends Resend email
- `POST /api/admin/incidents/{id}/reopen` — **(new)** move rejected/approved back to pending
- `POST /api/admin/incidents/{id}/regenerate`

### Deployment steps

1. Apply `backend/supabase/migrations/0002_submitter_email.sql` to the Supabase project.
2. Add the following to Render env vars (and to local `backend/.env`):
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` (e.g. `Incident Stories <noreply@yourdomain.com>`)
   - `PUBLIC_SITE_URL` (e.g. `https://incident-stories.vercel.app`)
3. Resend is optional — if the env vars are missing, approve/reject still work, they just don't send email (logged warning on startup).

### Notes

- All new email sending is best-effort: failures are logged at WARN and never affect the admin action's success.
- The submitter status endpoint deliberately returns 404 for both "unknown id" and "email mismatch" so we don't leak which side is wrong.
- `IncidentDetail` and `IncidentList` do not expose `submitted_email` — it's only used internally and in admin queries.
- The pre-existing `app/routes/incidents.py:6` `import threading` F401 was already there before this change and is not addressed by this PR.