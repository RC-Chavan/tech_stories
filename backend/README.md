# Backend — Incident Stories API

FastAPI service that:
1. Accepts raw engineer-written incident notes from the public
2. Sends them to a swappable OpenAI-compatible LLM (default: MiniMax M3 cloud)
3. Persists the raw text + the AI-generated STAR story / technical points / TL;DR + moderation flags to Supabase
4. Exposes an admin API for approving, rejecting, and regenerating incidents

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in values
uvicorn app.main:app --reload --port 8000
```

API docs at http://localhost:8000/docs

## Tests

```bash
pytest                   # all
pytest tests/test_x.py   # one file
pytest -k "valid"        # pattern
```

## Lint

```bash
ruff check app tests
```

## Apply the DB migration

In the Supabase SQL editor, paste the contents of `supabase/migrations/0001_init.sql` and run.

Or with psql:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
```

## Promote yourself to admin

After signing in to the frontend once, run in the Supabase SQL editor:

```sql
update public.profiles set is_admin = true where id = '<your-user-uuid>';
```

Find your UUID under Authentication → Users in the Supabase dashboard.