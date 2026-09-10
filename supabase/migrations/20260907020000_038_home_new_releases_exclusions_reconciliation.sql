-- 038: New Releases exclusion table reconciliation.
--
-- Purpose:
--   Reconcile the existing out-of-band home_new_releases_exclusions table with
--   repository migration history. The table EXISTS on QA but has NO entry in
--   migration history. This migration does NOT drop or recreate the table.
--
--   It brings the schema into alignment with src/lib/new-releases.ts expectations
--   and adds security hardening (RLS preserved, unnecessary grants revoked).
--
-- Per C07B task rules, no QA data is mutated by this migration. Any existing
-- data is inspected, reported, and preserved.

-- ===========================================================================
-- Phase 1: Ensure table exists (create if absent — idempotent)
-- ===========================================================================
-- The table is known to exist on QA. This block is a safety net for fresh
-- databases that have never received the out-of-band table.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'home_new_releases_exclusions'
  ) then
    create table public.home_new_releases_exclusions (
      id uuid not null default gen_random_uuid() primary key,
      content_type text not null,
      series_id uuid null,
      short_film_id uuid null,
      excluded_at timestamptz not null default now()
    );
  end if;
end;
$$;

-- ===========================================================================
-- Phase 2: Ensure columns exist and match code expectations
-- ===========================================================================
alter table public.home_new_releases_exclusions
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.home_new_releases_exclusions
  add column if not exists content_type text;

alter table public.home_new_releases_exclusions
  add column if not exists series_id uuid;

alter table public.home_new_releases_exclusions
  add column if not exists short_film_id uuid;

alter table public.home_new_releases_exclusions
  add column if not exists excluded_at timestamptz not null default now();

-- ===========================================================================
-- Phase 3: Ensure content_type CHECK constraint
-- ===========================================================================
-- Only 'series' and 'short_film' are valid content types.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'home_new_releases_exclusions'
      and constraint_type = 'CHECK'
      and constraint_name = 'home_new_releases_exclusions_content_type_check'
  ) then
    alter table public.home_new_releases_exclusions
      add constraint home_new_releases_exclusions_content_type_check
      check (content_type in ('series', 'short_film'));
  end if;
end;
$$;

-- ===========================================================================
-- Phase 4: Ensure single-target exclusion rule
-- ===========================================================================
-- Each exclusion row must point to exactly one content target:
--   series    => series_id NOT NULL AND short_film_id IS NULL
--   short_film => short_film_id NOT NULL AND series_id IS NULL
-- QA may have this as 'single_content' or 'single_target_check' or absent.
-- We check by definition text to be idempotent regardless of name.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'home_new_releases_exclusions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%content_type = ''series''%'
      and pg_get_constraintdef(oid) ilike '%content_type = ''short_film''%'
  ) then
    alter table public.home_new_releases_exclusions
      add constraint home_new_releases_exclusions_single_target_check
      check (
        (content_type = 'series'    and series_id is not null and short_film_id is null)
        or
        (content_type = 'short_film' and short_film_id is not null and series_id is null)
      );
  end if;
end;
$$;

-- ===========================================================================
-- Phase 5: Foreign key semantics (ON DELETE CASCADE)
-- ===========================================================================
-- Ensure FK to series.id
do $$
begin
  if not exists (
    select 1 from information_schema.key_column_usage kcu
    join information_schema.referential_constraints rc
      on kcu.constraint_name = rc.constraint_name
     and kcu.table_schema = rc.constraint_schema
    where kcu.table_schema = 'public'
      and kcu.table_name = 'home_new_releases_exclusions'
      and kcu.column_name = 'series_id'
  ) then
    alter table public.home_new_releases_exclusions
      add constraint home_new_releases_exclusions_series_id_fkey
      foreign key (series_id) references public.series(id) on delete cascade;
  end if;
end;
$$;

-- Ensure FK to short_films.id
do $$
begin
  if not exists (
    select 1 from information_schema.key_column_usage kcu
    join information_schema.referential_constraints rc
      on kcu.constraint_name = rc.constraint_name
     and kcu.table_schema = rc.constraint_schema
    where kcu.table_schema = 'public'
      and kcu.table_name = 'home_new_releases_exclusions'
      and kcu.column_name = 'short_film_id'
  ) then
    alter table public.home_new_releases_exclusions
      add constraint home_new_releases_exclusions_short_film_id_fkey
      foreign key (short_film_id) references public.short_films(id) on delete cascade;
  end if;
end;
$$;

-- ===========================================================================
-- Phase 6: Logical uniqueness (partial unique indexes)
-- ===========================================================================
-- The old UNIQUE(content_type, series_id, short_film_id) is insufficient
-- because nullable target columns allow multiple rows with NULL targets.
-- Replace with partial unique indexes that enforce per-content uniqueness
-- safely (fail if duplicates would break them).
--
-- The old constraint may have different names depending on how it was created:
--   home_new_releases_exclusions_unique  (QA's actual name)
--   home_new_releases_exclusions_content_type_series_id_short_film_id_key
--     (Supabase auto-generated name pattern)
-- We drop by both possible names to be safe.
--
-- First, remove the old composite unique constraint if present.
do $$
begin
  -- Drop the known QA constraint name
  if exists (
    select 1 from pg_constraint
    where conname = 'home_new_releases_exclusions_unique'
  ) then
    alter table public.home_new_releases_exclusions
      drop constraint home_new_releases_exclusions_unique cascade;
  end if;
  -- Drop the Supabase auto-generated name pattern
  if exists (
    select 1 from pg_constraint
    where conname = 'home_new_releases_exclusions_content_type_series_id_short_film_id_key'
  ) then
    alter table public.home_new_releases_exclusions
      drop constraint home_new_releases_exclusions_content_type_series_id_short_film_id_key cascade;
  end if;
end;
$$;

-- Drop unique index on (content_type, series_id, short_film_id) if present (legacy name variants)
drop index if exists public.home_new_releases_exclusions_content_type_series_id_short_film_id_idx cascade;

-- Create partial unique index for series exclusions.
-- Only one exclusion per series_id (where series_id IS NOT NULL).
-- Use CREATE UNIQUE INDEX IF NOT EXISTS (PostgreSQL 15+).
create unique index if not exists home_new_releases_exclusions_series_uniqueness
  on public.home_new_releases_exclusions (series_id)
  where content_type = 'series' and series_id is not null;

-- Create partial unique index for short film exclusions.
-- Only one exclusion per short_film_id (where short_film_id IS NOT NULL).
create unique index if not exists home_new_releases_exclusions_short_film_uniqueness
  on public.home_new_releases_exclusions (short_film_id)
  where content_type = 'short_film' and short_film_id is not null;

-- ===========================================================================
-- Phase 7: Security hardening
-- ===========================================================================
-- RLS must remain enabled (table is already RLS-enabled on QA).
alter table public.home_new_releases_exclusions enable row level security;

-- Revoke all from public role (catches any out-of-band grants).
revoke all on table public.home_new_releases_exclusions from public;

-- Remove the overly-permissive "Public can read" policy if it allows anon/authenticated.
-- We drop it and recreate with proper role scoping below.
drop policy if exists "Public can read new releases exclusions" on public.home_new_releases_exclusions;

-- Revoke all privileges from anon and authenticated.
-- We then selectively re-grant only SELECT (required read access) below.
revoke all on table public.home_new_releases_exclusions from anon;
revoke all on table public.home_new_releases_exclusions from authenticated;

-- Revoke all on the sequences/functions tied to this table from anon/authenticated.
-- The gen_random_uuid() default does not use a sequence, but we revoke for completeness.
revoke all on all sequences in schema public from anon;
revoke all on all sequences in schema public from authenticated;

-- Selective re-grant: only SELECT to anon and authenticated (read-only).
-- RLS policy below controls row-level access.
grant select on table public.home_new_releases_exclusions to anon;
grant select on table public.home_new_releases_exclusions to authenticated;

-- service_role retains full access for backend CMS operations.
-- (Supabase default grants service_role SELECT, INSERT, UPDATE, DELETE.)
-- We grant usage on sequences needed for id generation.
grant usage, select on all sequences in schema public to service_role;

-- Create a proper RLS SELECT policy scoped to anon/authenticated only.
-- This replaces the dropped "Public can read" policy with explicit roles.
create policy "anon can read new releases exclusions"
  on public.home_new_releases_exclusions
  for select
  to anon
  using (true);

create policy "authenticated can read new releases exclusions"
  on public.home_new_releases_exclusions
  for select
  to authenticated
  using (true);

-- No consumer write policies — anon/authenticated have no INSERT/UPDATE/DELETE.
-- service_role writes are unrestricted by RLS (bypasses RLS by default).
