-- Grants or revokes an active 0nya Plus subscription for a QA/dev test account.
--
-- Placeholders substituted by scripts/set-dev-test-plus.mjs:
--   __TARGET_EMAIL__  the account email
--   __PLAN_CODE__     the plan_code to record
--   __DURATION_DAYS__ how long the grant stays active
--   __REVOKE__        'true' to clear Plus instead of granting it

do $$
declare
  v_user_id uuid;
  v_revoke boolean := '__REVOKE__';
  v_duration_days integer := __DURATION_DAYS__;
begin
  select id into v_user_id from auth.users where email = '__TARGET_EMAIL__';

  if v_user_id is null then
    raise exception 'No auth.users row for __TARGET_EMAIL__; refusing to change nothing.';
  end if;

  -- subscriptions_one_active_per_user_idx allows a single active row per user,
  -- so clear any prior rows before inserting rather than fighting the index.
  delete from public.subscriptions where user_id = v_user_id;

  if v_revoke then
    return;
  end if;

  insert into public.subscriptions (user_id, status, plan_code, starts_at, ends_at)
  values (
    v_user_id,
    'active',
    '__PLAN_CODE__',
    now(),
    now() + make_interval(days => v_duration_days)
  );
end
$$;

select
  u.email,
  coalesce(s.status, 'none') as subscription_status,
  s.plan_code,
  s.starts_at,
  s.ends_at
from auth.users u
left join public.subscriptions s on s.user_id = u.id
where u.email = '__TARGET_EMAIL__';
