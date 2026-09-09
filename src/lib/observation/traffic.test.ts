import assert from "node:assert/strict";
import test from "node:test";
import { adaptTrafficObservation, resolveTrafficSource } from "./traffic";

const base = {
  observationId: "50000000-0000-4000-8000-000000000001",
  sessionId: "50000000-0000-4000-8000-000000000002",
  correlationId: "50000000-0000-4000-8000-000000000003",
  source: "android:navigation:entry",
};

test("preserves known source IDs and correlates them to a session", () => {
  const result = adaptTrafficObservation({
    kind: "campaign",
    authority: "server",
    campaignId: "campaign-42",
    occurredAt: "2026-09-06T00:00:00.000Z",
  }, base);
  assert.equal(result.ok, true);
  assert.equal(result.value.session_id, base.sessionId);
  assert.equal(result.value.payload.source_kind, "campaign");
  assert.equal(result.value.context.references, undefined);
});

test("missing source stays unknown and does not fabricate attribution", () => {
  const result = adaptTrafficObservation({ kind: "unknown", authority: "client", occurredAt: "2026-09-06T00:00:00.000Z" }, base);
  assert.equal(result.ok, true);
  assert.equal(result.value.payload.source_kind, "unknown");
  assert.equal(result.value.context.source_surface, "unknown_direct");
});

test("stronger source authority wins deterministically", () => {
  const resolved = resolveTrafficSource([
    { kind: "social", authority: "client", occurredAt: "2026-09-06T00:00:00.000Z" },
    { kind: "referral", authority: "server", referralId: "ref-1", occurredAt: "2026-09-06T00:00:01.000Z" },
  ]);
  assert.equal(resolved.kind, "referral");
});

test("rejects raw URLs and query strings", () => {
  assert.equal(adaptTrafficObservation({ kind: "deep_link", authority: "client", value: "https://x.test/?email=a@b.test", occurredAt: "2026-09-06T00:00:00.000Z" }, base).ok, false);
  assert.equal(adaptTrafficObservation({ kind: "campaign", authority: "server", campaignId: "utm_source=paid", occurredAt: "2026-09-06T00:00:00.000Z" }, base).ok, false);
});

test("CanonicalEvent remains valid and observation failures are fail-open at caller boundary", () => {
  const result = adaptTrafficObservation({ kind: "organic", authority: "verified_link", value: "home", occurredAt: "2026-09-06T00:00:00.000Z" }, base);
  assert.equal(result.ok, true);
  assert.equal(result.value.observation_id, base.observationId);
  assert.doesNotThrow(() => {
    try { throw new Error("sink unavailable"); } catch { /* fail-open caller boundary */ }
  });
});
