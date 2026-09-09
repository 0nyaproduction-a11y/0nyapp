import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptSystemFailureObservation,
  runSystemObservationFailOpen,
  systemFailureObservationKey,
  toSystemCanonicalEvent,
} from "./system";

const ids = {
  observation: "50000000-0000-4000-8000-000000000401",
  session: "50000000-0000-4000-8000-000000000402",
  correlation: "50000000-0000-4000-8000-000000000403",
  request: "50000000-0000-4000-8000-000000000404",
  transaction: "50000000-0000-4000-8000-000000000405",
};

const base = {
  observationId: ids.observation,
  source: "system:failure",
};

test("classifies proven playback failure and preserves correlation", () => {
  const result = adaptSystemFailureObservation({
    eventType: "PLAYBACK_FAILED",
    authority: "playback_result",
    failureKind: "technical",
    safeCode: "manifest.timeout",
    retryable: true,
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    requestId: ids.request,
    sessionId: ids.session,
    contentId: "episode-1",
  }, base);
  assert.equal(result.ok, true);
  assert.equal(result.value.correlation_id, ids.correlation);
  assert.equal(result.value.context.references?.content_id, "episode-1");
});

test("user cancellation is not classified as system failure", () => {
  const result = adaptSystemFailureObservation({
    eventType: "PLAYBACK_FAILED",
    authority: "playback_result",
    failureKind: "technical",
    safeCode: "user.cancelled",
    retryable: false,
    userCancelled: true,
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  assert.equal(result.ok, false);
});

test("unavailable content is distinct from playback failure and unknown cause stays unknown", () => {
  const unavailable = adaptSystemFailureObservation({
    eventType: "MEDIA_UNAVAILABLE",
    authority: "media_result",
    failureKind: "unavailable",
    safeCode: "media.not_ready",
    retryable: true,
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  const unknown = adaptSystemFailureObservation({
    eventType: "API_REQUEST_FAILED",
    authority: "api_result",
    failureKind: "unknown",
    safeCode: null,
    retryable: null,
    occurredAt: "2026-09-06T00:00:01.000Z",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  assert.equal(unavailable.ok, true);
  assert.equal(unknown.ok, true);
  assert.equal(unknown.value.payload.failure_kind, "unknown");
  assert.equal(unknown.value.payload.safe_code, null);
});

test("preserves payment transaction linkage and deterministic retry identity", () => {
  const result = adaptSystemFailureObservation({
    eventType: "PAYMENT_FAILED",
    authority: "payment_result",
    failureKind: "provider",
    safeCode: "provider.declined",
    retryable: false,
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    requestId: ids.request,
    sessionId: ids.session,
    transactionId: ids.transaction,
    dedupeKey: "payment-retry-1",
  }, base);
  assert.equal(result.ok, true);
  assert.equal(result.value.context.references?.transaction_id, ids.transaction);
  assert.equal(systemFailureObservationKey(result.value), systemFailureObservationKey(result.value));
});

test("rejects sensitive payload material and invalid timestamps", () => {
  const sensitive = adaptSystemFailureObservation({
    eventType: "API_REQUEST_FAILED",
    authority: "api_result",
    failureKind: "technical",
    safeCode: "https://api.test/?token=secret",
    retryable: true,
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  const temporal = adaptSystemFailureObservation({
    eventType: "API_REQUEST_FAILED",
    authority: "api_result",
    failureKind: "technical",
    safeCode: "network.timeout",
    retryable: true,
    occurredAt: "2026-09-06T05:30:00+05:30",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  assert.equal(sensitive.ok, false);
  assert.equal(temporal.ok, false);
});

test("CanonicalEvent projection and error recovery remain fail-open", async () => {
  const result = adaptSystemFailureObservation({
    eventType: "ENTITLEMENT_CHECK_FAILED",
    authority: "entitlement_result",
    failureKind: "authorization",
    safeCode: "access.lookup_failed",
    retryable: true,
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  assert.equal(result.ok, true);
  assert.equal(toSystemCanonicalEvent(result.value).event_id, ids.observation);
  let failure: unknown = null;
  runSystemObservationFailOpen(Promise.reject(new Error("sink unavailable")), (error) => {
    failure = error;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((failure as Error).message, "sink unavailable");
});
