import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

// PX01-D source-level guardrails. Run with: node --test scripts/play-together-px01-d-source.test.mjs
// (nextjs-agent-rules: this is a static source audit; it never touches a database.)

const migration = readFileSync(
  "supabase/migrations/20260902150000_px01_d_sync_config.sql",
  "utf8",
);
const bRtMigration = readFileSync(
  "supabase/migrations/20260902120000_px01_b_rt_b_realtime_room_state.sql",
  "utf8",
);
const helper = readFileSync("src/lib/play-together.ts", "utf8");
const configRoute = readFileSync(
  "src/app/api/v1/play-together/config/route.ts",
  "utf8",
);
const playTogetherType = readFileSync(
  "apps/android/src/types/playTogether.ts",
  "utf8",
);
const androidApi = readFileSync("apps/android/src/lib/api.ts", "utf8");
const syncHelpers = readFileSync(
  "apps/android/src/player/playTogetherSync.ts",
  "utf8",
);
const syncAdapter = readFileSync(
  "apps/android/src/player/usePlayTogetherPlaybackSync.ts",
  "utf8",
);
const playerScreen = readFileSync(
  "apps/android/src/player/PlayerScreen.tsx",
  "utf8",
);

test("PX01-D sync tuning lives in the DB migration, not in any client", () => {
  assert.match(migration, /alter table public\.play_together_commercial_config/);
  for (const column of [
    "sync_small_drift_ms",
    "sync_large_drift_ms",
    "sync_rate_min_factor",
    "sync_rate_max_factor",
    "sync_heartbeat_seconds",
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(migration, /check \(sync_small_drift_ms >= 0\)/);
  assert.match(migration, /check \(sync_large_drift_ms > sync_small_drift_ms\)/);
  assert.match(migration, /check \(sync_heartbeat_seconds > 0\)/);
});

test("PX01-D migration keeps the activation seam OFF (consume-only)", () => {
  assert.match(migration, /update public\.play_together_commercial_config\s+set enabled = false/);
  assert.doesNotMatch(migration, /set enabled = true/);
});

test("PX01-D RPC re-exposes the commercial config through the central resolver", () => {
  assert.match(migration, /drop function if exists public\.get_play_together_commercial_config\(\)/);
  assert.match(migration, /create or replace function public\.get_play_together_commercial_config\(\)/);
  assert.match(migration, /sync_small_drift_ms integer,/);
  assert.match(migration, /sync_rate_min_factor numeric,/);
  assert.match(migration, /public\.play_together_commercial_config\.sync_small_drift_ms,/);
  assert.match(migration, /grant execute on function public\.get_play_together_commercial_config\(\) to service_role;/);
  assert.match(migration, /revoke all on function public\.get_play_together_commercial_config\(\) from authenticated;/);
  assert.match(migration, /revoke all on function public\.get_play_together_commercial_config\(\) from anon;/);
});

test("PX01-D presence is authorized on a SEPARATE topic; room broadcasts stay unchanged", () => {
  assert.match(
    migration,
    /create or replace function public\.play_together_room_id_from_realtime_presence_topic\(\)/,
  );
  assert.match(migration, /\^play_together_room_presence:/);
  assert.match(migration, /grant execute on function public\.play_together_room_id_from_realtime_presence_topic\(\) to authenticated;/);
  assert.match(migration, /revoke all on function public\.play_together_room_id_from_realtime_presence_topic\(\) from public;/);
  assert.match(migration, /revoke all on function public\.play_together_room_id_from_realtime_presence_topic\(\) from anon;/);
  assert.match(migration, /"Play Together participants receive presence in room topic"/);
  assert.match(migration, /"Play Together participants track presence in room topic"/);
  const presenceSelect = migration.slice(migration.indexOf("receive presence"));
  assert.match(presenceSelect, /for select/);
  assert.match(presenceSelect, /extension in \('presence'\)/);
  const presenceInsert = migration.slice(migration.indexOf("track presence"));
  assert.match(presenceInsert, /for insert/);
  assert.match(presenceInsert, /extension in \('presence'\)/);
  assert.match(presenceInsert, /is_room_participant/);
});

test("PX01-D must not grant any room-topic broadcast write or presence on the room topic", () => {
  assert.doesNotMatch(migration, /extension in \('broadcast'\)/);
  assert.doesNotMatch(migration, /play_together_room:<room_id>/);
  assert.doesNotMatch(migration, /for update/);
  assert.doesNotMatch(migration, /for delete/);
});

test("PX01-B-RT-B broadcast authorization is untouched by PX01-D", () => {
  assert.match(
    bRtMigration,
    /"Play Together participants receive room broadcasts"/,
  );
  assert.match(bRtMigration, /extension in \('broadcast'\)/);
  assert.doesNotMatch(bRtMigration, /extension in \('presence'\)/);
});

test("backend resolver carries the server-controlled sync tuning and stays fail-closed", () => {
  assert.match(helper, /enabled: boolean/);
  assert.match(helper, /enabled: config\.enabled/);
  assert.match(helper, /reason: "config_unavailable"/);
  assert.match(helper, /sync: PlayTogetherSyncConfig/);
  assert.match(helper, /heartbeatSeconds: Number\(config\.sync_heartbeat_seconds\)/);
  assert.match(helper, /largeDriftMs: Number\(config\.sync_large_drift_ms\)/);
  assert.match(helper, /rateMinFactor: Number\(config\.sync_rate_min_factor\)/);
  assert.match(helper, /rateMaxFactor: Number\(config\.sync_rate_max_factor\)/);
  assert.match(helper, /smallDriftMs: Number\(config\.sync_small_drift_ms\)/);
});

test("config endpoint exposes sync tuning and never accepts/forges it", () => {
  assert.match(configRoute, /dataResponse\(\{/);
  assert.match(configRoute, /getPlayTogetherCommercialConfig/);
  assert.match(configRoute, /config\.ok \? config\.data\.enabled : false/);
  assert.match(configRoute, /sync: config\.ok/);
  assert.match(configRoute, /smallDriftIgnoredMs: config\.data\.sync\.smallDriftMs/);
  assert.match(configRoute, /heartbeatSeconds: config\.data\.sync\.heartbeatSeconds/);
  assert.doesNotMatch(configRoute, /getApiAuth/);
  assert.doesNotMatch(configRoute, /not_authenticated/);
});

test("Android config/command types mirror the server contract pessimistically", () => {
  assert.match(playTogetherType, /export type PlayTogetherFeatureConfig = \{/);
  assert.match(playTogetherType, /enabled: boolean/);
  assert.match(playTogetherType, /sync: PlayTogetherSyncConfig \| null/);
  assert.match(playTogetherType, /export type PlayTogetherSyncConfig = \{/);
  assert.match(playTogetherType, /smallDriftIgnoredMs: number/);
  assert.match(playTogetherType, /largeDriftCorrectionMs: number/);
  assert.match(playTogetherType, /rateMinFactor: number/);
  assert.match(playTogetherType, /rateMaxFactor: number/);
  assert.match(playTogetherType, /heartbeatSeconds: number/);
  assert.match(playTogetherType, /export type PlayTogetherCommandType = "play" \| "pause" \| "seek";/);
  assert.match(playTogetherType, /export type PlayTogetherRoomCommandRequest = \{/);
  assert.match(playTogetherType, /expectedVersion: number \| null/);
  assert.match(playTogetherType, /export type PlayTogetherRoomCommand = \{/);
  assert.doesNotMatch(playTogetherType, /enabled:\s*true/);
});

test("Android API shapes the command POST (never applies locally)", () => {
  assert.match(androidApi, /export function sendPlayTogetherRoomCommand/);
  assert.match(androidApi, /\/commands`/);
  assert.match(androidApi, /requestApi<\{ command: PlayTogetherRoomCommand \}>/);
  assert.match(androidApi, /method: "POST"/);
  assert.match(androidApi, /export function getPlayTogetherConfig/);
  assert.match(androidApi, /requestApi<PlayTogetherFeatureConfig>/);
});

test("sync pure helpers never import React and implement the spec formulas", () => {
  assert.doesNotMatch(syncHelpers, /from "react"/);
  for (const name of [
    "clampPositionMs",
    "parseStateServerTimeMs",
    "offsetSampleMs",
    "estimateClockOffsetMs",
    "expectedPositionMs",
    "classifyDrift",
    "correctionRateForDrift",
    "isNewerStateVersion",
    "createPlayTogetherCommandId",
  ]) {
    assert.match(syncHelpers, new RegExp(`export function ${name}`));
  }
  assert.match(syncHelpers, /DEFAULT_PLAY_TOGETHER_SYNC/);
  assert.match(syncHelpers, /elapsedMs = options\.nowMs \+ options\.offsetMs - options\.stateServerTimeMs/);
  assert.match(syncHelpers, /const sample = options\.serverTimeMs - midpointMs;/);
});

test("adapter is gated by consumed config and inert without a room session", () => {
  assert.match(syncAdapter, /config\?\.enabled/);
  assert.match(syncAdapter, /enabledByGate/);
  assert.match(syncAdapter, /room\.status === "active"/);
  assert.match(syncAdapter, /room\.episodeId === episodeId/);
  assert.match(syncAdapter, /sendPlayTogetherRoomCommand/);
  assert.match(syncAdapter, /play_together_room_presence:/);
  assert.match(syncAdapter, /hostBuffering/);
  assert.match(syncAdapter, /handlePlayPause/);
  assert.match(syncAdapter, /handleSeekTo/);
  assert.match(syncAdapter, /handleSeekBy/);
  assert.match(syncAdapter, /getPlayTogetherHeartbeat/);
  assert.match(syncAdapter, /expectedPositionMs/);
  assert.match(syncAdapter, /classifyDrift/);
  assert.match(syncAdapter, /correctionRateForDrift/);
  assert.match(syncAdapter, /estimateClockOffsetMs/);
  assert.match(syncAdapter, /offsetSampleMs/);
  assert.match(syncAdapter, /config\?\.sync/);
  assert.match(syncAdapter, /if \(!syncConfig\)/);
  assert.match(syncAdapter, /if \(!sync\?\.heartbeatSeconds\)/);
  assert.doesNotMatch(syncAdapter, /DEFAULT_PLAY_TOGETHER_SYNC/);
  assert.doesNotMatch(syncAdapter, /enabled: true/);
});

test("PlayerScreen only engages the adapter when an explicit room scope is passed", () => {
  assert.match(playerScreen, /playTogether\?: PlayTogetherPlaybackScope \| null/);
  assert.match(playerScreen, /usePlayTogetherPlaybackSync\(/);
  assert.match(playerScreen, /usePlayTogetherRoom\(/);
  assert.match(playerScreen, /playTogetherSync\.active/);
  assert.match(playerScreen, /playTogetherSync\.handlePlayPause/);
  assert.match(playerScreen, /playTogetherSync\.handleSeekTo/);
  assert.match(playerScreen, /playTogetherSync\.handleSeekBy/);
});