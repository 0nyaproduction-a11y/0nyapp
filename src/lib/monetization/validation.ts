/**
 * Monetization event validation — M1.1.
 *
 * Pure validation. No I/O, no database, no runtime integration, no
 * production authority. Invalid input is rejected; it is NEVER silently
 * coerced.
 *
 * Canonical references:
 *   - docs/architecture/07 App Integration/Monetization/MONETIZATION_OBSERVATION_BRIDGE_v0.2.md
 *   - docs/architecture/07 App Integration/Story/STORY_INTEGRATION_DATA_CONTRACT_v0.1.md
 */

import {
  MONETIZATION_EVENT_SCHEMA_VERSION,
  MONETIZATION_EVENT_TYPES,
  MONETIZATION_METHODS,
  OFFER_TYPES,
  type MonetizationEvent,
  type MonetizationEventType,
  type ClientImpressionInput,
  type OfferSnapshot,
  type OutcomeSnapshot,
  type ProviderRefs,
} from "./events.ts";

export const MAX_METADATA_BYTES = 4096;
export const MAX_TOTAL_BYTES = 8192;

const EVENT_TYPES_SET = new Set<string>(MONETIZATION_EVENT_TYPES as readonly string[]);
const METHOD_SET = new Set<string>(MONETIZATION_METHODS as readonly string[]);
const OFFER_TYPE_SET = new Set<string>(OFFER_TYPES as readonly string[]);

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_UTC_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SOURCE_RE = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;

/** Substrings that, if present in ANY object key, indicate a prohibited secret. */
const PROHIBITED_KEY_SUBSTRINGS = [
  "token",
  "secret",
  "password",
  "pin",
  "cookie",
  "signature",
  "authorization",
  "service_role",
  "api_key",
  "access_token",
  "refresh_token",
  "session_token",
];

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export function isValidUuidV4(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}

export function isValidIsoUtc(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_UTC_RE.test(value)) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function byteLengthOf(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    // If it cannot be stringified, treat as a single large byte block.
    return Number.MAX_SAFE_INTEGER;
  }
}

function containsProhibitedKey(key: string): boolean {
  const k = key.toLowerCase();
  return PROHIBITED_KEY_SUBSTRINGS.some((s) => k.includes(s));
}

/** Recursively scan an object graph for prohibited secret keys. */
function scanProhibitedKeys(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((v) => scanProhibitedKeys(v));
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (containsProhibitedKey(k)) return true;
      if (scanProhibitedKeys(v)) return true;
    }
  }
  return false;
}

function validateSource(source: unknown): string[] {
  const errors: string[] = [];
  if (typeof source !== "string" || !SOURCE_RE.test(source)) {
    errors.push("source must match '<location>:<handler>:<detail>'");
  }
  return errors;
}

function validateOffer(offer: unknown): string[] {
  const errors: string[] = [];
  if (typeof offer !== "object" || offer === null) {
    errors.push("offer must be an object");
    return errors;
  }
  const o = offer as Record<string, unknown>;
  if (typeof o.offer_type !== "string" || !OFFER_TYPE_SET.has(o.offer_type)) {
    errors.push("offer.offer_type invalid");
  }
  if (
    !Array.isArray(o.available_methods) ||
    !o.available_methods.every(
      (m) => typeof m === "string" && METHOD_SET.has(m),
    )
  ) {
    errors.push("offer.available_methods must be an array of known methods");
  }
  if (
    o.selected_method !== null &&
    (typeof o.selected_method !== "string" ||
      !METHOD_SET.has(o.selected_method))
  ) {
    errors.push("offer.selected_method must be null or a known method");
  }
  return errors;
}

function validateOutcome(outcome: unknown): string[] {
  const errors: string[] = [];
  if (typeof outcome !== "object" || outcome === null) {
    errors.push("outcome must be an object");
    return errors;
  }
  const o = outcome as Record<string, unknown>;
  if (typeof o.status !== "string") {
    errors.push("outcome.status must be a string");
  }
  return errors;
}

function validateProviderRefs(refs: unknown): string[] {
  const errors: string[] = [];
  if (typeof refs !== "object" || refs === null) {
    errors.push("provider_refs must be an object");
    return errors;
  }
  const r = refs as Record<string, unknown>;
  const allowed = [
    "provider",
    "provider_transaction_id",
    "rewarded_custom_data",
    "chai_idempotency_key",
  ];
  for (const key of Object.keys(r)) {
    if (!allowed.includes(key)) {
      errors.push(`provider_refs.${key} is not an allowed field`);
    }
  }
  return errors;
}

/** Types whose outcome must be present (authoritative result already known). */
const REQUIRES_OUTCOME = new Set<MonetizationEventType>([
  "COIN_PURCHASE_COMPLETED",
  "COIN_PURCHASE_FAILED",
  "REWARDED_UNLOCK_GRANTED",
  "REWARDED_UNLOCK_FAILED",
  "CHAI_TIP_COMPLETED",
  "CHAI_TIP_FAILED",
]);

/** Types that must NOT carry an outcome (pre-decision / intent). */
const FORBIDS_OUTCOME = new Set<MonetizationEventType>([
  "MONETIZATION_OPPORTUNITY",
  "PAYWALL_SHOWN",
  "OFFER_SHOWN",
  "COIN_PURCHASE_STARTED",
  "REWARDED_UNLOCK_STARTED",
  "CHAI_TIP_STARTED",
]);

export function validateMonetizationEvent(
  input: unknown,
): ValidationResult<MonetizationEvent> {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["event must be an object"] };
  }

  // Privacy: reject prohibited secret keys anywhere in the payload.
  if (scanProhibitedKeys(input)) {
    errors.push("payload contains prohibited secret/key material");
  }

  const e = input as Record<string, unknown>;

  if (e.schema_version !== MONETIZATION_EVENT_SCHEMA_VERSION) {
    errors.push(
      `schema_version must be '${MONETIZATION_EVENT_SCHEMA_VERSION}'`,
    );
  }

  if (
    typeof e.event_type !== "string" ||
    !EVENT_TYPES_SET.has(e.event_type)
  ) {
    errors.push("event_type invalid");
  }

  if (!isValidUuidV4(e.event_id)) {
    errors.push("event_id must be a UUIDv4");
  }
  if (!isValidUuidV4(e.correlation_id)) {
    errors.push("correlation_id must be a UUIDv4");
  }
  if (e.request_id !== undefined && e.request_id !== null) {
    if (!isValidUuidV4(e.request_id)) {
      errors.push("request_id must be a UUIDv4 when present");
    }
  }
  // dedupe_key is intentionally NOT required to be a UUID.
  if (
    e.dedupe_key !== undefined &&
    e.dedupe_key !== null &&
    typeof e.dedupe_key !== "string"
  ) {
    errors.push("dedupe_key must be a string when present");
  }

  if (!isValidIsoUtc(e.occurred_at)) {
    errors.push("occurred_at must be a valid UTC ISO-8601 timestamp");
  }

  errors.push(...validateSource(e.source));

  for (const idKey of ["user_id", "episode_id", "short_film_id"] as const) {
    const v = e[idKey];
    if (v !== undefined && v !== null && typeof v !== "string") {
      errors.push(`${idKey} must be a string or null when present`);
    }
  }

  if (e.offer !== undefined && e.offer !== null) {
    errors.push(...validateOffer(e.offer));
  }
  if (e.outcome !== undefined && e.outcome !== null) {
    errors.push(...validateOutcome(e.outcome));
  }
  if (e.provider_refs !== undefined && e.provider_refs !== null) {
    errors.push(...validateProviderRefs(e.provider_refs));
  }

  if (typeof e.metadata !== "object" || e.metadata === null || Array.isArray(e.metadata)) {
    errors.push("metadata must be an object");
  } else {
    const metaBytes = byteLengthOf(e.metadata);
    if (metaBytes > MAX_METADATA_BYTES) {
      errors.push(
        `metadata exceeds ${MAX_METADATA_BYTES} bytes (${metaBytes})`,
      );
    }
  }

  // Semantic: outcome presence rules.
  const type = e.event_type as MonetizationEventType;
  if (REQUIRES_OUTCOME.has(type) && (e.outcome === undefined || e.outcome === null)) {
    errors.push(`${type} requires an outcome`);
  }
  if (FORBIDS_OUTCOME.has(type) && e.outcome !== undefined && e.outcome !== null) {
    errors.push(`${type} must not carry an outcome`);
  }

  // Total payload size guard (secondary; metadata guard is primary).
  const totalBytes = byteLengthOf(input);
  if (totalBytes > MAX_TOTAL_BYTES) {
    errors.push(`event exceeds ${MAX_TOTAL_BYTES} bytes (${totalBytes})`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: input as unknown as MonetizationEvent,
  };
}

const CLIENT_IMPRESSION_ALLOWED_KEYS = new Set([
  "event_id",
  "correlation_id",
  "impression_kind",
  "episode_id",
  "short_film_id",
  "client_observed_at",
]);

const IMPRESSION_KINDS = new Set([
  "MONETIZATION_OPPORTUNITY",
  "PAYWALL_SHOWN",
  "OFFER_SHOWN",
]);

/**
 * Validate the MINIMAL client impression input. The client may only assert
 * the keys in CLIENT_IMPRESSION_ALLOWED_KEYS; it may NOT assert trusted
 * economic state (user_id, wallet balance, coin price, subscription state,
 * ownership, entitlement, CMS flags, available methods). Those are
 * reconstructed server-side.
 */
export function validateClientImpressionInput(
  input: unknown,
): ValidationResult<ClientImpressionInput> {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["client impression must be an object"] };
  }
  if (scanProhibitedKeys(input)) {
    errors.push("client impression contains prohibited secret/key material");
  }

  const c = input as Record<string, unknown>;

  for (const key of Object.keys(c)) {
    if (!CLIENT_IMPRESSION_ALLOWED_KEYS.has(key)) {
      errors.push(`client may not assert trusted field: ${key}`);
    }
  }

  if (!isValidUuidV4(c.event_id)) {
    errors.push("event_id must be a UUIDv4");
  }
  if (!isValidUuidV4(c.correlation_id)) {
    errors.push("correlation_id must be a UUIDv4");
  }
  if (
    typeof c.impression_kind !== "string" ||
    !IMPRESSION_KINDS.has(c.impression_kind)
  ) {
    errors.push("impression_kind invalid");
  }
  if (c.episode_id === undefined && c.short_film_id === undefined) {
    errors.push("one of episode_id / short_film_id is required");
  }
  if (
    c.client_observed_at !== undefined &&
    c.client_observed_at !== null &&
    !isValidIsoUtc(c.client_observed_at)
  ) {
    errors.push("client_observed_at must be a valid UTC ISO-8601 timestamp");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: input as unknown as ClientImpressionInput };
}

export type { MonetizationEvent, ClientImpressionInput, OfferSnapshot, OutcomeSnapshot, ProviderRefs };
