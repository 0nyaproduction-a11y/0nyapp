-- Repair CMS admin authorization foundation.
-- Migration 020 is recorded remotely, but public.cms_admins is absent.

create table if not exists public.cms_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.cms_admins enable row level security;

revoke all on public.cms_admins from anon, authenticated;

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
