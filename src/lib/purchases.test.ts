import assert from "node:assert/strict";
import test from "node:test";

import {
  toPurchaseEvidence,
  toPurchaseObservationEvidence,
} from "./purchases";

const TRANSACTION_ID = "123e4567-e89b-42d3-a456-426614174000";
const OCCURRED_AT = "2026-09-06T00:00:00.000Z";

test("projects only the existing authoritative ledger identity and timestamp", () => {
  assert.deepEqual(
    toPurchaseEvidence({
      id: TRANSACTION_ID,
      created_at: OCCURRED_AT,
    }),
    {
      transactionId: TRANSACTION_ID,
      occurredAt: OCCURRED_AT,
    },
  );
});

test("reuses the same persisted ledger row for a purchase retry", () => {
  const row = { id: TRANSACTION_ID, created_at: OCCURRED_AT };

  assert.deepEqual(toPurchaseEvidence(row), toPurchaseEvidence(row));
});

test("does not manufacture evidence when no authoritative ledger row exists", () => {
  assert.equal(toPurchaseEvidence(null), null);
});

test("does not expose ledger fields beyond the safe identity and timestamp", () => {
  const evidence = toPurchaseEvidence({
    id: TRANSACTION_ID,
    created_at: OCCURRED_AT,
  });

  assert.deepEqual(Object.keys(evidence ?? {}).sort(), ["occurredAt", "transactionId"]);
});

test("derives observation amount only from the persisted negative episode-purchase debit", () => {
  assert.deepEqual(
    toPurchaseObservationEvidence({
      amount: -30,
      created_at: OCCURRED_AT,
      id: TRANSACTION_ID,
    }),
    {
      amountCoins: 30,
      occurredAt: OCCURRED_AT,
      transactionId: TRANSACTION_ID,
    },
  );
  assert.equal(
    toPurchaseObservationEvidence({
      amount: 30,
      created_at: OCCURRED_AT,
      id: TRANSACTION_ID,
    }),
    null,
  );
});
