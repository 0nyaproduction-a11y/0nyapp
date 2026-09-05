import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { advanceImpressionExposure, getMeasuredVisibilityFraction, markCollectionServed } from "../../../apps/android/src/lib/behaviorImpressionModel";
import { toPlaybackOriginContext } from "../../../apps/android/src/lib/behaviorContext";
import { validateBehaviorEvent } from "./behavior-events";

const envelope = { eventId: "123e4567-e89b-42d3-a456-426614174000", occurredAt: "2026-09-05T00:00:00.000Z", sessionId: "123e4567-e89b-42d3-b456-426614174001" };

test("Home served/open preserve stable row ID and one-based position", () => {
  for (const eventType of ["content_served", "content_open"]) assert.equal(validateBehaviorEvent({ ...envelope, eventType, contentId: "content-id", contentType: "MICRO_DRAMA", sourceSurface: "home", rowId: "cms-row-uuid", position: 2 }).ok, true);
});

test("Explore served/open preserve post-filter displayed position with no row", () => {
  for (const eventType of ["content_served", "content_open"]) assert.equal(validateBehaviorEvent({ ...envelope, eventType, contentId: "film-id", contentType: "SHORT_FILM", sourceSurface: "explore", rowId: null, position: 3 }).ok, true);
});

test("visibility is measured geometrically and mount/off-screen cannot qualify", () => {
  assert.equal(getMeasuredVisibilityFraction({ x: 0, y: 900, width: 100, height: 100 }, { width: 400, height: 800 }), 0);
  assert.equal(getMeasuredVisibilityFraction({ x: 0, y: 750, width: 100, height: 100 }, { width: 400, height: 800 }), 0.5);
  let state = advanceImpressionExposure({ emitted: false, visibleSince: null }, 0.5, 0);
  state = advanceImpressionExposure(state, 0.5, 999);
  assert.equal(state.emitted, false);
  state = advanceImpressionExposure(state, 0.5, 1000);
  assert.equal(state.emitted, true);
});

test("losing visibility resets duration and rerender after emission stays deduped", () => {
  let state = advanceImpressionExposure({ emitted: false, visibleSince: null }, 0.5, 0);
  state = advanceImpressionExposure(state, 0.49, 900);
  assert.equal(state.visibleSince, null);
  state = advanceImpressionExposure(state, 0.5, 1000);
  state = advanceImpressionExposure(state, 0.5, 2000);
  assert.equal(advanceImpressionExposure(state, 0, 3000).emitted, true);
});

test("simple collection rerender does not duplicate served evidence", () => {
  const seen = new Set<string>();
  assert.equal(markCollectionServed(seen, "home:row-1:contents"), true);
  assert.equal(markCollectionServed(seen, "home:row-1:contents"), false);
  assert.equal(markCollectionServed(seen, "home:row-1:new-contents"), true);
});

test("playback retains Home, Explore, and Search origins", () => {
  assert.deepEqual(toPlaybackOriginContext({ contentId: "1", contentSlug: "one", contentType: "MICRO_DRAMA", position: 1, rowId: "row", sourceSurface: "home" }), { sourceSurface: "home", rowId: "row", position: 1, searchQueryContext: null, searchResultPosition: null, rankingDecisionId: null, recommendationReason: null });
  assert.equal(toPlaybackOriginContext({ contentId: "1", contentSlug: "one", contentType: "MICRO_DRAMA", position: 2, rowId: null, sourceSurface: "explore" }).sourceSurface, "explore");
  assert.deepEqual(toPlaybackOriginContext({ contentId: "1", contentSlug: "one", contentType: "MICRO_DRAMA", searchQueryContext: "drama", searchResultPosition: 3, sourceSurface: "search" }), { sourceSurface: "search", rowId: null, position: 3, searchQueryContext: "drama", searchResultPosition: 3, rankingDecisionId: null, recommendationReason: null });
});

test("schema rejects zero-based positions and malformed ranking decision IDs", () => {
  assert.equal(validateBehaviorEvent({ ...envelope, eventType: "content_open", contentId: "1", contentType: "SHORT_FILM", sourceSurface: "explore", position: 0 }).ok, false);
  assert.equal(validateBehaviorEvent({ ...envelope, eventType: "content_open", contentId: "1", contentType: "SHORT_FILM", sourceSurface: "explore", position: 1, rankingDecisionId: "fake" }).ok, false);
});

test("prepared persistence schema is additive, idempotent, versioned, and server-only", () => {
  const sql = readFileSync("supabase/migrations/20260905040000_035_ranking_behavior_events.sql", "utf8");
  assert.match(sql, /create table if not exists public\.ranking_behavior_events/);
  assert.match(sql, /event_id uuid primary key/);
  assert.match(sql, /event_schema_version text not null/);
  assert.match(sql, /actor_id uuid references auth\.users/);
  assert.match(sql, /session_id uuid/);
  assert.match(sql, /ranking_decision_id uuid/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.ranking_behavior_events from public, anon, authenticated/);
  assert.match(sql, /grant select, insert on public\.ranking_behavior_events to service_role/);
  assert.doesNotMatch(sql, /selection_probability|propensity|reward_score|engagement_score/);
});

test("client evidence transport remains fire-and-forget and fail-open", () => {
  const source = readFileSync("apps/android/src/lib/behavioralEvents.ts", "utf8");
  assert.match(source, /void task\.catch/);
  assert.doesNotMatch(source, /await recordBehaviorEvent/);
});
