/**
 * Monetization observation event contracts — M1.1.
 *
 * This module defines TYPES ONLY. It performs no I/O, no database access,
 * no runtime integration, and grants no production authority. It is the
 * shared vocabulary for the Monetization Observation Bridge.
 *
 * Canonical architecture references (do not duplicate into source comments —
 * read the documents for full context):
 *   - docs/architecture/07 App Integration/Story/STORY_INTEGRATION_DATA_CONTRACT_v0.1.md
 *   - docs/architecture/07 App Integration/Monetization/MONETIZATION_OBSERVATION_BRIDGE_v0.2.md
 *
 * Relationship to the broader system:
 *   This is the MONETIZATION domain branch of the Story Integration
 *   nervous system. MonetizationEvent carries monetization evidence only.
 *   Story/CMS, engagement, retention and technical-health evidence are
 *   SEPARATE branches defined by STORY_INTEGRATION_DATA_CONTRACT_v0.1 and
 *   MUST NOT be duplicated here.
 *
 * Story Integration boundary (M1.1 must not duplicate these inside
 * MonetizationEvent): narrative_phase, emotional_intensity,
 * cliffhanger_strength, episode completion, binge velocity, D1/D7/D30,
 * technical playback metrics.
 */

export const MONETIZATION_EVENT_SCHEMA_VERSION = "0.2" as const;
export type MonetizationEventSchemaVersion =
  typeof MONETIZATION_EVENT_SCHEMA_VERSION;

/**
 * Event taxonomy for CURRENTLY LIVE product flows only.
 * Do NOT add event types for flows that are not yet live
 * (e.g. SUBSCRIPTION_*, FIAT_PAYMENT_COMPLETED, REFUND_COMPLETED).
 */
export type MonetizationEventType =
  | "MONETIZATION_OPPORTUNITY"
  | "PAYWALL_SHOWN"
  | "OFFER_SHOWN"
  | "COIN_PURCHASE_STARTED"
  | "COIN_PURCHASE_COMPLETED"
  | "COIN_PURCHASE_FAILED"
  | "REWARDED_UNLOCK_STARTED"
  | "REWARDED_UNLOCK_GRANTED"
  | "REWARDED_UNLOCK_FAILED"
  | "CHAI_TIP_STARTED"
  | "CHAI_TIP_COMPLETED"
  | "CHAI_TIP_FAILED";

export const MONETIZATION_EVENT_TYPES: readonly MonetizationEventType[] = [
  "MONETIZATION_OPPORTUNITY",
  "PAYWALL_SHOWN",
  "OFFER_SHOWN",
  "COIN_PURCHASE_STARTED",
  "COIN_PURCHASE_COMPLETED",
  "COIN_PURCHASE_FAILED",
  "REWARDED_UNLOCK_STARTED",
  "REWARDED_UNLOCK_GRANTED",
  "REWARDED_UNLOCK_FAILED",
  "CHAI_TIP_STARTED",
  "CHAI_TIP_COMPLETED",
  "CHAI_TIP_FAILED",
];

export type MonetizationEventCategory =
  | "opportunity"
  | "impression"
  | "intent"
  | "success"
  | "failure"
  | "verified_provider_outcome";

export function getMonetizationEventCategory(
  type: MonetizationEventType,
): MonetizationEventCategory {
  switch (type) {
    case "MONETIZATION_OPPORTUNITY":
      return "opportunity";
    case "PAYWALL_SHOWN":
    case "OFFER_SHOWN":
      return "impression";
    case "COIN_PURCHASE_STARTED":
    case "REWARDED_UNLOCK_STARTED":
    case "CHAI_TIP_STARTED":
      return "intent";
    case "COIN_PURCHASE_COMPLETED":
    case "CHAI_TIP_COMPLETED":
      return "success";
    case "COIN_PURCHASE_FAILED":
    case "REWARDED_UNLOCK_FAILED":
    case "CHAI_TIP_FAILED":
      return "failure";
    case "REWARDED_UNLOCK_GRANTED":
      return "verified_provider_outcome";
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown monetization event type: ${String(_exhaustive)}`);
    }
  }
}

/** Monetization methods that may be simultaneously available. */
export type MonetizationMethod =
  | "free"
  | "coin_unlock"
  | "rewarded_ad"
  | "plus"
  | "chai_tip";

export const MONETIZATION_METHODS: readonly MonetizationMethod[] = [
  "free",
  "coin_unlock",
  "rewarded_ad",
  "plus",
  "chai_tip",
];

export type OfferType = "episode_access" | "chai_tip";

export const OFFER_TYPES: readonly OfferType[] = [
  "episode_access",
  "chai_tip",
];

/**
 * Sanitized, audit-only external references. These are NEVER model features.
 * They may NOT contain raw purchase tokens, webhook signatures, provider
 * secrets, or encrypted token ciphertext (enforced by validation).
 */
export interface ProviderRefs {
  provider?: string | null;
  provider_transaction_id?: string | null;
  rewarded_custom_data?: string | null;
  chai_idempotency_key?: string | null;
}

/**
 * Trusted SERVER-RECONSTRUCTED pre-decision state. The client is never
 * authoritative for these values. No singular access_kind; supports
 * simultaneous methods via available_methods / selected_method.
 *
 * No story/narrative fields belong here (see module header).
 */
export interface OfferSnapshot {
  offer_type: OfferType;
  available_methods: MonetizationMethod[];
  selected_method: MonetizationMethod | null;
  is_free?: boolean | null;
  coin_price?: number | null;
  coin_unlock_enabled?: boolean | null;
  rewarded_unlock_enabled?: boolean | null;
  rewarded_access_mode?: "permanent" | "session" | null;
  plus_access?: boolean | null;
  chai_enabled?: boolean | null;
  wallet_balance_coins?: number | null;
  has_active_subscription?: boolean | null;
  already_owned?: boolean | null;
  preview_seconds?: number | null;
}

/** Authoritative / post-action outcome. Never mixed into OfferSnapshot. */
export interface OutcomeSnapshot {
  status: string;
  success?: boolean | null;
  remaining_balance_coins?: number | null;
  entitlement_granted?: boolean | null;
  amount_coins?: number | null;
}

/**
 * The MonetizationEvent contract (v0.2 design).
 *
 * Identifier semantics (MUST stay separate):
 *   event_id       - UUIDv4 identity of one logical observation event
 *   correlation_id - UUIDv4 identity of one monetization journey
 *   request_id     - retry-stable identity of one logical request/intent
 *   dedupe_key     - optional deterministic string for provider/retry dedup
 *
 * Identifiers are audit/context values, NOT learning features.
 */
export interface MonetizationEvent {
  event_id: string;
  schema_version: MonetizationEventSchemaVersion;
  event_type: MonetizationEventType;
  occurred_at: string;
  correlation_id: string;
  request_id?: string | null;
  dedupe_key?: string | null;
  source: string;
  user_id?: string | null;
  episode_id?: string | null;
  short_film_id?: string | null;
  offer?: OfferSnapshot | null;
  outcome?: OutcomeSnapshot | null;
  provider_refs?: ProviderRefs | null;
  metadata: Record<string, unknown>;
}

/** Minimal client impression input. The client may NOT assert trusted state. */
export type ImpressionKind =
  | "MONETIZATION_OPPORTUNITY"
  | "PAYWALL_SHOWN"
  | "OFFER_SHOWN";

export interface ClientImpressionInput {
  event_id: string;
  correlation_id: string;
  impression_kind: ImpressionKind;
  episode_id?: string | null;
  short_film_id?: string | null;
  client_observed_at?: string | null;
}

/**
 * Explicit allowlist of MonetizationEvent fields eligible (later, by the
 * CanonicalEvent adapter) for observable_features.
 *
 * These identifiers MUST NEVER become observable_features:
 *   user_id, episode_id, short_film_id, event_id, correlation_id,
 *   request_id, dedupe_key, source, provider_refs
 *
 * Only trusted pre-decision economic/state values from OfferSnapshot are
 * eligible. The CanonicalEvent adapter itself is implemented in a later
 * stage (M1.9); this constant documents the boundary only.
 */
export const OBSERVABLE_FEATURE_FIELDS: readonly (keyof OfferSnapshot)[] = [
  "offer_type",
  "available_methods",
  "selected_method",
  "is_free",
  "coin_price",
  "coin_unlock_enabled",
  "rewarded_unlock_enabled",
  "rewarded_access_mode",
  "plus_access",
  "chai_enabled",
  "wallet_balance_coins",
  "has_active_subscription",
  "already_owned",
  "preview_seconds",
];

/** Fields that are identifiers/audit context and must never be features. */
export const NON_FEATURE_FIELDS: readonly (keyof MonetizationEvent)[] = [
  "event_id",
  "correlation_id",
  "request_id",
  "dedupe_key",
  "source",
  "user_id",
  "episode_id",
  "short_film_id",
  "provider_refs",
];

export function isEligibleObservableFeature(
  field: keyof OfferSnapshot,
): boolean {
  return OBSERVABLE_FEATURE_FIELDS.includes(field);
}
