create extension if not exists pgcrypto;

create table if not exists public.guest_parental_controls (
  id uuid primary key default gen_random_uuid(),
  credential_hash text not null unique,
  pin_salt text not null,
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(credential_hash) <> ''),
  check (btrim(pin_salt) <> ''),
  check (btrim(pin_hash) <> '')
);

create table if not exists public.parental_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_parental_control_id uuid references public.guest_parental_controls(id) on delete cascade,
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (user_id is not null and guest_parental_control_id is null)
    or (user_id is null and guest_parental_control_id is not null)
  ),
  check (btrim(token_hash) <> '')
);

create index if not exists guest_parental_controls_credential_hash_idx
  on public.guest_parental_controls (credential_hash);

create index if not exists guest_parental_controls_updated_at_idx
  on public.guest_parental_controls (updated_at desc);

create index if not exists parental_sessions_user_id_idx
  on public.parental_sessions (user_id);

create index if not exists parental_sessions_guest_parental_control_id_idx
  on public.parental_sessions (guest_parental_control_id);

create index if not exists parental_sessions_token_hash_idx
  on public.parental_sessions (token_hash);

create index if not exists parental_sessions_expires_at_idx
  on public.parental_sessions (expires_at);

drop trigger if exists set_guest_parental_controls_updated_at on public.guest_parental_controls;
create trigger set_guest_parental_controls_updated_at
before update on public.guest_parental_controls
for each row
execute function public.set_updated_at();

drop trigger if exists set_parental_sessions_updated_at on public.parental_sessions;
create trigger set_parental_sessions_updated_at
before update on public.parental_sessions
for each row
execute function public.set_updated_at();

alter table public.guest_parental_controls enable row level security;
alter table public.parental_sessions enable row level security;

revoke all on public.guest_parental_controls from anon, authenticated;
revoke all on public.parental_sessions from anon, authenticated;
grant all on public.guest_parental_controls to service_role;
grant all on public.parental_sessions to service_role;

comment on table public.guest_parental_controls is
  'Server-backed pseudonymous guest parental-control records. No guest PII is stored.';

comment on table public.parental_sessions is
  'Opaque server-verifiable parental session tokens for registered and guest parental control flows.';
