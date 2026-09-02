-- PX01-B2E-B1: 0chat acquisition intent + Coin room access binding.
--
-- Source-only additive migration. Do not apply remotely from this session.
-- Implements backend-controlled PX01 commercial config, server-bound
-- acquisition intents, and an atomic Coin acquisition primitive for room-scoped
-- 0chat access. Rewarded config is prepared only; Rewarded acquisition is not
-- operational in this slice.

alter table public.coin_transactions
  add column if not exists play_together_acquisition_intent_id uuid,
  add column if not exists play_together_room_id uuid;

alter table public.coin_transactions
  drop constraint if exists coin_transactions_transaction_type_check;

alter table public.coin_transactions
  add constraint coin_transactions_transaction_type_check
  check (
    transaction_type in (
      'credit',
      'episode_purchase',
      'refund',
      'promo',
      'chai_tip',
      'chai_refund',
      'chai_adjustment',
      'play_together_0chat'
    )
  );

alter table public.coin_transactions
  drop constraint if exists coin_transactions_amount_direction_check;

alter table public.coin_transactions
  add constraint coin_transactions_amount_direction_check
  check (
    (transaction_type = 'episode_purchase' and amount < 0)
    or (transaction_type in ('credit', 'refund', 'promo', 'chai_refund') and amount > 0)
    or (transaction_type = 'chai_tip' and amount < 0)
    or (transaction_type = 'chai_adjustment' and amount <> 0)
    or (transaction_type = 'play_together_0chat' and amount < 0)
  );

create table if not exists public.play_together_commercial_config (
  id text primary key default 'launch' check (id = 'launch'),
  coin_access_enabled boolean not null default true,
  coin_price integer not null default 5 check (coin_price > 0),
  rewarded_access_enabled boolean not null default false,
  required_rewarded_completions integer not null default 1
    check (required_rewarded_completions = 1),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

insert into public.play_together_commercial_config (
  id,
  coin_access_enabled,
  coin_price,
  rewarded_access_enabled,
  required_rewarded_completions
)
values ('launch', true, 5, false, 1)
on conflict (id) do update
set
  coin_access_enabled = excluded.coin_access_enabled,
  coin_price = excluded.coin_price,
  rewarded_access_enabled = excluded.rewarded_access_enabled,
  required_rewarded_completions = excluded.required_rewarded_completions,
  updated_at = now();

alter table public.play_together_commercial_config enable row level security;

revoke all on public.play_together_commercial_config from anon;
revoke all on public.play_together_commercial_config from authenticated;
grant all on public.play_together_commercial_config to service_role;

comment on table public.play_together_commercial_config is
  'Backend-controlled PX01 0chat commercial configuration. Launch values: Coin price 5, Rewarded required completions 1. Not client-authoritative.';

create table if not exists public.play_together_acquisition_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  room_id uuid references public.play_together_rooms (id) on delete cascade,
  invite_id uuid references public.play_together_invites (id) on delete set null,
  target text not null check (target in ('host_create', 'guest_join')),
  method text not null check (method in ('coin', 'rewarded')),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired', 'cancelled')),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  configured_coin_price_snapshot integer check (configured_coin_price_snapshot is null or configured_coin_price_snapshot > 0),
  configured_rewarded_count_snapshot integer check (
    configured_rewarded_count_snapshot is null
    or configured_rewarded_count_snapshot = 1
  ),
  result_status text,
  remaining_balance integer,
  coin_transaction_id uuid references public.coin_transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  check (
    (target = 'host_create' and invite_id is null)
    or (target = 'guest_join' and room_id is not null and invite_id is not null)
  ),
  check (completed_at is null or completed_at >= created_at)
);

create unique index if not exists play_together_acquisition_intents_idempotency_key_idx
  on public.play_together_acquisition_intents (idempotency_key);

create index if not exists play_together_acquisition_intents_user_created_idx
  on public.play_together_acquisition_intents (user_id, created_at desc);

create index if not exists play_together_acquisition_intents_target_idx
  on public.play_together_acquisition_intents (target, method, status, expires_at);

create unique index if not exists play_together_acquisition_intents_one_coin_grant_per_user_room_idx
  on public.play_together_acquisition_intents (user_id, room_id)
  where method = 'coin'
    and status = 'completed'
    and room_id is not null;

alter table public.play_together_acquisition_intents enable row level security;

revoke all on public.play_together_acquisition_intents from anon;
revoke all on public.play_together_acquisition_intents from authenticated;
grant all on public.play_together_acquisition_intents to service_role;

comment on table public.play_together_acquisition_intents is
  'Server-authoritative PX01 acquisition intents. Intent ownership and Host/Guest target binding are server-derived; raw invite tokens are never stored.';

alter table public.coin_transactions
  drop constraint if exists coin_transactions_play_together_acquisition_intent_id_fkey;

alter table public.coin_transactions
  add constraint coin_transactions_play_together_acquisition_intent_id_fkey
    foreign key (play_together_acquisition_intent_id)
    references public.play_together_acquisition_intents (id)
    on delete set null;

alter table public.coin_transactions
  drop constraint if exists coin_transactions_play_together_room_id_fkey;

alter table public.coin_transactions
  add constraint coin_transactions_play_together_room_id_fkey
    foreign key (play_together_room_id)
    references public.play_together_rooms (id)
    on delete set null;

create unique index if not exists coin_transactions_play_together_intent_unique_idx
  on public.coin_transactions (play_together_acquisition_intent_id)
  where transaction_type = 'play_together_0chat'
    and play_together_acquisition_intent_id is not null;

create index if not exists coin_transactions_play_together_room_idx
  on public.coin_transactions (play_together_room_id, created_at desc)
  where transaction_type = 'play_together_0chat';

create or replace function public.get_play_together_commercial_config()
returns table (
  coin_price integer,
  required_rewarded_completions integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.play_together_commercial_config.coin_price,
    public.play_together_commercial_config.required_rewarded_completions
  from public.play_together_commercial_config
  where id = 'launch';
$$;

revoke all on function public.get_play_together_commercial_config() from public;
revoke all on function public.get_play_together_commercial_config() from anon;
revoke all on function public.get_play_together_commercial_config() from authenticated;
grant execute on function public.get_play_together_commercial_config() to service_role;

create or replace function public.create_play_together_acquisition_intent(
  p_user_id uuid,
  p_target text,
  p_method text,
  p_episode_id uuid,
  p_invite_token_hash text,
  p_idempotency_key text
)
returns table (
  success boolean,
  status text,
  intent_id uuid,
  episode_id uuid,
  room_id uuid,
  invite_id uuid,
  target text,
  method text,
  configured_coin_price_snapshot integer,
  configured_rewarded_count_snapshot integer,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_config public.play_together_commercial_config%rowtype;
  v_existing public.play_together_acquisition_intents%rowtype;
  v_intent public.play_together_acquisition_intents%rowtype;
  v_invite public.play_together_invites%rowtype;
  v_room public.play_together_rooms%rowtype;
  v_now timestamptz := now();
  v_episode_id uuid := p_episode_id;
  v_room_id uuid := null;
  v_invite_id uuid := null;
  v_expires_at timestamptz;
begin
  if p_user_id is null
    or p_target not in ('host_create', 'guest_join')
    or p_method not in ('coin', 'rewarded')
    or p_idempotency_key is null
    or btrim(p_idempotency_key) = ''
  then
    return query select false, 'invalid_request'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::integer, null::integer, null::timestamptz;
    return;
  end if;

  select *
  into v_config
  from public.play_together_commercial_config
  where public.play_together_commercial_config.id = 'launch'
  for share;

  if not found then
    return query select false, 'config_unavailable'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::integer, null::integer, null::timestamptz;
    return;
  end if;

  select *
  into v_existing
  from public.play_together_acquisition_intents
  where public.play_together_acquisition_intents.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.user_id <> p_user_id
      or v_existing.target <> p_target
      or v_existing.method <> p_method
      or (
        p_target = 'host_create'
        and v_existing.episode_id is distinct from p_episode_id
      )
    then
      return query select false, 'transaction_conflict'::text, v_existing.id, v_existing.episode_id, v_existing.room_id, v_existing.invite_id, v_existing.target, v_existing.method, v_existing.configured_coin_price_snapshot, v_existing.configured_rewarded_count_snapshot, v_existing.expires_at;
      return;
    end if;

    if p_target = 'guest_join' then
      if p_invite_token_hash is null or p_invite_token_hash !~ '^[0-9a-f]{64}$' then
        return query select false, 'transaction_conflict'::text, v_existing.id, v_existing.episode_id, v_existing.room_id, v_existing.invite_id, v_existing.target, v_existing.method, v_existing.configured_coin_price_snapshot, v_existing.configured_rewarded_count_snapshot, v_existing.expires_at;
        return;
      end if;

      select *
      into v_invite
      from public.play_together_invites
      where public.play_together_invites.token_hash = p_invite_token_hash;

      if not found or v_existing.invite_id is distinct from v_invite.id then
        return query select false, 'transaction_conflict'::text, v_existing.id, v_existing.episode_id, v_existing.room_id, v_existing.invite_id, v_existing.target, v_existing.method, v_existing.configured_coin_price_snapshot, v_existing.configured_rewarded_count_snapshot, v_existing.expires_at;
        return;
      end if;
    end if;

    return query
    select
      true,
      v_existing.status,
      v_existing.id,
      v_existing.episode_id,
      v_existing.room_id,
      v_existing.invite_id,
      v_existing.target,
      v_existing.method,
      v_existing.configured_coin_price_snapshot,
      v_existing.configured_rewarded_count_snapshot,
      v_existing.expires_at;
    return;
  end if;

  if p_target = 'host_create' then
    if p_episode_id is null or p_invite_token_hash is not null then
      return query select false, 'invalid_request'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::integer, null::integer, null::timestamptz;
      return;
    end if;

    if not exists (
      select 1
      from public.episodes
      join public.series on public.series.id = public.episodes.series_id
      where public.episodes.id = p_episode_id
        and public.episodes.status = 'published'
        and (public.episodes.published_at is null or public.episodes.published_at <= v_now)
        and public.series.status = 'published'
    ) then
      return query select false, 'invalid_episode'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::integer, null::integer, null::timestamptz;
      return;
    end if;

    -- Uses the already-approved Play Together room TTL as the maximum pending
    -- host-create intent validity. The final room TTL is still set from the
    -- actual successful room creation timestamp in the Coin RPC below.
    v_expires_at := v_now + interval '6 hours';
  else
    if p_episode_id is not null
      or p_invite_token_hash is null
      or p_invite_token_hash !~ '^[0-9a-f]{64}$'
    then
      return query select false, 'invalid_request'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::integer, null::integer, null::timestamptz;
      return;
    end if;

    select *
    into v_invite
    from public.play_together_invites
    where public.play_together_invites.token_hash = p_invite_token_hash
      and public.play_together_invites.used_at is null
      and public.play_together_invites.revoked_at is null
      and public.play_together_invites.expires_at > v_now
    for share;

    if not found then
      return query select false, 'invite_not_found'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::integer, null::integer, null::timestamptz;
      return;
    end if;

    select *
    into v_room
    from public.play_together_rooms
    where public.play_together_rooms.id = v_invite.room_id
      and public.play_together_rooms.status in ('waiting', 'active', 'waiting_for_access')
      and public.play_together_rooms.expires_at > v_now
    for share;

    if not found then
      return query select false, 'room_not_joinable'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::integer, null::integer, null::timestamptz;
      return;
    end if;

    if v_room.host_user_id = p_user_id then
      return query select false, 'host_cannot_join_as_guest'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::text, null::text, null::integer, null::integer, null::timestamptz;
      return;
    end if;

    v_episode_id := v_room.episode_id;
    v_room_id := v_room.id;
    v_invite_id := v_invite.id;
    v_expires_at := least(v_invite.expires_at, v_room.expires_at);
  end if;

  insert into public.play_together_acquisition_intents (
    user_id,
    episode_id,
    room_id,
    invite_id,
    target,
    method,
    idempotency_key,
    configured_coin_price_snapshot,
    configured_rewarded_count_snapshot,
    expires_at
  )
  values (
    p_user_id,
    v_episode_id,
    v_room_id,
    v_invite_id,
    p_target,
    p_method,
    p_idempotency_key,
    v_config.coin_price,
    v_config.required_rewarded_completions,
    v_expires_at
  )
  returning * into v_intent;

  return query
  select
    true,
    v_intent.status,
    v_intent.id,
    v_intent.episode_id,
    v_intent.room_id,
    v_intent.invite_id,
    v_intent.target,
    v_intent.method,
    v_intent.configured_coin_price_snapshot,
    v_intent.configured_rewarded_count_snapshot,
    v_intent.expires_at;
end;
$$;

revoke all on function public.create_play_together_acquisition_intent(uuid, text, text, uuid, text, text) from public;
revoke all on function public.create_play_together_acquisition_intent(uuid, text, text, uuid, text, text) from anon;
revoke all on function public.create_play_together_acquisition_intent(uuid, text, text, uuid, text, text) from authenticated;
grant execute on function public.create_play_together_acquisition_intent(uuid, text, text, uuid, text, text) to service_role;

create or replace function public.purchase_play_together_0chat_with_coins(
  p_user_id uuid,
  p_intent_id uuid
)
returns table (
  success boolean,
  status text,
  remaining_balance integer,
  intent_id uuid,
  room_id uuid,
  episode_id uuid,
  coin_transaction_id uuid,
  host_participant_id uuid,
  access_method text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_config public.play_together_commercial_config%rowtype;
  v_intent public.play_together_acquisition_intents%rowtype;
  v_episode public.episodes%rowtype;
  v_wallet public.wallets%rowtype;
  v_remaining_balance integer;
  v_room_id uuid;
  v_room public.play_together_rooms%rowtype;
  v_host_participant_id uuid;
  v_coin_transaction_id uuid;
  v_now timestamptz := now();
begin
  if p_user_id is null or p_intent_id is null then
    return query select false, 'invalid_request'::text, null::integer, p_intent_id, null::uuid, null::uuid, null::uuid, null::uuid, 'coin'::text;
    return;
  end if;

  select *
  into v_intent
  from public.play_together_acquisition_intents
  where public.play_together_acquisition_intents.id = p_intent_id
  for update;

  if not found then
    return query select false, 'intent_not_found'::text, null::integer, p_intent_id, null::uuid, null::uuid, null::uuid, null::uuid, 'coin'::text;
    return;
  end if;

  if v_intent.user_id <> p_user_id then
    return query select false, 'forbidden'::text, null::integer, v_intent.id, v_intent.room_id, v_intent.episode_id, v_intent.coin_transaction_id, null::uuid, 'coin'::text;
    return;
  end if;

  if v_intent.method <> 'coin' then
    return query select false, 'rewarded_not_operational'::text, v_intent.remaining_balance, v_intent.id, v_intent.room_id, v_intent.episode_id, v_intent.coin_transaction_id, null::uuid, v_intent.method;
    return;
  end if;

  if v_intent.status = 'completed' then
    return query select true, coalesce(v_intent.result_status, 'already_processed'), v_intent.remaining_balance, v_intent.id, v_intent.room_id, v_intent.episode_id, v_intent.coin_transaction_id, null::uuid, 'coin'::text;
    return;
  end if;

  if v_intent.status in ('cancelled', 'expired') then
    return query select false, v_intent.status, v_intent.remaining_balance, v_intent.id, v_intent.room_id, v_intent.episode_id, v_intent.coin_transaction_id, null::uuid, 'coin'::text;
    return;
  end if;

  if v_intent.expires_at <= v_now then
    update public.play_together_acquisition_intents
    set status = 'expired',
        result_status = 'expired'
    where public.play_together_acquisition_intents.id = v_intent.id
    returning * into v_intent;

    return query select false, 'expired'::text, v_intent.remaining_balance, v_intent.id, v_intent.room_id, v_intent.episode_id, v_intent.coin_transaction_id, null::uuid, 'coin'::text;
    return;
  end if;

  select *
  into v_config
  from public.play_together_commercial_config
  where public.play_together_commercial_config.id = 'launch'
  for share;

  if not found or not v_config.coin_access_enabled then
    return query select false, 'coin_disabled'::text, v_intent.remaining_balance, v_intent.id, v_intent.room_id, v_intent.episode_id, v_intent.coin_transaction_id, null::uuid, 'coin'::text;
    return;
  end if;

  select *
  into v_episode
  from public.episodes
  where public.episodes.id = v_intent.episode_id
    and public.episodes.status = 'published'
    and (public.episodes.published_at is null or public.episodes.published_at <= v_now)
    and exists (
      select 1
      from public.series
      where public.series.id = public.episodes.series_id
        and public.series.status = 'published'
    );

  if not found then
    return query select false, 'invalid_episode'::text, v_intent.remaining_balance, v_intent.id, v_intent.room_id, v_intent.episode_id, v_intent.coin_transaction_id, null::uuid, 'coin'::text;
    return;
  end if;

  if not v_episode.is_free
    and not exists (
      select 1
      from public.episode_entitlements
      where public.episode_entitlements.user_id = p_user_id
        and public.episode_entitlements.episode_id = v_intent.episode_id
        and (
          public.episode_entitlements.expires_at is null
          or public.episode_entitlements.expires_at > v_now
        )
    )
    and not (
      v_episode.plus_access
      and exists (
        select 1
        from public.subscriptions
        where public.subscriptions.user_id = p_user_id
          and public.subscriptions.status = 'active'
          and (public.subscriptions.starts_at is null or public.subscriptions.starts_at <= v_now)
          and (public.subscriptions.ends_at is null or public.subscriptions.ends_at > v_now)
      )
    )
  then
    return query select false, 'content_access_required'::text, v_intent.remaining_balance, v_intent.id, v_intent.room_id, v_intent.episode_id, v_intent.coin_transaction_id, null::uuid, 'coin'::text;
    return;
  end if;

  update public.play_together_acquisition_intents
  set
    configured_coin_price_snapshot = v_config.coin_price,
    configured_rewarded_count_snapshot = v_config.required_rewarded_completions
  where public.play_together_acquisition_intents.id = v_intent.id
  returning * into v_intent;

  if exists (
    select 1
    from public.subscriptions
    where public.subscriptions.user_id = p_user_id
      and public.subscriptions.status = 'active'
      and (public.subscriptions.starts_at is null or public.subscriptions.starts_at <= v_now)
      and (public.subscriptions.ends_at is null or public.subscriptions.ends_at > v_now)
  ) then
    if v_intent.target = 'host_create' then
      insert into public.play_together_rooms (host_user_id, episode_id, expires_at)
      values (p_user_id, v_intent.episode_id, v_now + interval '6 hours')
      returning id into v_room_id;

      insert into public.play_together_participants (room_id, user_id, role)
      values (v_room_id, p_user_id, 'host')
      returning id into v_host_participant_id;
    else
      v_room_id := v_intent.room_id;
    end if;

    update public.play_together_acquisition_intents
    set status = 'completed',
        result_status = 'already_accessible_plus',
        room_id = v_room_id,
        remaining_balance = null,
        completed_at = v_now
    where public.play_together_acquisition_intents.id = v_intent.id
    returning * into v_intent;

    return query select true, 'already_accessible_plus'::text, null::integer, v_intent.id, v_intent.room_id, v_intent.episode_id, null::uuid, v_host_participant_id, 'plus'::text;
    return;
  end if;

  if v_intent.target = 'guest_join' then
    select id
    into v_coin_transaction_id
    from public.coin_transactions
    where play_together_acquisition_intent_id = v_intent.id
      and transaction_type = 'play_together_0chat';

    if exists (
      select 1
      from public.play_together_room_access_grants
      join public.play_together_rooms
        on public.play_together_rooms.id = public.play_together_room_access_grants.room_id
      where public.play_together_room_access_grants.user_id = p_user_id
        and public.play_together_room_access_grants.room_id = v_intent.room_id
        and public.play_together_room_access_grants.source = 'coin'
        and public.play_together_rooms.status in ('waiting', 'active', 'waiting_for_access')
        and public.play_together_rooms.expires_at > v_now
    ) then
      update public.play_together_acquisition_intents
      set status = 'completed',
          result_status = 'already_accessible_coin',
          coin_transaction_id = v_coin_transaction_id,
          completed_at = v_now
      where public.play_together_acquisition_intents.id = v_intent.id
      returning * into v_intent;

      return query select true, 'already_accessible_coin'::text, v_intent.remaining_balance, v_intent.id, v_intent.room_id, v_intent.episode_id, v_intent.coin_transaction_id, null::uuid, 'coin'::text;
      return;
    end if;
  end if;

  select *
  into v_wallet
  from public.wallets
  where public.wallets.user_id = p_user_id
  for update;

  if not found then
    insert into public.wallets (user_id)
    values (p_user_id)
     on conflict on constraint wallets_pkey do nothing;

    select *
    into v_wallet
    from public.wallets
    where public.wallets.user_id = p_user_id
    for update;
  end if;

  if v_wallet.coin_balance < v_config.coin_price then
    update public.play_together_acquisition_intents
    set result_status = 'insufficient_balance',
        remaining_balance = v_wallet.coin_balance
    where public.play_together_acquisition_intents.id = v_intent.id
    returning * into v_intent;

    return query select false, 'insufficient_balance'::text, v_wallet.coin_balance, v_intent.id, v_intent.room_id, v_intent.episode_id, null::uuid, null::uuid, 'coin'::text;
    return;
  end if;

  if v_intent.target = 'host_create' then
    insert into public.play_together_rooms (host_user_id, episode_id, expires_at)
    values (p_user_id, v_intent.episode_id, v_now + interval '6 hours')
    returning id into v_room_id;

    insert into public.play_together_participants (room_id, user_id, role)
    values (v_room_id, p_user_id, 'host')
    returning id into v_host_participant_id;
  else
    select *
    into v_room
    from public.play_together_rooms
    where public.play_together_rooms.id = v_intent.room_id
      and public.play_together_rooms.status in ('waiting', 'active', 'waiting_for_access')
      and public.play_together_rooms.expires_at > v_now
    for update;

    if not found then
      return query select false, 'room_not_joinable'::text, v_wallet.coin_balance, v_intent.id, v_intent.room_id, v_intent.episode_id, null::uuid, null::uuid, 'coin'::text;
      return;
    end if;

    v_room_id := v_room.id;
  end if;

  update public.wallets
  set coin_balance = public.wallets.coin_balance - v_config.coin_price
  where public.wallets.user_id = p_user_id
  returning public.wallets.coin_balance into v_remaining_balance;

  insert into public.coin_transactions (
    user_id,
    amount,
    transaction_type,
    episode_id,
    play_together_acquisition_intent_id,
    play_together_room_id,
    reference
  )
  values (
    p_user_id,
    -v_config.coin_price,
    'play_together_0chat',
    v_intent.episode_id,
    v_intent.id,
    v_room_id,
    'play_together_0chat'
  )
  returning id into v_coin_transaction_id;

  insert into public.play_together_room_access_grants (
    room_id,
    user_id,
    source
  )
  values (
    v_room_id,
    p_user_id,
    'coin'
  )
  on conflict on constraint play_together_room_access_grants_user_id_room_id_key do nothing;

  update public.play_together_acquisition_intents
  set status = 'completed',
      result_status = 'purchase_success',
      remaining_balance = v_remaining_balance,
      room_id = v_room_id,
      coin_transaction_id = v_coin_transaction_id,
      completed_at = v_now
  where public.play_together_acquisition_intents.id = v_intent.id
  returning * into v_intent;

  return query select true, 'purchase_success'::text, v_remaining_balance, v_intent.id, v_room_id, v_intent.episode_id, v_coin_transaction_id, v_host_participant_id, 'coin'::text;
end;
$$;

revoke all on function public.purchase_play_together_0chat_with_coins(uuid, uuid) from public;
revoke all on function public.purchase_play_together_0chat_with_coins(uuid, uuid) from anon;
revoke all on function public.purchase_play_together_0chat_with_coins(uuid, uuid) from authenticated;
grant execute on function public.purchase_play_together_0chat_with_coins(uuid, uuid) to service_role;
