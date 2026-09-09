import {
  toCanonicalEvent,
  validateObservation,
  type CanonicalEvent,
  type ObservationEnvelope,
} from "../../../shared/observation/foundation";

export type SystemFailureEventType =
  | "PLAYBACK_FAILED"
  | "API_REQUEST_FAILED"
  | "PAYMENT_FAILED"
  | "ENTITLEMENT_CHECK_FAILED"
  | "MEDIA_UNAVAILABLE"
  | "CONTENT_LOAD_FAILED";

export type FailureAuthority =
  | "playback_result"
  | "api_result"
  | "payment_result"
  | "entitlement_result"
  | "media_result"
  | "content_result";

export type FailureKind =
  | "technical"
  | "provider"
  | "authorization"
  | "unavailable"
  | "unknown";

export type SystemFailureEvidence = {
  eventType: SystemFailureEventType;
  authority: FailureAuthority;
  failureKind: FailureKind;
  safeCode: string | null;
  retryable: boolean | null;
  userCancelled?: boolean;
  occurredAt: string;
  correlationId: string;
  sessionId: string;
  contentId?: string | null;
  requestId?: string | null;
  transactionId?: string | null;
  entitlementId?: string | null;
  dedupeKey?: string | null;
};

export type SystemObservationOptions = {
  observationId: string;
  actorId?: string | null;
  source?: string;
};

const SAFE_CODE = /^(?:[a-z0-9]+)(?:[._:/-][a-z0-9]+){0,7}$/;
const SAFE_REFERENCE = /^[A-Za-z0-9._:/-]{1,200}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE =
  /(?:https?:\/\/|bearer\s+|token\s*[:=]|secret\s*[:=]|password\s*[:=]|api[_-]?key\s*[:=]|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{7,}\d)/i;

function safeReference(value: string | null | undefined, field: string, errors: string[]) {
  if (value == null) return null;
  if (!SAFE_REFERENCE.test(value) || (!UUID_V4.test(value) && SENSITIVE.test(value))) {
    errors.push(`${field} must be a bounded non-sensitive reference.`);
    return null;
  }
  return value;
}

function validateFailureSemantics(evidence: SystemFailureEvidence, errors: string[]) {
  if (evidence.safeCode != null && !SAFE_CODE.test(evidence.safeCode)) {
    errors.push("safeCode must be a bounded stable reason code.");
  }
  if (evidence.eventType === "MEDIA_UNAVAILABLE" && evidence.failureKind !== "unavailable") {
    errors.push("MEDIA_UNAVAILABLE requires unavailable failure kind.");
  }
  if (evidence.eventType === "PLAYBACK_FAILED" && evidence.failureKind === "unavailable") {
    errors.push("unavailable media must not be classified as playback failure.");
  }
  if (evidence.userCancelled === true && evidence.failureKind !== "unknown") {
    errors.push("user cancellation cannot be promoted to a technical failure kind.");
  }
}

export function adaptSystemFailureObservation(
  evidence: SystemFailureEvidence,
  options: SystemObservationOptions,
): { ok: true; value: ObservationEnvelope } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const contentId = safeReference(evidence.contentId, "contentId", errors);
  const transactionId = safeReference(evidence.transactionId, "transactionId", errors);
  const entitlementId = safeReference(evidence.entitlementId, "entitlementId", errors);
  safeReference(evidence.dedupeKey, "dedupeKey", errors);
  validateFailureSemantics(evidence, errors);

  const references: NonNullable<ObservationEnvelope["context"]["references"]> = {};
  if (contentId) references.content_id = contentId;
  if (transactionId) references.transaction_id = transactionId;
  if (entitlementId) references.entitlement_id = entitlementId;

  const observation: ObservationEnvelope = {
    observation_id: options.observationId,
    schema_version: "app_observation_v1",
    occurred_at: evidence.occurredAt,
    actor_id: options.actorId ?? null,
    session_id: evidence.sessionId,
    domain: "SYSTEM",
    event_type: "SYSTEM_FAILURE",
    phase: "OUTCOME",
    source: options.source ?? `system:${evidence.authority}`,
    context: {
      source_surface: evidence.authority,
      references: Object.keys(references).length ? references : null,
    },
    correlation_id: evidence.correlationId,
    request_id: evidence.requestId ?? null,
    causation_id: null,
    payload: {
      failure_kind: evidence.failureKind,
      safe_code: evidence.safeCode,
      retryable: evidence.retryable,
    },
  };
  if (errors.length) return { ok: false, errors };
  return validateObservation(observation);
}

export function systemFailureObservationKey(observation: ObservationEnvelope): string {
  return [
    observation.event_type,
    observation.correlation_id,
    observation.request_id ?? "",
    observation.occurred_at,
  ].join("|");
}

export function toSystemCanonicalEvent(observation: ObservationEnvelope): CanonicalEvent {
  return toCanonicalEvent(observation);
}

export function runSystemObservationFailOpen(
  task: Promise<unknown>,
  onFailure?: (error: unknown) => void,
) {
  void task.catch((error: unknown) => onFailure?.(error));
}
