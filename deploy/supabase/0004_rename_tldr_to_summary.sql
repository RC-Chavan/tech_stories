-- 0004_rename_tldr_to_summary.sql
-- Rename the `tldr` column on `incident_versions` to `summary` so the
-- AI contract ("summary") matches the DB column name. Existing rows
-- keep their data — this is a metadata-only rename.
--
-- Run once after 0003_thinking_notes.sql.

alter table public.incident_versions
    rename column tldr to summary;