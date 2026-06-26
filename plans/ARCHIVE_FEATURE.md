# Archive feature

The admin queue has a fourth tab — **Archived** — that holds incidents
removed from the regular workflow without deleting them. Admins can
archive from any tab (pending / approved / rejected) and restore
archived items back to pending.

## Why a separate status

We considered three approaches (see `frontend/app/admin/page.tsx` and
`backend/supabase/migrations/0004_archived_status.sql`):

- **Add `'archived'` to the existing `status` enum** — chosen. Keeps
  the data model flat; the existing partial indexes and RLS policy
  keep working without special-casing.
- **Boolean flag `archived_at IS NOT NULL`** — rejected because it
  would force every read to add `AND archived_at IS NULL` to the
  public, admin, and per-tab queries, and `status='archived'` is
  harder to reason about than `status='approved'`.
- **Soft delete only** — rejected because the regular tabs already
  have their own status values; adding a third dimension complicates
  filtering.

## Schema (`backend/supabase/migrations/0004_archived_status.sql`)

Two new columns on `incidents`:

| Column | Type | Notes |
|---|---|---|
| `archived_at` | `timestamptz` | Set when the incident is archived. NULL when not archived. Lets the Archived tab sort by recency. |
| `archived_reason` | `text` | Optional free-text note from the admin who archived it. |

The status CHECK constraint is replaced (not ALTERed in place — Postgres
doesn't support that) with:

```sql
check (status in ('pending', 'approved', 'rejected', 'archived'))
```

A partial index on archived rows keeps the Archived tab fast:

```sql
create index incidents_archived_at_idx
    on public.incidents (archived_at desc)
    where status = 'archived';
```

**Apply with:**

```bash
psql "$SUPABASE_DB_URL" -f backend/supabase/migrations/0004_archived_status.sql
```

The migration is idempotent (`add column if not exists`, `drop constraint if exists`).

## Public visibility

Existing RLS policy already restricts public `SELECT` to
`status = 'approved'`. Archived rows fall outside that and are
**invisible to anon and authenticated users without admin rights**.
No RLS change needed.

The service-role key (used by the backend) bypasses RLS, so admin
endpoints can read and write archived rows freely.

## API surface

All admin endpoints require a Supabase JWT with `is_admin = true`.

| Method | Path | Effect |
|---|---|---|
| `GET`  | `/api/admin/incidents?status=archived` | List archived items, sorted by `archived_at desc`. |
| `POST` | `/api/admin/incidents/{id}/archive`   | Move any incident to archived. Body: `{ "reason": "..." }` (optional). |
| `POST` | `/api/admin/incidents/{id}/unarchive` | Move an archived incident back to `pending`. No body. |

Both archive and unarchive are reversible — they never delete rows or
`incident_versions`. `archived_at` is preserved through unarchive
history if you want a timeline later (currently overwritten on
archive, but the previous status info on `incidents` is preserved
through `approved_at` and `moderation_notes`).

## DB methods (`backend/app/db.py`)

```python
def archive_incident(self, incident_id, reason="") -> None
def unarchive_incident(self, incident_id) -> None
```

`list_admin` switches the sort column to `archived_at` when
`status == "archived"`; everything else sorts by `created_at`.

## Frontend (`frontend/app/admin/page.tsx`)

The admin page now has 4 tabs:

| Tab | Icon | Allowed actions per item |
|---|---|---|
| **Pending**  | `CircleDashed` | Approve, Reject, Regenerate, View live (if approved elsewhere), Archive |
| **Approved** | `CheckCircle2` | Regenerate, View live, Archive |
| **Rejected** | `ShieldX`     | Reopen → back to pending, Regenerate, Archive |
| **Archived** | `Archive`     | Restore → back to pending |

The old "Clear" button was a no-op (it only cleared local form state).
It has been **renamed to "Archive"** and now actually moves the item
to the Archived tab. The icon changed from `Trash2` to `Archive` to
match the new semantics.

## How an item flows

```
         approve
pending ─────────► approved ──► (public stories)
   │                    │
   │                    └─► archived ─► unarchive ─► pending
   ├─► rejected ─► archived
   └─► archived (directly)
```

Archive and unarchive are the only transitions that don't involve an
email notification — they're admin-internal operations.

## Edge cases handled

- **Archive an already-archived item**: backend accepts the request
  (idempotent at the data layer; `archived_at` gets bumped to now).
- **Unarchive an item that wasn't archived**: backend accepts the
  request and writes `archived_at = NULL`. The row's status flips
  to `pending`.
- **Archive a pending item while it's mid-AI-processing**: safe —
  the worker thread uses `db.update_incident_with_ai(...)` which only
  updates `title/slug/moderation_flags` and writes a new version row;
  it doesn't touch `status`. The row remains `archived` with the new
  AI output stored as a version.
- **Public `/api/incidents` listing**: filters by `status='approved'`
  only — archived items never leak to public readers.
- **Submitter status lookup**: returns 404 for archived items because
  `status != 'rejected'` isn't matched for the rejection reason and
  the public `/api/incidents/{slug}` route only returns approved rows.
  Archived items effectively disappear from the submitter's
  perspective. (This is consistent with "archived means gone from
  public view". If you want submitters to see "this was archived",
  add an admin endpoint and update `IncidentStatusResponse`.)

## When NOT to archive

- For content moderation failures (PII, toxicity, off-topic), use
  **Reject** with a reason — the submitter gets an email.
- For duplicates or low-quality submissions, use **Reject**.
- Use **Archive** when:
  - The story is fine but you don't want it on the public site
    (e.g. internal-only detail, NDA-protected system names).
  - You want to remove it from your immediate view but keep it
    recoverable in case the situation changes.
  - You're cleaning up the queue for personal-organization reasons.

## Files touched

- `backend/supabase/migrations/0004_archived_status.sql` (new)
- `backend/app/db.py` — `archive_incident`, `unarchive_incident`,
  `list_admin` sort change
- `backend/app/routes/admin.py` — `/archive`, `/unarchive` routes,
  status regex update
- `frontend/lib/api.ts` — `api.archive`, `api.unarchive`,
  `listAdmin` status type
- `frontend/app/admin/page.tsx` — Archived tab, Archive/Restore
  buttons, badge styling, archived timestamp display