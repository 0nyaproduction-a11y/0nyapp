-- PX01-C1: Server/config-controlled Play Together activation seam.
--
-- Source-only additive migration. Not applied remotely in this session.
-- Extends the existing authoritative PX01 commercial config
-- (public.play_together_commercial_config, created in
-- 20260901190000_px01_b2e_b1_acquisition_intent_coin_access.sql) with the
-- consumer-visibility gate `enabled`, and exposes it through the existing
-- central config RPC so backend/API code resolve a single source of truth.
--
-- Locked product rule (docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md §36): Play Together
-- must be gated behind an explicit server/config-controlled activation
-- boundary conceptually equivalent to play_together_enabled = false. The feature
-- remains invisible to consumers until the Product Owner explicitly enables it.
-- Enabling this flag is NOT authorized by PX01 engineering; it stays false here.

-- ---------------------------------------------------------------------------
-- 1. Add the authoritative activation gate to the existing commercial config.
--    Column name `enabled` is table-scoped (play_together_commercial_config.enabled
--    == conceptual play_together_enabled). Follows the existing column style
--    (coin_access_enabled, rewarded_access_enabled).
-- ---------------------------------------------------------------------------

alter table public.play_together_commercial_config
  add column if not exists enabled boolean not null default false;

comment on column public.play_together_commercial_config.enabled is
  'Authoritative Play Together consumer-visibility gate (conceptually play_together_enabled). False = feature invisible to consumers. Server-controlled; never client-authoritative.';

-- Explicitly seed the active launch row to false so the current source state is
-- unambiguous and does not depend on implicit default backfill alone.
update public.play_together_commercial_config
  set enabled = false
  where id = 'launch';

-- ---------------------------------------------------------------------------
-- 2. Expose the gate through the existing central config RPC.
--    PostgreSQL disallows changing a function's return type with
--    CREATE OR REPLACE FUNCTION, so the RPC is dropped and recreated. This is
--    the only consumer-visibility seamed through this RPC; backend room/acquisition
--    RPCs (create_play_together_room, create_play_together_acquisition_intent,
--    purchase_play_together_0chat_with_coins, apply_play_together_room_command)
--    are intentionally left ungated (PX01-C1 establishes the visibility seam only;
--    operational endpoint gating remains deferred per task §13).
-- ---------------------------------------------------------------------------

drop function if exists public.get_play_together_commercial_config();

create or replace function public.get_play_together_commercial_config()
returns table (
  enabled boolean,
  coin_price integer,
  required_rewarded_completions integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.play_together_commercial_config.enabled,
    public.play_together_commercial_config.coin_price,
    public.play_together_commercial_config.required_rewarded_completions
  from public.play_together_commercial_config
  where id = 'launch';
$$;

revoke all on function public.get_play_together_commercial_config() from public;
revoke all on function public.get_play_together_commercial_config() from anon;
revoke all on function public.get_play_together_commercial_config() from authenticated;
grant execute on function public.get_play_together_commercial_config() to service_role;
