-- Adds the minimal account-scoped parental PIN store required for the G02 MVP.
-- PIN hashes are one-way only; plaintext PINs are never stored.

create table if not exists public.user_parental_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_salt text not null,
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_parental_controls enable row level security;

drop policy if exists "Users can read their parental controls" on public.user_parental_controls;
create policy "Users can read their parental controls"
on public.user_parental_controls
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create their parental controls" on public.user_parental_controls;
create policy "Users can create their parental controls"
on public.user_parental_controls
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their parental controls" on public.user_parental_controls;
create policy "Users can update their parental controls"
on public.user_parental_controls
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
