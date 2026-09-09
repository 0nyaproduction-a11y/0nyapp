import assert from "node:assert/strict";
import test from "node:test";
import {
  accessObservationKey,
  adaptAccessObservation,
  runAccessObservationFailOpen,
  toAccessCanonicalEvent,
} from "./access";

const ids = {
  observation: "50000000-0000-4000-8000-000000000301",
  session: "50000000-0000-4000-8000-000000000302",
  correlation: "50000000-0000-4000-8000-000000000303",
  request: "50000000-0000-4000-8000-000000000304",
  entitlement: "50000000-0000-4000-8000-000000000305",
};

const base = {
  observationId: ids.observation,
  sessionId: ids.session,
  source: "server:access",
};

test("preserves grant/deny correlation and authoritative reason", () => {
  const checked = adaptAccessObservation({
    eventType: "ACCESS_CHECKED",
    authority: "server_access_resolver",
    contentId: "episode-1",
    contentType: "episode",
    accessBasis: "entitlement",
    authorized: true,
    status: "authorized",
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    requestId: ids.request,
    entitlementId: ids.entitlement,
  }, base);
  const granted = adaptAccessObservation({
    eventType: "ACCESS_GRANTED",
    authority: "server_access_resolver",
    contentId: "episode-1",
    contentType: "episode",
    accessBasis: "entitlement",
    authorized: true,
    status: "authorized",
    occurredAt: "2026-09-06T00:00:01.000Z",
    correlationId: ids.correlation,
    requestId: ids.request,
    entitlementId: ids.entitlement,
  }, base);
  assert.equal(checked.ok, true);
  assert.equal(granted.ok, true);
  assert.equal(granted.value.correlation_id, checked.value.correlation_id);
  assert.equal(granted.value.context.references?.entitlement_id, ids.entitlement);
});

test("unknown denial reason stays unknown and not watched is distinct from denied access", () => {
  const result = adaptAccessObservation({
    eventType: "ACCESS_DENIED",
    authority: "server_access_resolver",
    contentId: "episode-2",
    contentType: "episode",
    accessBasis: "unknown",
    authorized: false,
    status: "not_watched",
    denialReason: null,
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
  }, base);
  assert.equal(result.ok, true);
  assert.equal(result.value.payload.status, "not_watched");
  assert.equal(result.value.event_type, "ACCESS_OUTCOME");
});

test("client UI cannot override server entitlement truth", () => {
  assert.equal(adaptAccessObservation({
    eventType: "ENTITLEMENT_GRANTED",
    authority: "server_access_resolver",
    contentId: "episode-1",
    contentType: "episode",
    authorized: true,
    status: "granted",
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
  }, base).ok, false);
  assert.equal(adaptAccessObservation({
    eventType: "ACCESS_GRANTED",
    authority: "server_access_resolver",
    contentId: "episode-1",
    contentType: "episode",
    authorized: true,
    status: "authorized",
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
  }, base).ok, true);
});

test("duplicate and retry identity is deterministic", () => {
  const result = adaptAccessObservation({
    eventType: "ACCESS_DENIED",
    authority: "server_access_resolver",
    contentId: "episode-1",
    contentType: "episode",
    authorized: false,
    status: "access_required",
    denialReason: "access_required",
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    requestId: ids.request,
    dedupeKey: "access-retry-1",
  }, base);
  assert.equal(result.ok, true);
  assert.equal(accessObservationKey(result.value), accessObservationKey(result.value));
});

test("rejects sensitive entitlement data and invalid temporal values", () => {
  assert.equal(adaptAccessObservation({
    eventType: "ENTITLEMENT_GRANTED",
    authority: "server_entitlement",
    contentId: "episode-1",
    contentType: "episode",
    entitlementId: "purchase_token=secret",
    authorized: true,
    status: "granted",
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
  }, base).ok, false);
  assert.equal(adaptAccessObservation({
    eventType: "ACCESS_GRANTED",
    authority: "server_access_resolver",
    contentId: "episode-1",
    contentType: "episode",
    authorized: true,
    status: "authorized",
    occurredAt: "2026-09-06T05:30:00+05:30",
    correlationId: ids.correlation,
  }, base).ok, false);
});

test("CanonicalEvent projection and fail-open access behavior remain valid", async () => {
  const result = adaptAccessObservation({
    eventType: "ENTITLEMENT_EXPIRED",
    authority: "server_entitlement",
    contentId: "episode-1",
    contentType: "episode",
    authorized: false,
    status: "expired",
    denialReason: "expired",
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    entitlementId: ids.entitlement,
  }, base);
  assert.equal(result.ok, true);
  assert.equal(toAccessCanonicalEvent(result.value).event_id, ids.observation);
  let failure: unknown = null;
  runAccessObservationFailOpen(Promise.reject(new Error("sink unavailable")), (error) => {
    failure = error;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((failure as Error).message, "sink unavailable");
});
