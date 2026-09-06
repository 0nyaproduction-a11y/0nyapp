-- M6B — Quarantine + explicit authorized delete executor foundation.
--
-- Creates the four retention tables the M6A scanner (media-delete-impact.ts)
-- already reads defensively (RETENTION_TABLES) and treats as "absent" —
-- fail-closed to UNKNOWN — until they exist. Once this migration applies, the
-- scanner's retention domain starts returning authoritative `scanned`
-- provenance instead of `absent`.
--
-- Every table keeps the `media_asset_id` column contract assumed by
-- countRetentionRecords() in src/lib/cms/media-delete-impact.ts (exact-count
-- `.eq("media_asset_id", assetId)` queries against an `id` column). All four
-- tables are service_role-only: no anon/authenticated grants, since every
-- access happens through the server-only CMS admin surface.

create table if not exists public.media_quarantine (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null unique references public.media_assets (id) on delete cascade,
  status text not null default 'quarantined' check (status in ('quarantined', 'released')),
  reason text,
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  released_by uuid references auth.users (id) on delete set null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reason is null or btrim(reason) <> '')
);

create table if not exists public.media_quarantine_log (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets (id) on delete cascade,
  action text not null check (action in ('quarantined', 'released')),
  actor_id uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (notes is null or btrim(notes) <> '')
);

create table if not exists public.media_retention_log (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets (id) on delete cascade,
  reason text not null check (btrim(reason) <> ''),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Append-only audit trail of every authorized delete attempt (successful or
-- not). One row per attempt; `result` records the outcome so the ledger
-- proves what happened even for a blocked/failed attempt. Never updated after
-- insert except to append the post-delete verification outcome.
create table if not exists public.media_deletion_ledger (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null,
  actor_id uuid references auth.users (id) on delete set null,
  classification_at_execution text not null
    check (classification_at_execution in (
      'SAFE', 'REPLACE_FIRST', 'BLOCKED', 'SHARED', 'RETENTION_PROTECTED', 'UNKNOWN'
    )),
  result text not null default 'attempted'
    check (result in ('attempted', 'succeeded', 'failed', 'blocked')),
  supabase_deleted boolean not null default false,
  mux_deleted boolean not null default false,
  mux_asset_reference text,
  error_message text,
  verified_at timestamptz,
  verification_result text
    check (verification_result is null or verification_result in ('verified', 'discrepancy')),
  created_at timestamptz not null default now(),
  check (error_message is null or btrim(error_message) <> '')
);

create index if not exists media_quarantine_log_media_asset_id_idx
  on public.media_quarantine_log (media_asset_id);

create index if not exists media_retention_log_media_asset_id_idx
  on public.media_retention_log (media_asset_id);

create index if not exists media_deletion_ledger_media_asset_id_idx
  on public.media_deletion_ledger (media_asset_id);

drop trigger if exists set_media_quarantine_updated_at on public.media_quarantine;
create trigger set_media_quarantine_updated_at
before update on public.media_quarantine
for each row
execute function public.set_updated_at();

alter table public.media_quarantine enable row level security;
alter table public.media_quarantine_log enable row level security;
alter table public.media_retention_log enable row level security;
alter table public.media_deletion_ledger enable row level security;

revoke all on public.media_quarantine from anon, authenticated;
revoke all on public.media_quarantine_log from anon, authenticated;
revoke all on public.media_retention_log from anon, authenticated;
revoke all on public.media_deletion_ledger from anon, authenticated;

grant all on public.media_quarantine to service_role;
grant all on public.media_quarantine_log to service_role;
grant all on public.media_retention_log to service_role;
grant all on public.media_deletion_ledger to service_role;

comment on table public.media_quarantine is
  'M6B current quarantine/review state per media asset. CMS admin only, service_role access.';
comment on table public.media_quarantine_log is
  'M6B append-only quarantine state transition history.';
comment on table public.media_retention_log is
  'M6B retention-hold history (e.g. legal hold) that permanently protects an asset from deletion.';
comment on table public.media_deletion_ledger is
  'M6B append-only audit trail of every authorized delete attempt (Supabase + Mux), including post-delete verification.';
