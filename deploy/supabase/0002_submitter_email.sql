-- Add submitter email so we can notify on approve/reject (v2 feature).
-- The submitter proves ownership of an incident by knowing both the id and the email.
-- Email is required at the API layer (Pydantic); we back it with NOT NULL on the table
-- to keep the data honest. Existing rows are backfilled with a placeholder.

alter table public.incidents
    add column if not exists submitted_email text;

-- Backfill any pre-existing rows (none expected in fresh installs; safe either way).
update public.incidents
    set submitted_email = coalesce(submitted_email, 'unknown@unknown.invalid')
    where submitted_email is null;

alter table public.incidents
    alter column submitted_email set not null;

-- Index for the lookup path used by the public /status endpoint.
create index if not exists incidents_email_idx
    on public.incidents (submitted_email);