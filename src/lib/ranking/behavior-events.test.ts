import assert from "node:assert/strict";
import { test } from "node:test";
import { accumulateQualifiedWatch, BEHAVIOR_EVENT_SCHEMA_VERSION, isQualifiedWatch, qualifiesViewportImpression, shouldEmitPlayAbandon, validateBehaviorEvent } from "./behavior-events";

const base = { eventId: "123e4567-e89b-42d3-a456-426614174000", eventType: "content_open", occurredAt: "2026-09-05T00:00:00.000Z", sessionId: "123e4567-e89b-42d3-b456-426614174001", contentId: "film-1", contentType: "SHORT_FILM", sourceSurface: "home", rowId: "featured", position: 1 };

test("canonical envelope is versioned with one-based context", () => {
  assert.equal(BEHAVIOR_EVENT_SCHEMA_VERSION, "ranking_behavior_v1");
  assert.equal(validateBehaviorEvent(base).ok, true);
  assert.equal(validateBehaviorEvent({ ...base, position: 0 }).ok, false);
});

test("served differs from a measured viewport impression", () => {
  assert.equal(validateBehaviorEvent({ ...base, eventType: "content_served" }).ok, true);
  assert.equal(validateBehaviorEvent({ ...base, eventType: "content_impression" }).ok, false);
  assert.equal(validateBehaviorEvent({ ...base, eventType: "content_impression", metadata: { visibility_fraction: 0.5, visible_duration_ms: 1000 } }).ok, true);
  assert.equal(qualifiesViewportImpression(0.49, 1000), false);
});

test("search context survives open and play evidence with PII redacted", () => {
  for (const eventType of ["content_open", "play_start"]) {
    const result = validateBehaviorEvent({ ...base, eventType, sourceSurface: "search", searchResultPosition: 2, searchQueryContext: "akash@example.com drama" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.searchQueryContext, "[redacted] drama");
  }
});

test("qualified watch is deterministic and ignores seeks and paused time", () => {
  let seconds = 0;
  for (let index = 0; index < 60; index += 1) seconds = accumulateQualifiedWatch(seconds, 0.5, true);
  seconds = accumulateQualifiedWatch(seconds, 20, true);
  seconds = accumulateQualifiedWatch(seconds, 1, false);
  assert.equal(seconds, 30);
  assert.equal(isQualifiedWatch(seconds), true);
  assert.equal(validateBehaviorEvent({ ...base, eventType: "qualified_watch", metadata: { definition: "continuous_playback_30s_v1" } }).ok, true);
});

test("completion is explicit and abandon excludes unknown incomplete states", () => {
  assert.equal(validateBehaviorEvent({ ...base, eventType: "play_complete", metadata: { completion_source: "watch_progress_final_save" } }).ok, true);
  assert.equal(shouldEmitPlayAbandon({ started: true, completed: false, reason: "background" }), false);
  assert.equal(shouldEmitPlayAbandon({ started: true, completed: false, reason: "explicit_exit" }), true);
  assert.equal(validateBehaviorEvent({ ...base, eventType: "play_abandon", metadata: { reason: "network_failure" } }).ok, false);
});

test("surface taxonomy and sensitive payloads are controlled", () => {
  assert.equal(validateBehaviorEvent({ ...base, sourceSurface: "homepage_banner" }).ok, false);
  assert.equal(validateBehaviorEvent({ ...base, accessToken: "secret" }).ok, false);
  assert.equal(validateBehaviorEvent({ ...base, metadata: { signed_playback_url: "https://private" } }).ok, false);
});

test("per-event metadata allowlists reject adversarial nested and disguised sensitive values", () => {
  const adversarial = [
    { note: "+91 98765 43210" },
    { label: "akash@example.com" },
    { harmless: { nested: { value: "access-token-value" } } },
    { context: { secret: "private-value" } },
  ];
  for (const metadata of adversarial) {
    assert.equal(validateBehaviorEvent({ ...base, metadata }).ok, false);
  }
  assert.equal(validateBehaviorEvent({ ...base, eventType: "content_impression", metadata: { visibility_fraction: 0.5, visible_duration_ms: 1000, note: "extra" } }).ok, false);
  assert.equal(validateBehaviorEvent({ ...base, eventType: "qualified_watch", metadata: { definition: "continuous_playback_30s_v1", watched_seconds: 31, nested: { email: "akash@example.com" } } }).ok, false);
});
