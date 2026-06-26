# Supabase migrations for production

These are the SQL files to run against your Supabase project **before** the
backend deploys. Each file is idempotent where possible (uses `if not exists`)
so re-running is safe.

The originals live in `backend/supabase/migrations/`. This folder is a
**snapshot** for deploys — if you change a migration, update both places
(or add a new `00NN_*.sql` here and bump this README's run order).

---

## Run order

Apply them in this exact order. Each one builds on the previous schema.

```
0001_init.sql                  ← base tables, RLS, profile auto-create
0002_submitter_email.sql       ← NOT NULL submitted_email column + index
0003_thinking_notes.sql        ← incident_versions.thinking_notes (LLM reasoning)
0004_rename_tldr_to_summary.sql ← rename incident_versions.tldr → summary
0005_archived_status.sql       ← 'archived' status + archived_at/_reason columns
```

If you're on a fresh Supabase project: run all 5.
If you're upgrading from a v0 install: 0001-0003 were applied earlier;
start at 0004.

---

## How to apply

### Option A — Supabase SQL Editor (recommended for one-time deploys)

1. Open https://supabase.com/dashboard/project/<your-project>/sql/new
2. Paste the contents of `0001_init.sql` → click **Run** (or Cmd/Ctrl+Enter).
3. Expected: green "Success. No rows returned" banner.
4. Repeat for 0002, 0003, 0004, 0005.
5. After all 5, sanity-check in the **Table Editor**:
   - `incidents` table has columns: `id`, `slug`, `title`, `raw_text`, `status`,
     `moderation_flags`, `moderation_notes`, `submitted_email`, `created_at`,
     `approved_at`, `archived_at`, `archived_reason`.
   - `incident_versions` table has columns: `id`, `incident_id`, `star`,
     `technical_points`, `summary` (not `tldr`!), `thinking_notes`, `created_at`.

### Option B — psql (recommended for CI / scripted deploys)

If you have `SUPABASE_DB_URL` set (the direct Postgres connection string
from Supabase → Settings → Database → Connection string → URI):

```bash
export SUPABASE_DB_URL="postgresql://postgres:PASSWORD@db.<project-ref>.supabase.co:5432/postgres"

for f in deploy/supabase/00*.sql; do
  echo "==> Applying $f"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

`ON_ERROR_STOP=1` aborts the loop on first error so you don't silently
half-apply a migration.

---

## Verifying after running

Run these in the SQL Editor to confirm the schema matches the app's expectations:

```sql
-- Should show 12 columns (incl. archived_*)
select column_name, data_type
from information_schema.columns
where table_name = 'incidents'
order by ordinal_position;

-- Should show 'summary' (NOT 'tldr')
select column_name, data_type
from information_schema.columns
where table_name = 'incident_versions'
order by ordinal_position;

-- Should show 4 valid status values
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.incidents'::regclass
  and conname = 'incidents_status_check';
```

If `0004_rename_tldr_to_summary.sql` failed with
`column "tldr" does not exist`, you've already run it. Safe to skip.
