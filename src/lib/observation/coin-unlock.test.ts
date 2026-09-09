import assert from "node:assert/strict";
import test from "node:test";

import {
  createPersistedCoinUnlockObservation,
  emitPersistedCoinUnlockObservation,
} from "./coin-unlock";

const ACTOR_ID = "50000000-0000-4000-8000-000000000001";
const EPISODE_ID = "50000000-0000-4000-8000-000000000002";
const TRANSACTION_ID = "50000000-0000-4000-8000-000000000003";
const OCCURRED_AT = "2026-09-06T00:00:00.000Z";

function input() {
  return {
    actorId: ACTOR_ID,
    episodeId: EPISODE_ID,
    evidence: {
      amountCoins: 30,
      occurredAt: OCCURRED_AT,
      transactionId: TRANSACTION_ID,
    },
  };
}

test("emits a persisted success with authoritative ledger identity, time, and amount", async () => {
  const emissions: Array<Record<string, unknown>> = [];
  const result = emitPersistedCoinUnlockObservation(input(), (observation, canonicalEvent) => {
    void observation;
    emissions.push(canonicalEvent.context);
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.observation_id, TRANSACTION_ID);
  assert.equal(result.value.correlation_id, TRANSACTION_ID);
  assert.equal(result.value.occurred_at, OCCURRED_AT);
  assert.equal(result.value.payload.amount_coins, 30);
  assert.equal(result.value.session_id, null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(emissions.length, 1);
  assert.equal(emissions[0].session_id, null);
});

test("retries produce the same deterministic persisted observation identity", () => {
  const first = createPersistedCoinUnlockObservation(input());
  const retry = createPersistedCoinUnlockObservation(input());

  assert.equal(first.ok, true);
  assert.equal(retry.ok, true);
  assert.deepEqual(first.value, retry.value);
});

test("does not emit unsupported failure-shaped evidence", async () => {
  const emissions: unknown[] = [];
  const result = emitPersistedCoinUnlockObservation({
    ...input(),
    evidence: { ...input().evidence, occurredAt: "" },
  }, (observation) => {
    emissions.push(observation);
  });

  assert.equal(result.ok, false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(emissions.length, 0);
});

test("rejects sensitive content and preserves fail-open emission", async () => {
  const sensitive = createPersistedCoinUnlockObservation({
    ...input(),
    episodeId: "purchase_token=private",
  });
  assert.equal(sensitive.ok, false);

  assert.doesNotThrow(() =>
    emitPersistedCoinUnlockObservation(input(), () => {
      throw new Error("unavailable");
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
});
