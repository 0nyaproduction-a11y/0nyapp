-- Corrects a bug from 20260825000000_018_welcome_account_grant.sql without
-- editing that historical migration.
--
-- Bug 1 (new-account signup failing with HTTP 500):
-- apply_welcome_coin_grant's INSERT used
--   ON CONFLICT (user_id, reference) DO NOTHING
-- against a PARTIAL unique index (WHERE reference IS NOT NULL). Postgres
-- cannot infer a partial index unless the ON CONFLICT clause repeats its
-- exact predicate, so every INSERT raised SQLSTATE 42P10 ("there is no
-- unique or exclusion constraint matching the ON CONFLICT specification"),
-- and since this runs inside the on_auth_user_created trigger, it broke
-- every new auth.users signup.
--
-- Bug 2 (repeat coin-unlocked episode purchases failing):
-- coin_transactions_user_reference_unique_idx applied to (user_id,
-- reference) WHERE reference IS NOT NULL is far broader than the welcome
-- grant it was meant to protect. purchase_episode_with_coins (baseline
-- migration, predates 018) always inserts the literal, non-unique
-- reference 'episode_purchase' with no ON CONFLICT guard at all. Once a
-- user owned any coin-unlocked episode, buying a second, different
-- episode hit the same (user_id, 'episode_purchase') key and raised a raw
-- unique_violation (23505).
--
-- Fix: replace the over-broad index with one scoped to the exact welcome
-- grant reference literal only, and correct apply_welcome_coin_grant's
-- ON CONFLICT clause to match it exactly. This preserves the "once per
-- account" welcome guarantee while no longer constraining any other
-- reference value used by episode purchases, coin-pack credits, or Chai
-- tips (each already uses its own distinct/per-transaction reference and
-- is unaffected by this change).

drop index if exists public.coin_transactions_user_reference_unique_idx;

create unique index if not exists coin_transactions_welcome_grant_unique_idx
  on public.coin_transactions (user_id, reference)
  where reference = 'welcome_100_coins';

create or replace function public.apply_welcome_coin_grant(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  insert into public.wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.coin_transactions (
    user_id,
    amount,
    transaction_type,
    reference
  )
  values (
    p_user_id,
    100,
    'promo',
    'welcome_100_coins'
  )
  on conflict (user_id, reference) where reference = 'welcome_100_coins' do nothing;

  v_inserted := found;

  if not v_inserted then
    return false;
  end if;

  update public.wallets
  set coin_balance = public.wallets.coin_balance + 100
  where public.wallets.user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.apply_welcome_coin_grant(uuid) from public;
