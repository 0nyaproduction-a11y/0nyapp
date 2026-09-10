-- Reset a QA/dev test account back to its "first login" monetization state.
--
-- Restores the account to: 100 coins, every episode locked, no rewarded-ad
-- history, no watch progress, no active subscription.
--
-- Auth identity (auth.users row, password, email confirmation) is intentionally
-- left untouched so the same credentials keep working.
--
-- __TARGET_EMAIL__ is substituted by scripts/reset-dev-test-account-state.mjs.
-- Run it via: npm run reset:test-account

do $$
declare
  v_target_email text := '__TARGET_EMAIL__';
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = v_target_email;

  if v_user_id is null then
    raise exception 'No auth.users row for %; refusing to reset nothing.', v_target_email;
  end if;

  -- Re-lock every episode.
  delete from public.episode_entitlements where user_id = v_user_id;

  -- Clear rewarded-ad correlation so fresh SSV attempts are unambiguous.
  delete from public.rewarded_ad_attempts where user_id = v_user_id;
  delete from public.rewarded_monetization_events where user_id = v_user_id;

  -- Clear Continue Watching / resume positions.
  delete from public.watch_progress where user_id = v_user_id;

  -- No entitlement may survive via an active subscription.
  delete from public.subscriptions where user_id = v_user_id;

  -- Drop the whole coin ledger, including the welcome grant. The grant is
  -- idempotent on (user_id, reference='welcome_100_coins'), so that row must go
  -- for the account to look like a first login.
  delete from public.coin_transactions where user_id = v_user_id;

  insert into public.wallets (user_id, coin_balance)
  values (v_user_id, 0)
  on conflict (user_id) do update set coin_balance = 0, updated_at = now();

  -- Re-apply the welcome grant through the same authoritative function the
  -- signup trigger uses, so the reset balance comes from production logic
  -- rather than a hardcoded number.
  if not public.apply_welcome_coin_grant(v_user_id) then
    raise exception 'apply_welcome_coin_grant did not grant for %.', v_target_email;
  end if;
end;
$$;

-- Verification: expect coin_balance 100, coin_transactions 1, all others 0.
select
  u.email,
  w.coin_balance,
  (select count(*) from public.episode_entitlements e where e.user_id = u.id) as entitlements,
  (select count(*) from public.rewarded_ad_attempts r where r.user_id = u.id) as rewarded_attempts,
  (select count(*) from public.watch_progress p where p.user_id = u.id) as watch_progress,
  (select count(*) from public.subscriptions s where s.user_id = u.id) as subscriptions,
  (select count(*) from public.coin_transactions c where c.user_id = u.id) as coin_transactions
from auth.users u
left join public.wallets w on w.user_id = u.id
where u.email = '__TARGET_EMAIL__';
