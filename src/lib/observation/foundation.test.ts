import assert from "node:assert/strict";
import test from "node:test";

import {
  OBSERVATION_SCHEMA_VERSION,
  runObservationFailOpen,
  serializeObservation,
  toCanonicalEvent,
  validateObservation,
  type ObservationEnvelope,
} from "../../../shared/observation/foundation";

const ids = {
  observation: "50000000-0000-4000-8000-000000000001",
  actor: "50000000-0000-4000-8000-000000000002",
  session: "50000000-0000-4000-8000-000000000003",
  correlation: "50000000-0000-4000-8000-000000000004",
  request: "50000000-0000-4000-8000-000000000005",
  order: "50000000-0000-4000-8000-000000000006",
};

function validObservation(overrides: Partial<ObservationEnvelope> = {}): ObservationEnvelope {
  return {
    observation_id: ids.observation,
    schema_version: OBSERVATION_SCHEMA_VERSION,
    occurred_at: "2026-09-06T00:00:00.000Z",
    actor_id: ids.actor,
    session_id: ids.session,
    domain: "MONETIZATION",
    event_type: "MONETIZATION_OUTCOME",
    phase: "OUTCOME",
    source: "server:route:purchase",
    context: {
      source_surface: "episode_access",
      references: { order_id: ids.order },
    },
    correlation_id: ids.correlation,
    request_id: ids.request,
    causation_id: null,
    payload: { status: "purchase_success", success: true, amount_coins: 30 },
    ...overrides,
  };
}

function assertRejected(value: unknown, expected: string) {
  const result = validateObservation(value);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), new RegExp(expected));
}

test("preserves timestamps, correlation, references, and anonymous actors", () => {
  const result = validateObservation(validObservation({ actor_id: null }));
  assert.equal(result.ok, true);
  assert.equal(result.value.occurred_at, "2026-09-06T00:00:00.000Z");
  assert.equal(result.value.correlation_id, ids.correlation);
  assert.equal(result.value.context.references?.order_id, ids.order);
  assert.equal(result.value.actor_id, null);
});

test("admits a server-authoritative outcome without a trustworthy app session", () => {
  const result = validateObservation(
    validObservation({
      actor_id: null,
      session_id: null,
      context: { references: { transaction_id: ids.order } },
    }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.session_id, null);
  assert.equal(serializeObservation(result.value), serializeObservation({ ...result.value }));
  assert.equal(toCanonicalEvent(result.value).context.session_id, null);
});

test("requires session identity for session and client-originated observations", () => {
  assertRejected(
    validObservation({
      session_id: null,
      domain: "SESSION",
      event_type: "APP_BACKGROUND",
      phase: "OUTCOME",
      payload: { background_reason: "app_state" },
    }),
    "session_id",
  );
  assertRejected(validObservation({ session_id: null, source: "android:purchase" }), "session_id");
});

test("keeps amount_coins mandatory for monetization outcomes", () => {
  assertRejected(
    validObservation({ payload: { status: "purchase_success", success: true } }),
    "amount_coins is required",
  );
});

test("does not admit a server failure without durable identity and occurrence time", () => {
  assertRejected(
    validObservation({
      observation_id: null as never,
      occurred_at: "",
      session_id: null,
      payload: { status: "insufficient_balance", success: false, amount_coins: 30 },
    }),
    "observation_id.*occurred_at",
  );
});

test("accepts all reserved domains through controlled event definitions", () => {
  const cases: Array<[ObservationEnvelope["domain"], ObservationEnvelope["event_type"], ObservationEnvelope["phase"], Record<string, string | number | boolean>]> = [
    ["SESSION", "SESSION_STARTED", "PRE_ACTION", { entry_point: "home" }],
    ["TRAFFIC", "TRAFFIC_SOURCE_OBSERVED", "PRE_ACTION", { source_kind: "deep_link", source_value: "series" }],
    ["NOTIFICATION", "NOTIFICATION_OUTCOME", "OUTCOME", { status: "blocked", channel: "push" }],
    ["CONTENT", "CONTENT_PERFORMANCE", "OUTCOME", { metric: "qualified_watch", value: 30 }],
    ["ACCESS", "ACCESS_OUTCOME", "OUTCOME", { status: "authorized", authorized: true }],
    ["SYSTEM", "SYSTEM_FAILURE", "OUTCOME", { failure_kind: "provider", safe_code: "timeout", retryable: true }],
  ];
  for (const [domain, event_type, phase, payload] of cases) {
    const result = validateObservation(validObservation({ domain, event_type, phase, payload }));
    assert.equal(result.ok, true, `${domain} should validate`);
  }
});

test("rejects PII, secrets, and arbitrary nested metadata", () => {
  assertRejected(validObservation({ payload: { status: "person@example.com" } }), "PII");
  assertRejected(validObservation({ payload: { status: "access_token=private" } }), "PII");
  assertRejected(validObservation({ payload: { status: "api_key=private" } }), "PII");
  assertRejected(validObservation({ payload: { status: { nested: "value" } as never } }), "scalar");
  assertRejected(validObservation({ payload: { arbitrary: "value" } }), "not allowed");
});

test("rejects temporal leakage between phase and event type", () => {
  assertRejected(validObservation({ event_type: "MONETIZATION_ACTION", phase: "OUTCOME", payload: { offer_type: "coin_unlock" } }), "phase");
  assertRejected(validObservation({ event_type: "MONETIZATION_OUTCOME", phase: "OUTCOME", payload: { offer_type: "coin_unlock" } }), "not allowed");
});

test("rejects the removed fork-only event, context, and reference fields", () => {
  assertRejected(validObservation({ event_type: "PURCHASE_ATTEMPTED" as never }), "event_type");
  assertRejected(validObservation({ context: { dedupe_key: "retry-1" } as never }), "not allowed");
  assertRejected(validObservation({ context: { references: { episode_id: "episode-1" } } as never }), "not allowed");
});

test("serializes deterministically and projects CanonicalEvent without moving IDs into features", () => {
  const value = validObservation();
  const first = validateObservation(value);
  const second = validateObservation({ ...value, context: { references: { order_id: ids.order }, source_surface: "episode_access" } });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(serializeObservation(first.value), serializeObservation(second.value));
  const canonical = toCanonicalEvent(first.value);
  assert.equal(canonical.event_id, ids.observation);
  assert.equal(canonical.timestamp, value.occurred_at);
  assert.equal(canonical.context.correlation_id, ids.correlation);
  assert.equal("order_id" in canonical.observable_features, false);
});

test("fail-open producer does not reject the product action when observation fails", async () => {
  let observedFailure: unknown = null;
  runObservationFailOpen(Promise.reject(new Error("observation unavailable")), (error) => {
    observedFailure = error;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((observedFailure as Error).message, "observation unavailable");
});
