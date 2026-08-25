-- CMS Phase 1: minimal admin authorization storage.
--
-- Deliberately separate from public.profiles so admin status is never
-- returned by the existing "select your own profile" consumer flows.
-- No anon/authenticated grants are made: this table is only readable via
-- the SECURITY DEFINER helper below or the server-only admin client.
create table if not exists public.cms_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.cms_admins enable row level security;

-- Supabase grants ALL on new public tables to anon/authenticated via
-- default privileges; revoke that explicitly since no policy below
-- grants row access to those roles.
revoke all on public.cms_admins from anon, authenticated;

-- Checks the CURRENT session only (auth.uid()), so it can never be used
-- to probe whether some other arbitrary user is an admin.
create or replace function public.is_cms_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cms_admins
    where public.cms_admins.user_id = auth.uid()
  );
$$;

revoke all on function public.is_cms_admin() from public;
grant execute on function public.is_cms_admin() to authenticated;
