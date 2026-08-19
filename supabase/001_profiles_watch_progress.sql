create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watch_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  series_slug text not null,
  episode_number integer not null check (episode_number > 0),
  position_seconds integer not null default 0 check (position_seconds >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  completed boolean not null default false,
  last_watched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, series_slug, episode_number)
);

create index if not exists watch_progress_user_recent_idx
  on public.watch_progress (user_id, last_watched_at desc);

create index if not exists watch_progress_user_active_recent_idx
  on public.watch_progress (user_id, last_watched_at desc)
  where completed = false;


-- Automatically maintain updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;


drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop trigger if exists set_watch_progress_updated_at on public.watch_progress;

create trigger set_watch_progress_updated_at
before update on public.watch_progress
for each row
execute function public.set_updated_at();


-- Automatically create profile after an auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    display_name,
    avatar_url
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;


drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- Row Level Security
alter table public.profiles enable row level security;
alter table public.watch_progress enable row level security;


-- Profiles policies
drop policy if exists "Users can read their own profile"
on public.profiles;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);


drop policy if exists "Users can create their own profile"
on public.profiles;

create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);


drop policy if exists "Users can update their own profile"
on public.profiles;

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);


-- Watch progress policies
drop policy if exists "Users can read their own watch progress"
on public.watch_progress;

create policy "Users can read their own watch progress"
on public.watch_progress
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "Users can create their own watch progress"
on public.watch_progress;

create policy "Users can create their own watch progress"
on public.watch_progress
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "Users can update their own watch progress"
on public.watch_progress;

create policy "Users can update their own watch progress"
on public.watch_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


drop policy if exists "Users can delete their own watch progress"
on public.watch_progress;

create policy "Users can delete their own watch progress"
on public.watch_progress
for delete
to authenticated
using (auth.uid() = user_id);


-- Grants
grant select, insert, update
on public.profiles
to authenticated;

grant select, insert, update, delete
on public.watch_progress
to authenticated;