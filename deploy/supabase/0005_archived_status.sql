-- Add 'archived' as a valid incident status. Archived incidents are hidden from
-- the public, removed from pending/approved/rejected tabs, and live in their own
-- admin-only "Archived" tab. Admins can move an archived incident back to
-- pending via /api/admin/incidents/{id}/unarchive (which clears archived_at).
--
-- Two columns:
--   archived_at timestamptz NULL  — set when the incident is archived (preserves
--                                   the original created_at/approved_at). NULL
--                                   when not archived.
--   archived_reason text NULL     — optional free-text note from the admin.
--
-- The CHECK constraint is dropped and recreated because Postgres doesn't
-- support ALTER CHECK in place.

alter table public.incidents
    add column if not exists archived_at timestamptz,
    add column if not exists archived_reason text;

-- Replace the existing status CHECK with one that allows 'archived'.
alter table public.incidents drop constraint if exists incidents_status_check;
alter table public.incidents
    add constraint incidents_status_check
    check (status in ('pending', 'approved', 'rejected', 'archived'));

-- Helpful partial index: archived rows are queried by id and listed in
-- chronological archive order; keep it tight on just the archived set.
create index if not exists incidents_archived_at_idx
    on public.incidents (archived_at desc)
    where status = 'archived';

-- RLS: archived rows must be hidden from public reads. The existing policy
-- already restricts public SELECT to status='approved'. Archived rows fall
-- outside that and are therefore invisible to anon/authenticated users without
-- further changes. (Service-role key bypasses RLS for admin endpoints.)
-- No RLS change needed.