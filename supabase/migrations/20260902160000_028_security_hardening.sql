-- 028: Security Hardening — additive-only ACL and search_path fixes.
--
-- Proven defects addressed:
--   1. default SQL privileges (Supabase grants EXECUTE on new public-schema
--      functions to anon/authenticated/service_role) left rewarded/publish
--      functions executable by undesired roles. This migration explicitly
--      revokes the undesired roles and grants only the required role.
--   2. record_rewarded_event had no ownership guard — authenticated users
--      could spoof p_user_id. Fix: authenticated execution + auth.uid()
--      = p_user_id guard; service_role callers pass through (auth.uid()=null),
--      anon is revoked entirely.
--   3. handle_new_user / set_updated_at: trigger-internal functions still
--      executable by anon/authenticated (default privileges). Fix: revoke.
--   4. enforce_google_play_mapping_immutability / forbid_gp_mapping_delete:
--      no search_path fix. Fix: set search_path = ''.
--
-- No migration 027 changes. No PX01 changes. No schema changes. Purely
-- additive ACL/setting fixes. Trigger execution bypasses function grants, so
-- revoking EXECUTE from anon/authenticated never breaks trigger behavior.

-- ===========================================================================
-- Phase 1: record_rewarded_event — ownership guard + ACL
--   Callers:
--     authenticated (API route /api/v1/monetization/rewarded-events) — passes
--       auth.user.id, guard requires auth.uid() = p_user_id.
--     service_role (finalize_rewarded_ad_callback internal) — auth.uid() is
--       null, guard passes through.
--   anon revoked: anon has no auth.uid() so must not call (would spoof).
-- ===========================================================================
create or replace function public.record_rewarded_event(
  p_event_type text,
  p_user_id uuid,
  p_episode_id uuid default null,
  p_ad_index smallint default null,
  p_required_count smallint default null,
  p_resulting_progress smallint default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Ownership guard: an authenticated session may only record its own events.
  -- service_role sessions (auth.uid() = null, used by finalize_rewarded_ad_callback
  -- via the SSV server path) pass through. anon is revoked from EXECUTE below and
  -- cannot reach this function.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'record_rewarded_event: authenticated user may only record own events'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.rewarded_monetization_events (
    event_type,
    user_id,
    episode_id,
    ad_index,
    required_count,
    resulting_progress,
    metadata
  )
  values (
    p_event_type,
    p_user_id,
    p_episode_id,
    p_ad_index,
    p_required_count,
    p_resulting_progress,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_rewarded_event(text, uuid, uuid, smallint, smallint, smallint, jsonb)
  from public;
revoke all on function public.record_rewarded_event(text, uuid, uuid, smallint, smallint, smallint, jsonb)
  from anon;
grant execute on function public.record_rewarded_event(text, uuid, uuid, smallint, smallint, smallint, jsonb)
  to authenticated, service_role;

-- ===========================================================================
-- Phase 2: publish_series_with_episodes — SERVICE_ROLE ONLY
--   CMS backend calls via createAdminClient() (service_role key).
-- ===========================================================================
revoke all on function public.publish_series_with_episodes(uuid) from public;
revoke all on function public.publish_series_with_episodes(uuid)
  from anon, authenticated;
grant execute on function public.publish_series_with_episodes(uuid) to service_role;

-- ===========================================================================
-- Phase 3: finalize_rewarded_ad_callback — SERVICE_ROLE ONLY
--   Called by AdMob SSV webhook server path via service_role client.
-- ===========================================================================
revoke all on function public.finalize_rewarded_ad_callback(text, text) from public;
revoke all on function public.finalize_rewarded_ad_callback(text, text)
  from anon, authenticated;
grant execute on function public.finalize_rewarded_ad_callback(text, text) to service_role;

-- ===========================================================================
-- Phase 4: apply_welcome_coin_grant — TRIGGER/INTERNAL ONLY
--   No direct execution by any role. The on_auth_user_created trigger
--   (handle_new_user, SECURITY DEFINER as postgres) calls it internally;
--   a SECURITY DEFINER body runs as the owner regardless of EXECUTE grants.
-- ===========================================================================
revoke all on function public.apply_welcome_coin_grant(uuid) from public;
revoke all on function public.apply_welcome_coin_grant(uuid)
  from anon, authenticated, service_role;

-- ===========================================================================
-- Phase 5: rewarded user RPCs — AUTHENTICATED ONLY
--   create_rewarded_ad_attempt / get_rewarded_ad_attempt_status /
--   get_rewarded_progress each internally guard on auth.uid().
-- ===========================================================================
revoke all on function public.create_rewarded_ad_attempt(uuid) from public;
revoke all on function public.create_rewarded_ad_attempt(uuid)
  from anon, service_role;
grant execute on function public.create_rewarded_ad_attempt(uuid) to authenticated;

revoke all on function public.get_rewarded_ad_attempt_status(text) from public;
revoke all on function public.get_rewarded_ad_attempt_status(text)
  from anon, service_role;
grant execute on function public.get_rewarded_ad_attempt_status(text) to authenticated;

revoke all on function public.get_rewarded_progress(uuid) from public;
revoke all on function public.get_rewarded_progress(uuid)
  from anon, service_role;
grant execute on function public.get_rewarded_progress(uuid) to authenticated;

-- ===========================================================================
-- Phase 6: Trigger function hardening
--   handle_new_user() and set_updated_at() are trigger-internal only.
--   Postgres executes trigger functions with the privileges of the table owner
--   regardless of the function's EXECUTE grants, and these are SECURITY DEFINER
--   owned by postgres. Revoking EXECUTE from anon/authenticated/service_role
--   removes all external call surface while leaving the triggers fully working.
-- ===========================================================================
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user()
  from anon, authenticated, service_role;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at()
  from anon, authenticated, service_role;

-- ===========================================================================
-- Phase 7: Google Play trigger function search_path hardening
-- ===========================================================================
alter function public.enforce_google_play_mapping_immutability()
  set search_path = '';

alter function public.forbid_gp_mapping_delete()
  set search_path = '';
