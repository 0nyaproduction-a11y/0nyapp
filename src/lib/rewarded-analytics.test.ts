import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateClientRewardedEvent,
  CLIENT_REWARDED_EVENT_TYPES,
} from "./rewarded-analytics.ts";

test("valid client rewarded events pass validation", () => {
  for (const eventType of CLIENT_REWARDED_EVENT_TYPES) {
    const result = validateClientRewardedEvent({
      eventType,
      episodeId: "ep-123",
      adIndex: 1,
      requiredCount: 2,
      resultingProgress: 1,
      metadata: { source: "paywall" },
    });
    assert.equal(result.ok, true, `expected ${eventType} to be valid`);
  }
});

test("unknown event types are rejected", () => {
  const result = validateClientRewardedEvent({ eventType: "REWARDED_UNLOCK_GRANTED" });
  assert.equal(result.ok, false);
});

test("metadata containing secret keys is rejected", () => {
  const result = validateClientRewardedEvent({
    eventType: "rewarded_cta_selected",
    metadata: { access_token: "abc", nested: { session_token: "x" } },
  });
  assert.equal(result.ok, false);
  assert.ok((result as { errors: string[] }).errors.length > 0);
});

test("out-of-range ad index is rejected", () => {
  const result = validateClientRewardedEvent({
    eventType: "rewarded_no_fill",
    adIndex: 9,
    requiredCount: 2,
  });
  assert.equal(result.ok, false);
});

test("requiredCount outside 1..2 is rejected", () => {
  const result = validateClientRewardedEvent({
    eventType: "rewarded_cta_selected",
    requiredCount: 5,
  });
  assert.equal(result.ok, false);
});

test("optional fields may be omitted and metadata normalized to object", () => {
  const result = validateClientRewardedEvent({ eventType: "rewarded_offer_shown" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.metadata, {});
    assert.equal(result.value.episodeId, null);
  }
});
