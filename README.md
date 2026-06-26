# Incident Stories

A web app where engineers submit rough notes about technical incidents (plus their email), an AI turns them into polished STAR-format writeups with a quick summary, an admin approves them, the submitter gets an email notification, and the public can browse them. Submitters can come back any time to check status using their incident ID + email at `/track`.

## Structure

- `frontend/` — Next.js 14 (App Router) public site + submit form + admin dashboard + `/track` status lookup. Deployed to Vercel.
- `backend/` — FastAPI service. AI processing, moderation, DB writes, Resend email notifications. Deployed to Render.
- `CLAUDE.md` — developer guide for Claude Code (architecture, env vars, AI contract, deploy).

## Quick start

See `CLAUDE.md` for the full developer guide.

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

## Submitter flow

1. Go to `/submit`, paste rough notes, **enter your email** (required — used to notify you on approve/reject), optionally add a title.
2. The raw submission is saved as `pending` and the AI generates the STAR writeup in the background.
3. On the confirmation screen, copy your incident ID + save your email.
4. An admin reviews at `/admin` and either approves (your writeup goes public) or rejects (with a reason).
5. You get a Resend email on either decision. You can also check status any time at `/track` with your ID + email.

## Stack

- Next.js 14, TypeScript, Tailwind CSS
- FastAPI, Pydantic, httpx
- Supabase (Postgres + Auth + RLS)
- Any OpenAI-compatible LLM (default: MiniMax M3 cloud)
- Resend (transactional email) — optional, see `backend/.env`

## License

Private project.