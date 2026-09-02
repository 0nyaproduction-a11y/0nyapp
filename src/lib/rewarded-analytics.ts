/**
 * Smallest internal analytics path for rewarded monetization (Phase 14).
 *
 * This is NOT a financial authority. The rewarded_ad_attempts and
 * episode_entitlements tables remain authoritative for grants and progress.
 * These helpers validate client-emitted rewarded events before they are stored,
 * and ensure no secrets/PII leak into the analytics table.
 */

export const CLIENT_REWARDED_EVENT_TYPES = [
  "rewarded_offer_shown",
  "rewarded_cta_selected",
  "rewarded_no_fill",
  "rewarded_load_failed",
] as const;

export type ClientRewardedEventType = (typeof CLIENT_REWARDED_EVENT_TYPES)[number];

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
  "receipt",
  "transaction",
];

export type ClientRewardedEventInput = {
  eventType: unknown;
  episodeId?: unknown;
  adIndex?: unknown;
  requiredCount?: unknown;
  resultingProgress?: unknown;
  metadata?: unknown;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

function containsProhibitedKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsProhibitedKey);
  }

  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (PROHIBITED_KEY_SUBSTRINGS.some((s) => key.toLowerCase().includes(s))) {
        return true;
      }
      if (containsProhibitedKey(nested)) {
        return true;
      }
    }
  }

  return false;
}

function parseSmallInt(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 4 ? n : null;
}

export function validateClientRewardedEvent(
  input: unknown,
): ValidationResult<{
  eventType: ClientRewardedEventType;
  episodeId: string | null;
  adIndex: number | null;
  requiredCount: number | null;
  resultingProgress: number | null;
  metadata: Record<string, unknown>;
}> {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["event must be an object"] };
  }

  const body = input as Record<string, unknown>;

  if (
    typeof body.eventType !== "string" ||
    !CLIENT_REWARDED_EVENT_TYPES.includes(body.eventType as ClientRewardedEventType)
  ) {
    errors.push("eventType must be a known client rewarded event type");
  }

  if (body.episodeId !== undefined && body.episodeId !== null && typeof body.episodeId !== "string") {
    errors.push("episodeId must be a string or null");
  }

  if (parseSmallInt(body.adIndex) === null && body.adIndex !== undefined && body.adIndex !== null) {
    errors.push("adIndex must be a small non-negative integer or null");
  }

  if (
    parseSmallInt(body.requiredCount) === null &&
    body.requiredCount !== undefined &&
    body.requiredCount !== null
  ) {
    errors.push("requiredCount must be a small non-negative integer or null");
  }

  if (
    parseSmallInt(body.resultingProgress) === null &&
    body.resultingProgress !== undefined &&
    body.resultingProgress !== null
  ) {
    errors.push("resultingProgress must be a small non-negative integer or null");
  }

  if (body.metadata !== undefined && body.metadata !== null) {
    if (typeof body.metadata !== "object" || Array.isArray(body.metadata)) {
      errors.push("metadata must be an object");
    } else if (containsProhibitedKey(body.metadata)) {
      errors.push("metadata contains prohibited secret/key material");
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      eventType: body.eventType as ClientRewardedEventType,
      episodeId: typeof body.episodeId === "string" ? body.episodeId : null,
      adIndex: parseSmallInt(body.adIndex),
      requiredCount: parseSmallInt(body.requiredCount),
      resultingProgress: parseSmallInt(body.resultingProgress),
      metadata:
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? (body.metadata as Record<string, unknown>)
          : {},
    },
  };
}

export function isProhibitedAnalyticsKey(key: string): boolean {
  return containsProhibitedKey(key);
}
