-- 038_notification_deliveries.sql
-- N03 Notification Delivery Engine Foundation
-- Creates notification_deliveries table with strict RLS (service/backend controlled).

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  push_device_id uuid references public.push_devices(id) on delete set null,
  provider text not null default 'expo',
  provider_ticket_id text,
  status text not null check (status in ('PENDING', 'SENT', 'ACCEPTED', 'DELIVERED', 'FAILED', 'INVALID_TOKEN')),
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now(),
  receipt_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for notification_deliveries
create index if not exists idx_notification_deliveries_notification_id
  on public.notification_deliveries (notification_id);

create index if not exists idx_notification_deliveries_user_status
  on public.notification_deliveries (user_id, status);

create index if not exists idx_notification_deliveries_ticket_id
  on public.notification_deliveries (provider_ticket_id)
  where provider_ticket_id is not null;

create index if not exists idx_notification_deliveries_pending_receipt
  on public.notification_deliveries (status, attempted_at)
  where status in ('SENT', 'PENDING') and provider_ticket_id is not null;

-- RLS for notification_deliveries
alter table public.notification_deliveries enable row level security;

-- Users may view their own delivery records (for troubleshooting / info if needed)
drop policy if exists "Users can read own notification deliveries" on public.notification_deliveries;
create policy "Users can read own notification deliveries"
  on public.notification_deliveries
  for select
  to authenticated
  using (user_id = auth.uid());

-- Clients must NOT be able to insert, update, or delete notification_deliveries
revoke insert, update, delete on public.notification_deliveries from anon, authenticated;
grant select on public.notification_deliveries to authenticated;
