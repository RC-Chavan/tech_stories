-- Incident Stories schema. Run once in the Supabase SQL editor or via psql.

-- =========================================================================
-- profiles: extends auth.users with an is_admin flag
-- =========================================================================
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    is_admin boolean not null default false,
    created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, is_admin)
    values (new.id, false)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- =========================================================================
-- incidents: one row per submission. raw_text is preserved for admin review.
-- =========================================================================
create table if not exists public.incidents (
    id uuid primary key default gen_random_uuid(),
    slug text not null,
    title text not null,
    raw_text text not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    moderation_flags jsonb not null default '{}'::jsonb,
    moderation_notes text,
    created_at timestamptz not null default now(),
    approved_at timestamptz
);

create unique index if not exists incidents_slug_unique on public.incidents (slug);
create index if not exists incidents_status_created_idx on public.incidents (status, created_at desc);
create index if not exists incidents_approved_at_idx on public.incidents (approved_at desc) where status = 'approved';

-- =========================================================================
-- incident_versions: history of AI generations. Latest row is the current version.
-- =========================================================================
create table if not exists public.incident_versions (
    id uuid primary key default gen_random_uuid(),
    incident_id uuid not null references public.incidents(id) on delete cascade,
    star jsonb not null,
    technical_points jsonb not null,
    tldr text not null,
    created_at timestamptz not null default now()
);

create index if not exists incident_versions_incident_idx
    on public.incident_versions (incident_id, created_at desc);

-- =========================================================================
-- Row-level security
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_versions enable row level security;

-- profiles: a user can read their own profile; admins can read all
create policy "users read own profile"
    on public.profiles for select
    using (auth.uid() = id);

-- incidents: public can read only approved rows; writes are done by the
-- backend service-role (bypasses RLS) — so no public write policies here.
create policy "public reads approved incidents"
    on public.incidents for select
    using (status = 'approved');

-- incident_versions: public can read versions of approved incidents only.
-- We join via the parent incident.
create policy "public reads versions of approved incidents"
    on public.incident_versions for select
    using (
        exists (
            select 1 from public.incidents i
            where i.id = incident_versions.incident_id
              and i.status = 'approved'
        )
    );

-- =========================================================================
-- Helper: promote a user to admin (run manually after first sign-in)
-- =========================================================================
-- update public.profiles set is_admin = true where id = '<your-user-uuid>';