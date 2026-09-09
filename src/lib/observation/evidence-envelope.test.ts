import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  EVIDENCE_ENVELOPE_SCHEMA_VERSION,
  evaluateEvidenceIngress,
  evidenceContentHash,
  evidenceIdempotencyKey,
  serializeEvidenceEnvelope,
  validateEvidenceEnvelope,
  type EvidenceEnvelopeInput,
} from "../../../shared/observation/evidence-envelope";

const IDS = {
  actor: "00000000-0000-4000-8000-000000000001",
  correlation: "00000000-0000-4000-8000-000000000002",
  evidence: "00000000-0000-4000-8000-000000000003",
  session: "00000000-0000-4000-8000-000000000004",
  transaction: "00000000-0000-4000-8000-000000000005",
  ranking: "00000000-0000-4000-8000-000000000006",
} as const;

function fixture(overrides: Partial<EvidenceEnvelopeInput> = {}): EvidenceEnvelopeInput {
  return {
    producer_id: "android.consumer",
    evidence_id: IDS.evidence,
    occurred_at: "2026-09-06T00:00:00.000Z",
    domain: "SESSION",
    type: "APP_OPENED",
    source: "android:app_lifecycle",
    source_version: "android_session_v1",
    actor_id: null,
    session_id: IDS.session,
    correlation: { correlation_id: IDS.correlation, request_id: null, causation_id: null },
    references: {},
    payload: { launch_reason: "process_start" },
    ...overrides,
  };
}

function accepted(input: EvidenceEnvelopeInput = fixture()) {
  const result = validateEvidenceEnvelope(input);
  if (!result.ok) assert.fail(result.errors.join(" "));
  return result.value;
}

test("EvidenceEnvelope serialization and content hash are deterministic", () => {
  const first = accepted(fixture({ payload: { beta: true, alpha: "value" } }));
  const second = accepted(fixture({ payload: { alpha: "value", beta: true } }));
  assert.equal(serializeEvidenceEnvelope(first), serializeEvidenceEnvelope(second));
  assert.equal(evidenceContentHash(first), evidenceContentHash(second));
  assert.match(evidenceContentHash(first), /^[a-f0-9]{64}$/);
  assert.equal(
    evidenceContentHash(first),
    createHash("sha256").update(serializeEvidenceEnvelope(first)).digest("hex"),
  );
});

test("EvidenceEnvelope requires producer-owned UUID identities and canonical timestamps", () => {
  const invalidIdentity = validateEvidenceEnvelope(fixture({ evidence_id: "purchase-42" }));
  assert.deepEqual(invalidIdentity.ok ? null : invalidIdentity.disposition, "REJECT_IDENTITY");
  const invalidTimestamp = validateEvidenceEnvelope(fixture({ occurred_at: "2026-09-06T00:00:00Z" }));
  assert.deepEqual(invalidTimestamp.ok ? null : invalidTimestamp.disposition, "REJECT_TIMESTAMP");
});

test("EvidenceEnvelope permits nullable actor and session evidence", () => {
  const result = validateEvidenceEnvelope(fixture({ actor_id: null, session_id: null }));
  assert.equal(result.ok, true);
});

test("EvidenceEnvelope rejects arbitrary nested, oversized, and sensitive payloads", () => {
  const nested = validateEvidenceEnvelope(fixture({ payload: { nested: { unsafe: true } } as never }));
  const oversized = validateEvidenceEnvelope(fixture({ payload: { value: "a".repeat(257) } }));
  const sensitive = validateEvidenceEnvelope(fixture({ payload: { token: "Bearer secret-value" } }));
  for (const result of [nested, oversized, sensitive]) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.disposition, "REJECT_PRIVACY");
  }
});

test("EvidenceEnvelope ingress differentiates duplicate equivalence from idempotency conflict", () => {
  const envelope = accepted();
  const first = evaluateEvidenceIngress(envelope);
  assert.equal(first.disposition, "ACCEPT");
  if (first.disposition !== "ACCEPT") throw new Error("Expected acceptance.");
  const duplicate = evaluateEvidenceIngress(envelope, first);
  assert.equal(duplicate.disposition, "DUPLICATE");
  const changed = accepted(fixture({ payload: { launch_reason: "warm_start" } }));
  const conflict = evaluateEvidenceIngress(changed, first);
  assert.equal(conflict.disposition, "IDEMPOTENCY_CONFLICT");
  assert.equal(evidenceIdempotencyKey(envelope), `${envelope.producer_id}|${envelope.evidence_id}|${EVIDENCE_ENVELOPE_SCHEMA_VERSION}`);
});

test("EvidenceEnvelope represents Android APP_OPENED lifecycle evidence", () => {
  const result = validateEvidenceEnvelope(fixture());
  assert.equal(result.ok, true);
});

test("EvidenceEnvelope represents persisted coin-unlock success evidence", () => {
  const result = validateEvidenceEnvelope(fixture({
    producer_id: "backend.product",
    evidence_id: IDS.transaction,
    occurred_at: "2026-09-06T00:01:00.000Z",
    domain: "MONETIZATION",
    type: "COIN_UNLOCK_SUCCEEDED",
    source: "server:route:episode_purchase",
    source_version: "coin_unlock_evidence_v1",
    actor_id: IDS.actor,
    session_id: null,
    correlation: { correlation_id: IDS.transaction, request_id: null, causation_id: null },
    references: { content_id: "episode-123", transaction_id: IDS.transaction },
    payload: { amount_coins: 20, status: "purchase_success", success: true },
  }));
  assert.equal(result.ok, true);
});

test("EvidenceEnvelope represents ranking decision evidence without reconciling schemas", () => {
  const result = validateEvidenceEnvelope(fixture({
    producer_id: "backend.ranking",
    evidence_id: IDS.ranking,
    occurred_at: "2026-09-06T00:02:00.000Z",
    domain: "RANKING",
    type: "RANKING_DECISION",
    source: "server:ranking",
    source_version: "ranking_decision_v1",
    actor_id: IDS.actor,
    correlation: { correlation_id: IDS.ranking, request_id: null, causation_id: null },
    references: { candidate_set_id: "candidate-set-123", ranking_decision_id: IDS.ranking },
    payload: { candidate_count: 12, deterministic: true, source_surface: "home" },
  }));
  assert.equal(result.ok, true);
});
