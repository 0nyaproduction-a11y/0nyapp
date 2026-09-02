import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateMonetizationEvent,
  validateClientImpressionInput,
  isValidUuidV4,
} from "./validation.ts";
import {
  OBSERVABLE_FEATURE_FIELDS,
  type MonetizationEventType,
} from "./events.ts";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const TS = "2026-08-30T12:00:00.000Z";

function base(type: MonetizationEventType): Record<string, unknown> {
  return {
    event_id: UUID,
    schema_version: "0.2",
    event_type: type,
    occurred_at: TS,
    correlation_id: UUID,
    source: "server:route:test",
    metadata: {},
  };
}

const offer = {
  offer_type: "episode_access",
  available_methods: ["free", "coin_unlock", "rewarded_ad", "plus"],
  selected_method: null,
  is_free: false,
  coin_price: 15,
  coin_unlock_enabled: true,
  rewarded_unlock_enabled: true,
  rewarded_access_mode: "permanent",
  plus_access: true,
  wallet_balance_coins: 100,
  has_active_subscription: false,
  already_owned: false,
  preview_seconds: 2,
};

const outcome = {
  status: "purchase_success",
  success: true,
  remaining_balance_coins: 85,
  entitlement_granted: true,
};

// 1-9: valid current-flow events
test("1. valid MONETIZATION_OPPORTUNITY", () => {
  const r = validateMonetizationEvent({ ...base("MONETIZATION_OPPORTUNITY"), offer });
  assert.equal(r.ok, true);
});

test("2. valid PAYWALL_SHOWN", () => {
  const r = validateMonetizationEvent({ ...base("PAYWALL_SHOWN"), offer });
  assert.equal(r.ok, true);
});

test("3. valid COIN_PURCHASE_STARTED", () => {
  const r = validateMonetizationEvent({
    ...base("COIN_PURCHASE_STARTED"),
    request_id: UUID,
    offer,
  });
  assert.equal(r.ok, true);
});

test("4. valid COIN_PURCHASE_COMPLETED", () => {
  const r = validateMonetizationEvent({
    ...base("COIN_PURCHASE_COMPLETED"),
    request_id: UUID,
    offer,
    outcome,
  });
  assert.equal(r.ok, true);
});

test("5. valid COIN_PURCHASE_FAILED", () => {
  const r = validateMonetizationEvent({
    ...base("COIN_PURCHASE_FAILED"),
    request_id: UUID,
    offer,
    outcome: { ...outcome, status: "insufficient_balance", success: false },
  });
  assert.equal(r.ok, true);
});

test("6. valid REWARDED_UNLOCK_STARTED", () => {
  const r = validateMonetizationEvent({
    ...base("REWARDED_UNLOCK_STARTED"),
    request_id: UUID,
    offer,
    provider_refs: { rewarded_custom_data: "attempt-abc" },
  });
  assert.equal(r.ok, true);
});

test("7. valid REWARDED_UNLOCK_GRANTED", () => {
  const r = validateMonetizationEvent({
    ...base("REWARDED_UNLOCK_GRANTED"),
    offer,
    outcome: { status: "granted", success: true, entitlement_granted: true },
    provider_refs: {
      provider: "google_admob",
      provider_transaction_id: "txn-1",
      rewarded_custom_data: "attempt-abc",
    },
  });
  assert.equal(r.ok, true);
});

test("8. valid REWARDED_UNLOCK_FAILED", () => {
  const r = validateMonetizationEvent({
    ...base("REWARDED_UNLOCK_FAILED"),
    offer,
    outcome: { status: "not_granted", success: false },
    provider_refs: { rewarded_custom_data: "attempt-abc" },
  });
  assert.equal(r.ok, true);
});

test("9. valid CHAI started/completed/failed", () => {
  const started = validateMonetizationEvent({
    ...base("CHAI_TIP_STARTED"),
    request_id: UUID,
    offer: { offer_type: "chai_tip", available_methods: ["chai_tip"], selected_method: null, chai_enabled: true },
    provider_refs: { chai_idempotency_key: "idem-1" },
  });
  const completed = validateMonetizationEvent({
    ...base("CHAI_TIP_COMPLETED"),
    request_id: UUID,
    offer: { offer_type: "chai_tip", available_methods: ["chai_tip"], selected_method: "chai_tip", chai_enabled: true },
    outcome: { status: "tip_accepted", success: true, amount_coins: 10, remaining_balance_coins: 90 },
    provider_refs: { chai_idempotency_key: "idem-1" },
  });
  const failed = validateMonetizationEvent({
    ...base("CHAI_TIP_FAILED"),
    request_id: UUID,
    offer: { offer_type: "chai_tip", available_methods: ["chai_tip"], selected_method: "chai_tip", chai_enabled: true },
    outcome: { status: "tip_failed", success: false },
    provider_refs: { chai_idempotency_key: "idem-1" },
  });
  assert.equal(started.ok, true);
  assert.equal(completed.ok, true);
  assert.equal(failed.ok, true);
});

// 10-12: identifier semantics
test("10. UUIDv4 event_id accepted", () => {
  assert.equal(isValidUuidV4(UUID), true);
});

test("11. non-UUID event_id rejected", () => {
  const r = validateMonetizationEvent({ ...base("PAYWALL_SHOWN"), event_id: "not-a-uuid" });
  assert.equal(r.ok, false);
  assert.ok((r as { errors: string[] }).errors.some((e) => e.includes("event_id")));
});

test("12. non-UUID dedupe_key accepted", () => {
  const r = validateMonetizationEvent({
    ...base("REWARDED_UNLOCK_GRANTED"),
    dedupe_key: "plain-deterministic-key-123",
    outcome,
  });
  assert.equal(r.ok, true);
});

// 13-14: provider refs not assumed UUID
test("13. non-UUID AdMob custom_data accepted in provider_refs", () => {
  const r = validateMonetizationEvent({
    ...base("REWARDED_UNLOCK_GRANTED"),
    outcome,
    provider_refs: { provider: "google_admob", rewarded_custom_data: "not-a-uuid-token" },
  });
  assert.equal(r.ok, true);
});

test("14. non-UUID Chai idempotency key accepted in provider_refs", () => {
  const r = validateMonetizationEvent({
    ...base("CHAI_TIP_COMPLETED"),
    outcome,
    offer: { offer_type: "chai_tip", available_methods: ["chai_tip"], selected_method: "chai_tip" },
    provider_refs: { chai_idempotency_key: "idem-not-uuid" },
  });
  assert.equal(r.ok, true);
});

// 15-18: client impression trust boundary
function clientInput(extra: Record<string, unknown>) {
  return validateClientImpressionInput({
    event_id: UUID,
    correlation_id: UUID,
    impression_kind: "PAYWALL_SHOWN",
    episode_id: "ep-1",
    ...extra,
  });
}

test("15. client impression cannot supply wallet balance", () => {
  const r = clientInput({ wallet_balance_coins: 100 });
  assert.equal(r.ok, false);
});

test("16. client impression cannot supply price", () => {
  const r = clientInput({ coin_price: 15 });
  assert.equal(r.ok, false);
});

test("17. client impression cannot supply user_id", () => {
  const r = clientInput({ user_id: "usr-1" });
  assert.equal(r.ok, false);
});

test("18. client impression cannot supply subscription state", () => {
  const r = clientInput({ has_active_subscription: true });
  assert.equal(r.ok, false);
});

// 19-20: semantic outcome rules
test("19. outcome rejected on opportunity/impression", () => {
  const r = validateMonetizationEvent({
    ...base("MONETIZATION_OPPORTUNITY"),
    offer,
    outcome,
  });
  assert.equal(r.ok, false);
});

test("20. completed event without outcome rejected", () => {
  const r = validateMonetizationEvent({
    ...base("COIN_PURCHASE_COMPLETED"),
    request_id: UUID,
    offer,
  });
  assert.equal(r.ok, false);
});

// 21-24: privacy rejection
test("21. raw purchase token rejected", () => {
  const r = validateMonetizationEvent({
    ...base("PAYWALL_SHOWN"),
    metadata: { purchase_token: "secret" },
  });
  assert.equal(r.ok, false);
});

test("22. auth token rejected", () => {
  const r = validateMonetizationEvent({
    ...base("PAYWALL_SHOWN"),
    metadata: { access_token: "secret" },
  });
  assert.equal(r.ok, false);
});

test("23. cookie rejected", () => {
  const r = validateMonetizationEvent({
    ...base("PAYWALL_SHOWN"),
    metadata: { cookie: "secret" },
  });
  assert.equal(r.ok, false);
});

test("24. webhook signature rejected", () => {
  const r = validateMonetizationEvent({
    ...base("PAYWALL_SHOWN"),
    metadata: { signature: "secret" },
  });
  assert.equal(r.ok, false);
});

// 25-26: observable feature allowlist boundaries
test("25. identifiers excluded from observable feature allowlist", () => {
  for (const f of ["user_id", "episode_id", "short_film_id", "event_id", "correlation_id", "request_id", "dedupe_key", "source"]) {
    assert.ok(!OBSERVABLE_FEATURE_FIELDS.includes(f as never), `${f} must not be eligible`);
  }
});

test("26. provider refs excluded from observable features", () => {
  assert.ok(!OBSERVABLE_FEATURE_FIELDS.includes("provider_refs" as never));
});

// 27-28: size limits
test("27. metadata size limit enforced", () => {
  const r = validateMonetizationEvent({
    ...base("PAYWALL_SHOWN"),
    metadata: { big: "x".repeat(5000) },
  });
  assert.equal(r.ok, false);
});

test("28. total payload size limit enforced", () => {
  const r = validateMonetizationEvent({
    ...base("PAYWALL_SHOWN"),
    metadata: { big: "x".repeat(4500) },
  });
  assert.equal(r.ok, false);
});

// 29-30: invalid type / timestamp
test("29. invalid event type rejected", () => {
  const r = validateMonetizationEvent({ ...base("SUBSCRIPTION_STARTED" as MonetizationEventType) });
  assert.equal(r.ok, false);
});

test("30. invalid timestamp rejected", () => {
  const r = validateMonetizationEvent({
    ...base("PAYWALL_SHOWN"),
    occurred_at: "2026-13-45T99:99:99",
  });
  assert.equal(r.ok, false);
});

// 31: spoofed rewarded callback cannot become REWARDED_UNLOCK_FAILED
test("31a. spoofed webhook signature cannot be embedded in FAILED event", () => {
  const r = validateMonetizationEvent({
    ...base("REWARDED_UNLOCK_FAILED"),
    offer,
    outcome: { status: "not_granted", success: false },
    metadata: { signature: "spoofed" },
  });
  assert.equal(r.ok, false);
});

test("31b. REWARDED_UNLOCK_FAILED without authoritative outcome rejected", () => {
  const r = validateMonetizationEvent({
    ...base("REWARDED_UNLOCK_FAILED"),
    offer,
    // no outcome -> cannot represent trusted non-grant state
  });
  assert.equal(r.ok, false);
});
