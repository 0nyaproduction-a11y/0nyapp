-- 037_notification_foundation.sql
-- N01 Notification Foundation & Android Push Token Lifecycle Foundation
-- Creates notifications, push_devices, and notification_preferences tables with strict RLS.

-- A) notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  image_url text,
  deep_link text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Indexes for notifications
create index if not exists idx_notifications_user_created_at
  on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_user_read_at
  on public.notifications (user_id, read_at);

create index if not exists idx_notifications_type
  on public.notifications (type);

-- RLS for notifications
alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can update own notification read status" on public.notifications;
create policy "Users can update own notification read status"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Revoke client insert/delete privileges on notifications
revoke insert, delete on public.notifications from anon, authenticated;
grant select, update (read_at) on public.notifications to authenticated;


-- B) push_devices
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text,
  native_push_token text,
  platform text not null check (platform in ('android', 'ios', 'web')),
  device_id text not null,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_user_device_unique unique (user_id, device_id)
);

-- Indexes for push_devices
create index if not exists idx_push_devices_user_active
  on public.push_devices (user_id, active);

create index if not exists idx_push_devices_expo_token
  on public.push_devices (expo_push_token) where active = true;

-- RLS for push_devices
alter table public.push_devices enable row level security;

drop policy if exists "Users can read own push devices" on public.push_devices;
create policy "Users can read own push devices"
  on public.push_devices
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can register own push devices" on public.push_devices;
create policy "Users can register own push devices"
  on public.push_devices
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own push devices" on public.push_devices;
create policy "Users can update own push devices"
  on public.push_devices
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own push devices" on public.push_devices;
create policy "Users can delete own push devices"
  on public.push_devices
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.push_devices to authenticated;


-- C) notification_preferences
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  promotions boolean not null default true,
  new_releases boolean not null default true,
  account_security boolean not null default true,
  updated_at timestamptz not null default now()
);

-- RLS for notification_preferences
alter table public.notification_preferences enable row level security;

drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
create policy "Users can read own notification preferences"
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
  on public.notification_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.notification_preferences to authenticated;
