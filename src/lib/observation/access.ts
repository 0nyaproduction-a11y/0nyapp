import {
  toCanonicalEvent,
  validateObservation,
  type CanonicalEvent,
  type ObservationEnvelope,
} from "../../../shared/observation/foundation";

export type AccessEventType =
  | "ACCESS_CHECKED"
  | "ACCESS_GRANTED"
  | "ACCESS_DENIED"
  | "ENTITLEMENT_GRANTED"
  | "ENTITLEMENT_REVOKED"
  | "ENTITLEMENT_EXPIRED";

export type AccessAuthority = "server_access_resolver" | "server_entitlement";
export type AccessBasis = "free" | "entitlement" | "subscription" | "rewarded" | "unknown";

export type AccessEvidence = {
  eventType: AccessEventType;
  authority: AccessAuthority;
  contentId: string;
  contentType: "episode" | "short_film" | "series";
  entitlementId?: string | null;
  accessBasis?: AccessBasis | null;
  authorized: boolean | null;
  denialReason?: string | null;
  status: string;
  occurredAt: string;
  correlationId: string;
  requestId?: string | null;
  causationId?: string | null;
  dedupeKey?: string | null;
};

export type AccessObservationOptions = {
  observationId: string;
  sessionId: string;
  actorId?: string | null;
  source?: string;
};

const SAFE_REFERENCE = /^[A-Za-z0-9._:/-]{1,200}$/;
const SAFE_REASON = /^(?:not_found|access_required|age_verification_required|parental_required|media_not_ready|playback_unavailable|insufficient_balance|already_accessible|active_subscription|expired|revoked|unknown)$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE = /(?:https?:\/\/|bearer\s+|token\s*[:=]|secret\s*[:=]|password\s*[:=]|api[_-]?key\s*[:=]|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{7,}\d)/i;

function safeValue(value: string | null | undefined, field: string, errors: string[]) {
  if (value == null) return null;
  if (!SAFE_REFERENCE.test(value) || (!UUID_V4.test(value) && SENSITIVE.test(value))) {
    errors.push(`${field} must be a bounded non-sensitive reference.`);
    return null;
  }
  return value;
}

function validateSemantics(evidence: AccessEvidence, errors: string[]) {
  if (evidence.eventType === "ACCESS_GRANTED" && evidence.authorized !== true) {
    errors.push("ACCESS_GRANTED requires an authoritative authorized=true result.");
  }
  if (evidence.eventType === "ACCESS_DENIED" && evidence.authorized !== false) {
    errors.push("ACCESS_DENIED requires an authoritative authorized=false result.");
  }
  if (evidence.eventType === "ACCESS_CHECKED" && evidence.authorized == null) {
    errors.push("ACCESS_CHECKED requires an authoritative authorized result.");
  }
  if (evidence.eventType.startsWith("ENTITLEMENT_") && evidence.authority !== "server_entitlement") {
    errors.push("entitlement lifecycle requires server entitlement authority.");
  }
  if (evidence.denialReason != null && !SAFE_REASON.test(evidence.denialReason)) {
    errors.push("denialReason must be an allowlisted authoritative reason code.");
  }
  if (evidence.eventType === "ACCESS_DENIED" && evidence.denialReason == null) {
    // Unknown denial reasons remain unknown rather than being inferred.
  }
}

export function adaptAccessObservation(
  evidence: AccessEvidence,
  options: AccessObservationOptions,
): { ok: true; value: ObservationEnvelope } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!SAFE_REFERENCE.test(evidence.contentId)) errors.push("contentId must be a stable content reference.");
  safeValue(evidence.entitlementId, "entitlementId", errors);
  safeValue(evidence.dedupeKey, "dedupeKey", errors);
  if (!SAFE_REFERENCE.test(evidence.status)) errors.push("status must be a bounded status code.");
  validateSemantics(evidence, errors);
  const references: NonNullable<ObservationEnvelope["context"]["references"]> = {
    content_id: evidence.contentId,
  };
  const entitlementId = safeValue(evidence.entitlementId, "entitlementId", errors);
  if (entitlementId) references.entitlement_id = entitlementId;
  const observation: ObservationEnvelope = {
    observation_id: options.observationId,
    schema_version: "app_observation_v1",
    occurred_at: evidence.occurredAt,
    actor_id: options.actorId ?? null,
    session_id: options.sessionId,
    domain: "ACCESS",
    event_type: "ACCESS_OUTCOME",
    phase: "OUTCOME",
    source: options.source ?? `access:${evidence.authority}`,
    context: {
      source_surface: evidence.authority,
      content_type: evidence.contentType,
      references,
    },
    correlation_id: evidence.correlationId,
    request_id: evidence.requestId ?? null,
    causation_id: evidence.causationId ?? null,
    payload: {
      status: evidence.status,
      authorized: evidence.authorized,
    },
  };
  if (errors.length) return { ok: false, errors };
  return validateObservation(observation);
}

export function accessObservationKey(observation: ObservationEnvelope): string {
  return [
    observation.event_type,
    observation.correlation_id,
    observation.request_id ?? "",
    observation.occurred_at,
  ].join("|");
}

export function toAccessCanonicalEvent(observation: ObservationEnvelope): CanonicalEvent {
  return toCanonicalEvent(observation);
}

export function runAccessObservationFailOpen(
  task: Promise<unknown>,
  onFailure?: (error: unknown) => void,
) {
  void task.catch((error: unknown) => onFailure?.(error));
}
