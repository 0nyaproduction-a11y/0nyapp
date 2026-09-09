import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptMonetizationObservation,
  runMonetizationObservationFailOpen,
  toMonetizationCanonicalEvent,
} from "./monetization";

const ID = "50000000-0000-4000-8000-000000000001";
const SESSION = "50000000-0000-4000-8000-000000000002";
const REQUEST = "50000000-0000-4000-8000-000000000003";
const EVENT_TIME = "2026-09-06T00:00:00.000Z";

function event(event_type: "COIN_PURCHASE_STARTED" | "COIN_PURCHASE_COMPLETED" | "COIN_PURCHASE_FAILED" = "COIN_PURCHASE_COMPLETED") {
  return {
    event_id: ID,
    schema_version: "0.2",
    event_type,
    occurred_at: EVENT_TIME,
    correlation_id: ID,
    request_id: REQUEST,
    dedupe_key: "coin-order-retry-1",
    source: "server:route:purchase",
    user_id: null,
    offer: { offer_type: "episode_access", available_methods: ["coin_unlock"], selected_method: "coin_unlock", coin_price: 15 },
    outcome: event_type === "COIN_PURCHASE_STARTED" ? null : { status: event_type === "COIN_PURCHASE_COMPLETED" ? "purchase_success" : "insufficient_balance", success: event_type === "COIN_PURCHASE_COMPLETED", amount_coins: 15 },
    metadata: {},
  };
}

test("maps authoritative attempt and outcome with preserved IDs and timestamps", () => {
  const attempt = adaptMonetizationObservation(event("COIN_PURCHASE_STARTED"), { sessionId: SESSION });
  const success = adaptMonetizationObservation(event(), { sessionId: SESSION });
  assert.equal(attempt.ok, true);
  assert.equal(success.ok, true);
  assert.equal(attempt.value.observation_id, ID);
  assert.equal(success.value.correlation_id, ID);
  assert.equal(success.value.request_id, REQUEST);
  assert.equal(success.value.occurred_at, EVENT_TIME);
  assert.equal(success.value.event_type, "MONETIZATION_OUTCOME");
  assert.equal(success.value.payload.amount_coins, 15);
});

test("maps authoritative failure and keeps retry identity deterministic", () => {
  const first = adaptMonetizationObservation(event("COIN_PURCHASE_FAILED"), { sessionId: SESSION });
  const retry = adaptMonetizationObservation(event("COIN_PURCHASE_FAILED"), { sessionId: SESSION });
  assert.equal(first.ok, true);
  assert.equal(retry.ok, true);
  assert.equal(first.value.observation_id, retry.value.observation_id);
  assert.equal(first.value.event_type, retry.value.event_type);
  assert.equal(first.value.payload.success, false);
});

test("does not emit an attempt without trustworthy retry/correlation identity", () => {
  const attempted = event("COIN_PURCHASE_STARTED");
  assert.equal(adaptMonetizationObservation({ ...attempted, request_id: undefined }, { sessionId: SESSION }).ok, false);
  assert.equal(adaptMonetizationObservation({ ...attempted, dedupe_key: undefined }, { sessionId: SESSION }).ok, false);
});

test("rejects invalid amounts and sensitive payment material", () => {
  assert.equal(adaptMonetizationObservation({ ...event(), outcome: { status: "ok", amount_coins: -1 }, metadata: {} }, { sessionId: SESSION }).ok, false);
  assert.equal(adaptMonetizationObservation({ ...event(), metadata: { purchase_token: "secret" } }, { sessionId: SESSION }).ok, false);
});

test("anonymous behavior is explicit and CanonicalEvent remains compatible", () => {
  const result = adaptMonetizationObservation(event(), { sessionId: SESSION, actorId: null });
  assert.equal(result.ok, true);
  assert.equal(result.value.actor_id, null);
  const canonical = toMonetizationCanonicalEvent(result.value);
  assert.equal(canonical.event_id, ID);
  assert.equal(canonical.timestamp, EVENT_TIME);
  assert.equal(canonical.context.correlation_id, ID);
  assert.equal("order_id" in canonical.observable_features, false);
});

test("outcomes cannot be placed in an attempted event", () => {
  const attempted = event("COIN_PURCHASE_STARTED");
  attempted.outcome = { status: "purchase_success", success: true, amount_coins: 15 };
  assert.equal(adaptMonetizationObservation(attempted, { sessionId: SESSION }).ok, false);
});

test("observation failure is fail-open", async () => {
  let failed = false;
  runMonetizationObservationFailOpen(Promise.reject(new Error("sink down")), () => {
    failed = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failed, true);
});
