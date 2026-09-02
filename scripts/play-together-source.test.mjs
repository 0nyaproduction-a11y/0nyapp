import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const migration = readFileSync(
  "supabase/migrations/20260901164326_play_together_room_apis.sql",
  "utf8",
);
const b2dMigration = readFileSync(
  "supabase/migrations/20260901172951_px01_b2d_play_together_access_activation.sql",
  "utf8",
);
const b2eB1Migration = readFileSync(
  "supabase/migrations/20260901190000_px01_b2e_b1_acquisition_intent_coin_access.sql",
  "utf8",
);
const helper = readFileSync("src/lib/play-together.ts", "utf8");
const createRoomRoute = readFileSync(
  "src/app/api/v1/play-together/rooms/route.ts",
  "utf8",
);
const acquisitionRoute = readFileSync(
  "src/app/api/v1/play-together/acquisitions/route.ts",
  "utf8",
);
const coinAcquisitionRoute = readFileSync(
  "src/app/api/v1/play-together/acquisitions/[intentId]/coin/route.ts",
  "utf8",
);
const joinRoute = readFileSync(
  "src/app/api/v1/play-together/rooms/join/route.ts",
  "utf8",
);
const createInviteRoute = readFileSync(
  "src/app/api/v1/play-together/rooms/[roomId]/invites/route.ts",
  "utf8",
);
const revokeInviteRoute = readFileSync(
  "src/app/api/v1/play-together/rooms/[roomId]/invites/[inviteId]/revoke/route.ts",
  "utf8",
);
const bRtMigration = readFileSync(
  "supabase/migrations/20260902120000_px01_b_rt_b_realtime_room_state.sql",
  "utf8",
);
const commandsRoute = readFileSync(
  "src/app/api/v1/play-together/rooms/[roomId]/commands/route.ts",
  "utf8",
);
const heartbeatRoute = readFileSync(
  "src/app/api/v1/play-together/rooms/[roomId]/heartbeat/route.ts",
  "utf8",
);
const c1Migration = readFileSync(
  "supabase/migrations/20260902130000_px01_c1_play_together_activation_seam.sql",
  "utf8",
);
const configRoute = readFileSync(
  "src/app/api/v1/play-together/config/route.ts",
  "utf8",
);
const playTogetherType = readFileSync(
  "apps/android/src/types/playTogether.ts",
  "utf8",
);
const androidApi = readFileSync("apps/android/src/lib/api.ts", "utf8");

test("PX01 B2B mutation RPCs are service-role only", () => {
  const functionNames = [
    "create_play_together_room",
    "create_play_together_invite",
    "revoke_play_together_invite",
    "redeem_play_together_invite",
  ];

  for (const name of functionNames) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\([^;]+\\) from public;`));
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\([^;]+\\) from anon;`));
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\([^;]+\\) from authenticated;`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\([^;]+\\) to service_role;`));
  }
});

test("invite API foundation stores hashes, not raw tokens", () => {
  for (const sql of [migration, b2dMigration]) {
    assert.doesNotMatch(sql, /p_raw_token|raw_token|plaintext_token/i);
    assert.match(sql, /p_token_hash text/);
  }
  assert.match(helper, /createHash\("sha256"\)\.update\(rawToken\)\.digest\("hex"\)/);
  assert.match(helper, /randomBytes\(32\)\.toString\("base64url"\)/);
});

test("B2D access resolver supports Plus and room-scoped Coin/Rewarded grants", () => {
  assert.match(helper, /hasActiveSubscription/);
  assert.match(helper, /play_together_room_access_grants/);
  assert.match(helper, /source: PlayTogetherAccessMethod/);
  assert.match(b2dMigration, /source text not null check \(source in \('coin', 'rewarded'\)\)/);
  assert.match(b2dMigration, /unique \(user_id, room_id\)/);
  assert.match(b2dMigration, /revoke all on public\.play_together_room_access_grants from authenticated;/);
  assert.match(b2dMigration, /grant all on public\.play_together_room_access_grants to service_role;/);
});

test("room and invite TTL are server-authoritative", () => {
  assert.match(helper, /PLAY_TOGETHER_ROOM_TTL_MS = 6 \* 60 \* 60 \* 1000/);
  assert.match(helper, /PLAY_TOGETHER_INVITE_TTL_MS = 60 \* 60 \* 1000/);
  assert.match(helper, /Math\.min\(uncappedExpiry, roomExpiry\)/);
  assert.match(b2dMigration, /p_room_expires_at := v_now \+ interval '6 hours';/);
  assert.match(b2dMigration, /p_invite_expires_at := least\(v_now \+ interval '1 hour', v_room\.expires_at\);/);
  assert.doesNotMatch(createRoomRoute, /expiresAt|ttl|expiresIn|roomExpires/i);
  assert.doesNotMatch(createInviteRoute, /request\.json\(\)|expiresAt|ttl|expiresIn|inviteExpires/i);
});

test("create and join routes authenticate before access evaluation", () => {
  for (const route of [createRoomRoute, joinRoute]) {
    assert(route.indexOf("getApiAuth(request)") < route.indexOf("resolvePlayTogetherAccess({"));
    assert.match(route, /not_authenticated/);
  }
});

test("Plus can create, while Coin and Rewarded create remain acquisition-bound", () => {
  assert.match(createRoomRoute, /playTogetherAccess\.method !== "plus"/);
  assert.match(createRoomRoute, /createPlayTogetherRoom/);
  assert.match(createRoomRoute, /Coin and Rewarded room creation require a future acquisition binding/);
});

test("invite replacement and revoke semantics are deterministic", () => {
  assert.match(b2dMigration, /play_together_invites_one_active_unused_per_room_idx/);
  assert.match(b2dMigration, /used_at is null\s+and revoked_at is null/);
  assert.match(b2dMigration, /set revoked_at = coalesce\(revoked_at, v_now\)/);
  assert.match(b2dMigration, /where public\.play_together_invites\.room_id = p_room_id/);
  assert.match(b2dMigration, /and public\.play_together_invites\.used_at is null/);
  assert.match(b2dMigration, /and public\.play_together_invites\.revoked_at is null/);
  assert.match(b2dMigration, /'already_used'::text/);
  assert.match(b2dMigration, /'already_revoked'::text/);
  assert.match(revokeInviteRoute, /revokePlayTogetherInvite/);
});

test("join preserves independent 0chat and episode access gates before redemption", () => {
  assert(joinRoute.indexOf("getInviteJoinContext(inviteToken)") < joinRoute.indexOf("resolvePlayTogetherAccess({"));
  assert(joinRoute.indexOf("resolvePlayTogetherAccess({") < joinRoute.indexOf("canUserAccessPlayTogetherEpisode({"));
  assert(joinRoute.indexOf("canUserAccessPlayTogetherEpisode({") < joinRoute.indexOf("redeemPlayTogetherInvite({"));
  assert.match(joinRoute, /0chat access is required/);
  assert.match(joinRoute, /Episode access is required/);
});

test("B2E-B1 stores backend-controlled PX01 commercial config", () => {
  assert.match(b2eB1Migration, /create table if not exists public\.play_together_commercial_config/);
  assert.match(b2eB1Migration, /coin_price integer not null default 5/);
  assert.match(b2eB1Migration, /required_rewarded_completions integer not null default 1/);
  assert.match(b2eB1Migration, /rewarded_access_enabled boolean not null default false/);
  assert.match(b2eB1Migration, /revoke all on public\.play_together_commercial_config from authenticated;/);
  assert.match(helper, /getPlayTogetherCommercialConfig/);
  assert.doesNotMatch(acquisitionRoute, /payload\.coinPrice|payload\.price|payload\.walletBalance|payload\.grantState|payload\.subscriptionState/);
});

test("B2E-B1 acquisition intents are server-bound and idempotent", () => {
  assert.match(b2eB1Migration, /create table if not exists public\.play_together_acquisition_intents/);
  assert.match(b2eB1Migration, /target text not null check \(target in \('host_create', 'guest_join'\)\)/);
  assert.match(b2eB1Migration, /method text not null check \(method in \('coin', 'rewarded'\)\)/);
  assert.match(b2eB1Migration, /status text not null default 'pending'/);
  assert.match(b2eB1Migration, /configured_coin_price_snapshot integer/);
  assert.match(b2eB1Migration, /configured_rewarded_count_snapshot integer/);
  assert.match(b2eB1Migration, /play_together_acquisition_intents_idempotency_key_idx/);
  assert.match(b2eB1Migration, /for update/);
  assert.match(b2eB1Migration, /transaction_conflict/);
  assert.match(b2eB1Migration, /status = 'expired'/);
  assert.match(b2eB1Migration, /revoke all on public\.play_together_acquisition_intents from authenticated;/);
});

test("B2E-B1 Guest acquisition binds through secure invite context only", () => {
  assert.match(acquisitionRoute, /getInviteJoinContext\(inviteToken\)/);
  assert.match(acquisitionRoute, /payload\.episodeId !== undefined/);
  assert.match(helper, /hashInviteToken\(inviteToken\)/);
  assert.match(b2eB1Migration, /p_invite_token_hash text/);
  assert.match(b2eB1Migration, /where public\.play_together_invites\.token_hash = p_invite_token_hash/);
  assert.match(b2eB1Migration, /v_episode_id := v_room\.episode_id/);
  assert.match(b2eB1Migration, /v_room_id := v_room\.id/);
  assert.match(b2eB1Migration, /v_invite_id := v_invite\.id/);
  assert.doesNotMatch(b2eB1Migration, /raw_token|plaintext_token|p_raw_token/i);
  assert.doesNotMatch(acquisitionRoute, /roomId/);
});

test("B2E-B1 Coin acquisition is atomic and separate from episode entitlement", () => {
  assert.match(b2eB1Migration, /create or replace function public\.purchase_play_together_0chat_with_coins/);
  assert.match(b2eB1Migration, /select \*\s+into v_intent[\s\S]+for update;/);
  assert.match(b2eB1Migration, /select \*\s+into v_wallet[\s\S]+for update;/);
  assert.match(b2eB1Migration, /v_wallet\.coin_balance < v_config\.coin_price/);
  assert.match(b2eB1Migration, /set coin_balance = public\.wallets\.coin_balance - v_config\.coin_price/);
  assert.match(b2eB1Migration, /'play_together_0chat'/);
  assert.match(b2eB1Migration, /coin_transactions_play_together_intent_unique_idx/);
  assert.match(b2eB1Migration, /play_together_room_access_grants/);
  assert.match(b2eB1Migration, /on conflict on constraint play_together_room_access_grants_user_id_room_id_key do nothing/);
  assert.doesNotMatch(b2eB1Migration, /insert into public\.episode_entitlements/i);
  assert.doesNotMatch(helper, /purchase_episode_with_coins/);
});

test("B2E-B1 Host Coin acquisition creates one final room after access succeeds", () => {
  assert.match(b2eB1Migration, /v_intent\.target = 'host_create'/);
  assert.match(b2eB1Migration, /insert into public\.play_together_rooms \(host_user_id, episode_id, expires_at\)/);
  assert.match(b2eB1Migration, /v_now \+ interval '6 hours'/);
  assert.match(b2eB1Migration, /insert into public\.play_together_participants \(room_id, user_id, role\)/);
  assert.match(b2eB1Migration, /returning id into v_host_participant_id/);
  assert.match(b2eB1Migration, /room_id = v_room_id/);
});

test("B2E-B1 Guest Coin acquisition grants only room access and does not consume invite", () => {
  assert.match(b2eB1Migration, /v_intent\.target = 'guest_join'/);
  assert.match(b2eB1Migration, /where public\.play_together_rooms\.id = v_intent\.room_id/);
  assert.match(b2eB1Migration, /insert into public\.play_together_room_access_grants/);
  assert.match(joinRoute, /resolvePlayTogetherAccess\(\{/);
  assert.doesNotMatch(b2eB1Migration, /set used_at = v_now/);
  assert.doesNotMatch(b2eB1Migration, /set used_at = now\(\)/);
});

test("B2E-B1 Plus short-circuits before Coin debit and does not refund post-commit", () => {
  const plusCheck = b2eB1Migration.indexOf("public.subscriptions.user_id = p_user_id");
  const debit = b2eB1Migration.indexOf("set coin_balance = public.wallets.coin_balance - v_config.coin_price");

  assert(plusCheck > -1);
  assert(debit > -1);
  assert(plusCheck < debit);
  assert.match(b2eB1Migration, /'already_accessible_plus'/);
  assert.doesNotMatch(b2eB1Migration, /transaction_type,\s*[\s\S]*'(refund|chai_refund)'/i);
  assert.doesNotMatch(b2eB1Migration, /reversal/i);
});

test("B2E-B1 Rewarded is prepared but not operational", () => {
  assert.match(b2eB1Migration, /method text not null check \(method in \('coin', 'rewarded'\)\)/);
  assert.match(b2eB1Migration, /required_rewarded_completions integer not null default 1/);
  assert.match(b2eB1Migration, /'rewarded_not_operational'/);
  assert.match(acquisitionRoute, /rewardedOperational: false/);
  assert.doesNotMatch(b2eB1Migration, /finalize_rewarded_ad_callback|create_rewarded_ad_attempt|record_rewarded_event/);
});

test("B2E-B1 routes authenticate and keep client non-authoritative", () => {
  for (const route of [acquisitionRoute, coinAcquisitionRoute]) {
    assert.match(route, /getApiAuth\(request\)/);
    assert.match(route, /not_authenticated/);
  }

  assert.match(acquisitionRoute, /normalizeIdempotencyKey/);
  assert.match(acquisitionRoute, /normalizeInviteToken/);
  assert.match(acquisitionRoute, /normalizeUuid/);
  assert.match(coinAcquisitionRoute, /purchasePlayTogether0chatWithCoins/);
  assert.doesNotMatch(coinAcquisitionRoute, /request\.json\(\)/);
});

test("PX01-B-RT-B command layer is service-role only", () => {
  assert.match(bRtMigration, /create table if not exists public\.play_together_room_commands/);
  assert.match(bRtMigration, /unique \(room_id, command_id\)/);
  assert.match(bRtMigration, /enable row level security/);
  assert.match(bRtMigration, /revoke all on public\.play_together_room_commands from authenticated;/);
  assert.match(bRtMigration, /grant all on public\.play_together_room_commands to service_role;/);
  assert.match(bRtMigration, /revoke all on function public\.apply_play_together_room_command\(/);
  assert.match(bRtMigration, /grant execute on function public\.apply_play_together_room_command\([^;]+\) to service_role;/);
});

test("PX01-B-RT-B command RPC is Host-authoritative, versioned, and DB-clock stamped", () => {
  assert.match(bRtMigration, /create or replace function public\.apply_play_together_room_command/);
  assert.match(bRtMigration, /for update;/);
  assert.match(bRtMigration, /'replayed'::text/);
  assert.match(bRtMigration, /'transaction_conflict'::text/);
  assert.match(bRtMigration, /'stale_version'::text/);
  assert.match(bRtMigration, /'not_host'::text/);
  assert.match(bRtMigration, /'room_ended'::text/);
  assert.match(bRtMigration, /state_version = public\.play_together_rooms\.state_version \+ 1/);
  assert.match(bRtMigration, /state_server_time = v_now/);
  assert.match(bRtMigration, /duration_seconds \* 1000/);
  assert.doesNotMatch(bRtMigration, /state_server_time = now\(\)/);
});

test("PX01-B-RT-B broadcasts are database-driven and participant-only", () => {
  assert.match(bRtMigration, /realtime\.send\(/);
  assert.match(bRtMigration, /'play_together_room:' \|\| new\.id::text/);
  assert.match(bRtMigration, /when \(new\.state_version <> old\.state_version\)/);
  assert.match(bRtMigration, /"Play Together participants receive room broadcasts"/);
  assert.match(bRtMigration, /is_room_participant/);
  assert.match(bRtMigration, /extension in \('broadcast'\)/);
  assert.match(bRtMigration, /for select\s+to authenticated\s+using/);
});

test("PX01-B-RT-B adds additive room columns without touching existing schema", () => {
  assert.match(bRtMigration, /add column if not exists last_command_id text/);
  assert.match(bRtMigration, /add column if not exists updated_by_user_id uuid/);
  assert.match(bRtMigration, /play_together_rooms_last_command_id_length_check/);
  assert.match(bRtMigration, /references auth\.users \(id\)/);
  assert.doesNotMatch(bRtMigration, /alter table public\.play_together_(participants|invites|room_access_grants)/);
  assert.doesNotMatch(bRtMigration, /create policy[^;]*for insert/);
});

test("PX01-B-RT-B routes authenticate and keep command authority server-side", () => {
  assert.match(commandsRoute, /getApiAuth\(request\)/);
  assert.match(commandsRoute, /not_authenticated/);
  assert.match(commandsRoute, /normalizeCommandType/);
  assert.match(commandsRoute, /applyPlayTogetherRoomCommand/);
  assert.match(commandsRoute, /getParticipantRoomState/);
  assert.match(commandsRoute, /Only the Host can issue playback commands/);
  assert.match(commandsRoute, /stale_version/);
  assert.match(commandsRoute, /"not_found", "Room not found\.", 404/);
  assert.doesNotMatch(commandsRoute, /client\.supabase|anonKey|service_role/);

  assert.match(heartbeatRoute, /getApiAuth\(request\)/);
  assert.match(heartbeatRoute, /not_authenticated/);
  assert.match(heartbeatRoute, /getParticipantRoomState/);
  assert.match(heartbeatRoute, /dataResponse\(\{ room \}\)/);
  assert.doesNotMatch(heartbeatRoute, /request\.json\(\)/);
});

test("PX01-B-RT-B helper exposes command application and extended room state", () => {
  assert.match(helper, /applyPlayTogetherRoomCommand/);
  assert.match(helper, /normalizeCommandType/);
  assert.match(helper, /normalizeCommandId/);
  assert.match(helper, /normalizeOptionalNonNegativeInteger/);
  assert.match(helper, /PlayTogetherRoomCommandResult/);
  assert.match(helper, /p_actor_user_id/);
  assert.match(helper, /hostPositionMs/);
  assert.match(helper, /stateServerTime/);
  assert.match(helper, /lastCommandId/);
  assert.match(helper, /endedAt/);
  assert.match(helper, /playbackRate/);
});

test("PX01-C1 adds a server/config-controlled Play Together activation seam", () => {
  assert.match(c1Migration, /alter table public\.play_together_commercial_config/);
  assert.match(c1Migration, /add column if not exists enabled boolean not null default false/);
  assert.match(c1Migration, /update public\.play_together_commercial_config\s+set enabled = false\s+where id = 'launch'/);
  assert.match(c1Migration, /drop function if exists public\.get_play_together_commercial_config\(\)/);
  assert.match(c1Migration, /create or replace function public\.get_play_together_commercial_config\(\)/);
  assert.match(c1Migration, /enabled boolean,/);
  assert.match(c1Migration, /public\.play_together_commercial_config\.enabled,/);
  assert.match(c1Migration, /grant execute on function public\.get_play_together_commercial_config\(\) to service_role;/);
  assert.match(c1Migration, /revoke all on function public\.get_play_together_commercial_config\(\) from authenticated;/);
  assert.match(c1Migration, /revoke all on function public\.get_play_together_commercial_config\(\) from anon;/);
  assert.doesNotMatch(c1Migration, /set enabled = true/);
  assert.doesNotMatch(c1Migration, /default true/);
});

test("PX01-C1 central config resolver carries the enabled gate and fails closed", () => {
  assert.match(helper, /enabled: boolean/);
  assert.match(helper, /enabled: config\.enabled/);
  assert.match(helper, /reason: "config_unavailable"/);
});

test("PX01-C1 exposes a public, read-only consumer config endpoint that fails closed", () => {
  assert.match(configRoute, /dataResponse\(\{/);
  assert.match(configRoute, /getPlayTogetherCommercialConfig/);
  assert.match(configRoute, /config\.ok \? config\.data\.enabled : false/);
  assert.doesNotMatch(configRoute, /getApiAuth/);
  assert.doesNotMatch(configRoute, /not_authenticated/);
});

test("PX01-C1 Android models only the server gate and cannot hardcode it", () => {
  assert.match(playTogetherType, /export type PlayTogetherFeatureConfig = \{/);
  assert.match(playTogetherType, /enabled: boolean/);
  assert.doesNotMatch(playTogetherType, /enabled:\s*true/);
  assert.match(androidApi, /export function getPlayTogetherConfig/);
  assert.match(androidApi, /\/api\/v1\/play-together\/config/);
  assert.match(androidApi, /requestApi<PlayTogetherFeatureConfig>/);
  assert.doesNotMatch(androidApi, /getPlayTogetherConfig[\s\S]*?enabled:\s*true/);
});
