import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptNotificationObservation,
  runNotificationObservationFailOpen,
  toNotificationCanonicalEvent,
} from "./notifications";

const ids = {
  observation: "50000000-0000-4000-8000-000000000101",
  session: "50000000-0000-4000-8000-000000000102",
  correlation: "50000000-0000-4000-8000-000000000103",
  request: "50000000-0000-4000-8000-000000000104",
  causation: "50000000-0000-4000-8000-000000000105",
};

const base = {
  observationId: ids.observation,
  actorId: null,
  source: "notification:observation",
};

test("preserves send-to-outcome correlation and original timestamps", () => {
  const result = adaptNotificationObservation({
    eventType: "NOTIFICATION_DELIVERED",
    authority: "provider",
    channel: "push",
    occurredAt: "2026-09-06T00:00:02.000Z",
    notificationId: "notification-1",
    messageId: "message-1",
    correlationId: ids.correlation,
    requestId: ids.request,
    causationId: ids.causation,
    sessionId: ids.session,
  }, base);
  assert.equal(result.ok, true);
  assert.equal(result.value.occurred_at, "2026-09-06T00:00:02.000Z");
  assert.equal(result.value.correlation_id, ids.correlation);
  assert.equal(result.value.causation_id, ids.causation);
  assert.equal(result.value.context.references, undefined);
});

test("does not promote client evidence to sent or delivered", () => {
  for (const eventType of ["NOTIFICATION_SENT", "NOTIFICATION_DELIVERED"] as const) {
    const result = adaptNotificationObservation({
      eventType,
      authority: "client",
      channel: "push",
      occurredAt: "2026-09-06T00:00:00.000Z",
      correlationId: ids.correlation,
      sessionId: ids.session,
    }, base);
    assert.equal(result.ok, false);
  }
});

test("distinguishes provider and client observed lifecycle evidence", () => {
  const sent = adaptNotificationObservation({
    eventType: "NOTIFICATION_SENT",
    authority: "provider",
    channel: "push",
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  const opened = adaptNotificationObservation({
    eventType: "NOTIFICATION_OPENED",
    authority: "client",
    channel: "push",
    occurredAt: "2026-09-06T00:00:01.000Z",
    correlationId: ids.correlation,
    sessionId: ids.session,
    trafficCorrelationId: "traffic-entry-1",
  }, base);
  assert.equal(sent.ok, true);
  assert.equal(opened.ok, true);
  assert.equal(opened.value.context.source_surface, "notification_client");
  assert.equal(opened.value.event_type, "NOTIFICATION_OUTCOME");
});

test("requires known lifecycle state and preserves missing evidence as unobserved", () => {
  const result = adaptNotificationObservation({
    eventType: "NOTIFICATION_OPENED",
    authority: "client",
    channel: "unknown",
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  assert.equal(result.ok, false);
});

test("rejects sensitive identifiers and message-like data", () => {
  const result = adaptNotificationObservation({
    eventType: "NOTIFICATION_OPENED",
    authority: "client",
    channel: "push",
    occurredAt: "2026-09-06T00:00:00.000Z",
    notificationId: "https://example.test/?token=secret",
    messageId: "hello@example.com",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  assert.equal(result.ok, false);
});

test("rejects temporal invalidity and keeps CanonicalEvent compatible", () => {
  const result = adaptNotificationObservation({
    eventType: "NOTIFICATION_OPENED",
    authority: "client",
    channel: "in_app",
    occurredAt: "2026-09-06T05:30:00+05:30",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  assert.equal(result.ok, false);
  const valid = adaptNotificationObservation({
    eventType: "NOTIFICATION_DISMISSED",
    authority: "client",
    channel: "in_app",
    occurredAt: "2026-09-06T00:00:00.000Z",
    correlationId: ids.correlation,
    sessionId: ids.session,
  }, base);
  assert.equal(valid.ok, true);
  assert.equal(toNotificationCanonicalEvent(valid.value).event_id, ids.observation);
});

test("observation failure cannot affect notification behavior", async () => {
  let failure: unknown = null;
  runNotificationObservationFailOpen(Promise.reject(new Error("sink unavailable")), (error) => {
    failure = error;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((failure as Error).message, "sink unavailable");
});
