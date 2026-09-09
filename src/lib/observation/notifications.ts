import {
  toCanonicalEvent,
  validateObservation,
  type CanonicalEvent,
  type ObservationEnvelope,
} from "../../../shared/observation/foundation";

export type NotificationEventType =
  | "NOTIFICATION_QUEUED"
  | "NOTIFICATION_SENT"
  | "NOTIFICATION_DELIVERED"
  | "NOTIFICATION_OPENED"
  | "NOTIFICATION_DISMISSED"
  | "NOTIFICATION_FAILED";

export type NotificationEvidenceAuthority = "provider" | "client";
export type NotificationChannel = "push" | "in_app" | "email" | "unknown";

export type NotificationEvidence = {
  eventType: NotificationEventType;
  authority: NotificationEvidenceAuthority;
  channel: NotificationChannel;
  occurredAt: string;
  notificationId?: string | null;
  messageId?: string | null;
  campaignId?: string | null;
  sessionId?: string | null;
  trafficCorrelationId?: string | null;
  correlationId: string;
  requestId?: string | null;
  causationId?: string | null;
};

export type NotificationObservationOptions = {
  observationId: string;
  actorId?: string | null;
  source: string;
};

const SAFE_ID = /^[A-Za-z0-9._:/-]{1,200}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_VALUE =
  /(?:https?:\/\/|www\.|[?&#=]|(?:bearer|token|secret|password|api[_-]?key|signature)\s*[:=]|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{7,}\d)/i;

const PROVIDER_ONLY_EVENTS = new Set<NotificationEventType>([
  "NOTIFICATION_SENT",
  "NOTIFICATION_DELIVERED",
]);

function safeId(value: string | null | undefined, field: string, errors: string[]) {
  if (value == null) return null;
  if (!SAFE_ID.test(value) || (!UUID_V4.test(value) && SENSITIVE_VALUE.test(value))) {
    errors.push(`${field} must be a bounded identifier without URLs, PII, or secrets.`);
    return null;
  }
  return value;
}

export function adaptNotificationObservation(
  evidence: NotificationEvidence,
  options: NotificationObservationOptions,
): { ok: true; value: ObservationEnvelope } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (PROVIDER_ONLY_EVENTS.has(evidence.eventType) && evidence.authority !== "provider") {
    errors.push(`${evidence.eventType} requires provider-confirmed evidence.`);
  }
  if (evidence.eventType === "NOTIFICATION_DISMISSED" && evidence.authority !== "client") {
    errors.push("NOTIFICATION_DISMISSED requires client-observed evidence.");
  }
  if (evidence.channel === "unknown") errors.push("notification channel must be known or the event remains unobserved.");
  safeId(evidence.notificationId, "notificationId", errors);
  safeId(evidence.messageId, "messageId", errors);
  safeId(evidence.campaignId, "campaignId", errors);
  const sessionId = safeId(evidence.sessionId, "sessionId", errors);
  safeId(evidence.trafficCorrelationId, "trafficCorrelationId", errors);
  const observation: ObservationEnvelope = {
    observation_id: options.observationId,
    schema_version: "app_observation_v1",
    occurred_at: evidence.occurredAt,
    actor_id: options.actorId ?? null,
    session_id: sessionId ?? "00000000-0000-4000-8000-000000000000",
    domain: "NOTIFICATION",
    event_type: "NOTIFICATION_OUTCOME",
    phase: "OUTCOME",
    source: options.source,
    context: {
      source_surface: evidence.authority === "provider" ? "notification_provider" : "notification_client",
    },
    correlation_id: evidence.correlationId,
    request_id: evidence.requestId ?? null,
    causation_id: evidence.causationId ?? null,
    payload: {
      channel: evidence.channel,
      status: evidence.eventType.slice("NOTIFICATION_".length).toLowerCase(),
    },
  };
  if (errors.length) return { ok: false, errors };
  if (!sessionId) return { ok: false, errors: ["notification observation requires a stable session_id."] };
  return validateObservation(observation);
}

export function toNotificationCanonicalEvent(observation: ObservationEnvelope): CanonicalEvent {
  return toCanonicalEvent(observation);
}

export function runNotificationObservationFailOpen(
  task: Promise<unknown>,
  onFailure?: (error: unknown) => void,
) {
  void task.catch((error: unknown) => onFailure?.(error));
}
