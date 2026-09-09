/**
 * Shared App observation contract.
 *
 * This module is intentionally pure: it validates and serializes observations
 * but does not persist them, transport them, or grant any product authority.
 */

export const OBSERVATION_SCHEMA_VERSION = "app_observation_v1" as const;
export const CANONICAL_EVENT_COMPATIBILITY = "canonical_event_unversioned_2026-09-06" as const;

export const OBSERVATION_DOMAINS = [
  "SESSION",
  "MONETIZATION",
  "TRAFFIC",
  "NOTIFICATION",
  "CONTENT",
  "ACCESS",
  "SYSTEM",
] as const;

export type ObservationDomain = (typeof OBSERVATION_DOMAINS)[number];
export type ObservationPhase = "PRE_ACTION" | "OUTCOME";

export const OBSERVATION_EVENT_TYPES = [
  "SESSION_STARTED",
  "SESSION_RESUMED",
  "SESSION_ENDED",
  "APP_OPENED",
  "APP_BACKGROUND",
  "APP_FOREGROUND",
  "MONETIZATION_ACTION",
  "MONETIZATION_OUTCOME",
  "TRAFFIC_SOURCE_OBSERVED",
  "NOTIFICATION_OUTCOME",
  "CONTENT_PERFORMANCE",
  "ACCESS_OUTCOME",
  "SYSTEM_FAILURE",
] as const;

export type ObservationEventType = (typeof OBSERVATION_EVENT_TYPES)[number];
type ObservationPayloadValue = string | number | boolean | null;

export type ObservationReferenceKey =
  | "content_id"
  | "order_id"
  | "transaction_id"
  | "entitlement_id"
  | "rewarded_attempt_id"
  | "chai_tip_id"
  | "provider_transaction_id";

export type ObservationReferences = Partial<Record<ObservationReferenceKey, string>>;

export type ObservationContext = {
  source_surface?: string | null;
  route?: string | null;
  content_type?: string | null;
  references?: ObservationReferences | null;
};

export type ObservationPayload = Record<string, ObservationPayloadValue>;

export type ObservationEnvelope = {
  observation_id: string;
  schema_version: typeof OBSERVATION_SCHEMA_VERSION;
  occurred_at: string;
  actor_id: string | null;
  session_id: string | null;
  domain: ObservationDomain;
  event_type: ObservationEventType;
  phase: ObservationPhase;
  source: string;
  context: ObservationContext;
  correlation_id: string;
  request_id: string | null;
  causation_id: string | null;
  payload: ObservationPayload;
};

export type CanonicalEvent = {
  event_id: string;
  timestamp: string;
  observable_features: Record<string, string | number | boolean>;
  context: Record<string, unknown>;
};

export type ObservationInput = Omit<ObservationEnvelope, "schema_version"> & {
  schema_version?: typeof OBSERVATION_SCHEMA_VERSION;
};

export type ObservationValidationResult =
  | { ok: true; value: ObservationEnvelope }
  | { ok: false; errors: string[] };

type EventDefinition = {
  domain: ObservationDomain;
  phase: ObservationPhase;
  payloadKeys: readonly string[];
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE = /^[a-z0-9][a-z0-9._:/-]{0,99}$/i;
const SAFE_REFERENCE = /^[^\u0000-\u001f]{1,200}$/;
const PII_OR_SECRET_VALUE =
  /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\d\s().-]{7,}\d)|bearer\s+[A-Z0-9._-]+|(?:access|refresh|purchase|session)?_?token\s*[:=]\s*[^\s]+|(?:secret|password|api[_-]?key|signature)\s*[:=]\s*[^\s]+)/i;

const EVENT_DEFINITIONS: Record<ObservationEventType, EventDefinition> = {
  SESSION_STARTED: { domain: "SESSION", phase: "PRE_ACTION", payloadKeys: ["entry_point"] },
  SESSION_RESUMED: { domain: "SESSION", phase: "PRE_ACTION", payloadKeys: ["resume_reason"] },
  SESSION_ENDED: { domain: "SESSION", phase: "OUTCOME", payloadKeys: ["end_reason"] },
  APP_OPENED: { domain: "SESSION", phase: "PRE_ACTION", payloadKeys: ["launch_reason"] },
  APP_BACKGROUND: { domain: "SESSION", phase: "OUTCOME", payloadKeys: ["background_reason"] },
  APP_FOREGROUND: { domain: "SESSION", phase: "PRE_ACTION", payloadKeys: ["foreground_reason"] },
  MONETIZATION_ACTION: {
    domain: "MONETIZATION",
    phase: "PRE_ACTION",
    payloadKeys: ["offer_type", "selected_method"],
  },
  MONETIZATION_OUTCOME: {
    domain: "MONETIZATION",
    phase: "OUTCOME",
    payloadKeys: ["status", "success", "amount_coins"],
  },
  TRAFFIC_SOURCE_OBSERVED: {
    domain: "TRAFFIC",
    phase: "PRE_ACTION",
    payloadKeys: ["source_kind", "source_value"],
  },
  NOTIFICATION_OUTCOME: {
    domain: "NOTIFICATION",
    phase: "OUTCOME",
    payloadKeys: ["status", "channel"],
  },
  CONTENT_PERFORMANCE: {
    domain: "CONTENT",
    phase: "OUTCOME",
    payloadKeys: ["metric", "value"],
  },
  ACCESS_OUTCOME: {
    domain: "ACCESS",
    phase: "OUTCOME",
    payloadKeys: ["status", "authorized"],
  },
  SYSTEM_FAILURE: {
    domain: "SYSTEM",
    phase: "OUTCOME",
    payloadKeys: ["failure_kind", "safe_code", "retryable"],
  },
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSensitiveValue(value: unknown): boolean {
  if (typeof value === "string") return !UUID_V4.test(value) && PII_OR_SECRET_VALUE.test(value);
  if (Array.isArray(value)) return value.some(hasSensitiveValue);
  if (isPlainRecord(value)) {
    return Object.entries(value).some(([key, child]) => PII_OR_SECRET_VALUE.test(key) || hasSensitiveValue(child));
  }
  return false;
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function validateUuid(value: unknown, field: string, errors: string[], required = true) {
  if (value == null && !required) return;
  if (typeof value !== "string" || !UUID_V4.test(value)) errors.push(`${field} must be a UUIDv4${required ? "." : " or null."}`);
}

function validateContext(context: unknown, errors: string[]) {
  if (!isPlainRecord(context)) {
    errors.push("context must be an object.");
    return;
  }
  const allowed = new Set(["source_surface", "route", "content_type", "references"]);
  for (const key of Object.keys(context)) if (!allowed.has(key)) errors.push(`context field ${key} is not allowed.`);
  for (const key of ["source_surface", "route", "content_type"] as const) {
    const value = context[key];
    if (value != null && (typeof value !== "string" || !SAFE_REFERENCE.test(value))) {
      errors.push(`context field ${key} is invalid.`);
    }
  }
  if (context.references != null) {
    if (!isPlainRecord(context.references)) {
      errors.push("context.references must be an object.");
    } else {
      const allowedReferences = new Set<ObservationReferenceKey>([
        "content_id",
        "order_id",
        "transaction_id",
        "entitlement_id",
        "rewarded_attempt_id",
        "chai_tip_id",
        "provider_transaction_id",
      ]);
      for (const [key, value] of Object.entries(context.references)) {
        if (!allowedReferences.has(key as ObservationReferenceKey)) errors.push(`reference ${key} is not allowed.`);
        if (typeof value !== "string" || !SAFE_REFERENCE.test(value)) errors.push(`reference ${key} is invalid.`);
      }
    }
  }
  if (hasSensitiveValue(context)) errors.push("context contains PII or secret material.");
}

function validatePayload(
  eventType: ObservationEventType,
  payload: unknown,
  errors: string[],
): payload is ObservationPayload {
  if (!isPlainRecord(payload)) {
    errors.push("payload must be an object.");
    return false;
  }
  const allowed = new Set(EVENT_DEFINITIONS[eventType].payloadKeys);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) errors.push(`payload field ${key} is not allowed for ${eventType}.`);
    const value = payload[key];
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      errors.push(`payload field ${key} must be a scalar.`);
    }
  }
  if (eventType === "MONETIZATION_OUTCOME" && !Object.hasOwn(payload, "amount_coins")) {
    errors.push("payload field amount_coins is required for MONETIZATION_OUTCOME.");
  }
  if (hasSensitiveValue(payload)) errors.push("payload contains PII or secret material.");
  if (JSON.stringify(payload).length > 2048) errors.push("payload exceeds the 2KB bound.");
  return errors.length === 0;
}

function canOmitSessionId(input: Record<string, unknown>) {
  return (
    input.session_id === null &&
    input.domain !== "SESSION" &&
    input.phase === "OUTCOME" &&
    typeof input.source === "string" &&
    input.source.startsWith("server:")
  );
}

export function validateObservation(input: unknown): ObservationValidationResult {
  const errors: string[] = [];
  if (!isPlainRecord(input)) return { ok: false, errors: ["observation must be an object."] };

  const allowed = new Set([
    "observation_id",
    "schema_version",
    "occurred_at",
    "actor_id",
    "session_id",
    "domain",
    "event_type",
    "phase",
    "source",
    "context",
    "correlation_id",
    "request_id",
    "causation_id",
    "payload",
  ]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) errors.push(`unsupported field ${key}.`);

  if (input.schema_version !== undefined && input.schema_version !== OBSERVATION_SCHEMA_VERSION) {
    errors.push("schema_version is unsupported.");
  }
  validateUuid(input.observation_id, "observation_id", errors);
  validateUuid(input.actor_id, "actor_id", errors, false);
  if (!canOmitSessionId(input)) validateUuid(input.session_id, "session_id", errors);
  validateUuid(input.correlation_id, "correlation_id", errors);
  validateUuid(input.request_id, "request_id", errors, false);
  validateUuid(input.causation_id, "causation_id", errors, false);
  if (!isCanonicalUtcTimestamp(input.occurred_at)) errors.push("occurred_at must be canonical ISO-8601 UTC.");
  if (typeof input.source !== "string" || !SOURCE.test(input.source)) errors.push("source is invalid.");
  if (!OBSERVATION_DOMAINS.includes(input.domain as ObservationDomain)) errors.push("domain is invalid.");
  if (!OBSERVATION_EVENT_TYPES.includes(input.event_type as ObservationEventType)) errors.push("event_type is invalid.");
  if (input.phase !== "PRE_ACTION" && input.phase !== "OUTCOME") errors.push("phase is invalid.");

  const definition = EVENT_DEFINITIONS[input.event_type as ObservationEventType];
  if (definition) {
    if (input.domain !== definition.domain) errors.push("domain does not match event_type.");
    if (input.phase !== definition.phase) errors.push("phase does not match event_type.");
    validatePayload(input.event_type as ObservationEventType, input.payload, errors);
  }
  validateContext(input.context, errors);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...(input as ObservationInput),
      schema_version: OBSERVATION_SCHEMA_VERSION,
      actor_id: input.actor_id == null ? null : (input.actor_id as string),
      session_id: input.session_id == null ? null : (input.session_id as string),
      request_id: input.request_id == null ? null : (input.request_id as string),
      causation_id: input.causation_id == null ? null : (input.causation_id as string),
    },
  };
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isPlainRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
}

export function serializeObservation(observation: ObservationEnvelope): string {
  return JSON.stringify(sortKeys(observation));
}

export function toCanonicalEvent(observation: ObservationEnvelope): CanonicalEvent {
  const { observation_id, occurred_at, actor_id, session_id, correlation_id, request_id, causation_id, context, payload } =
    observation;
  return {
    event_id: observation_id,
    timestamp: occurred_at,
    observable_features: {
      domain: observation.domain,
      event_type: observation.event_type,
      phase: observation.phase,
      ...Object.fromEntries(
        Object.entries(payload).filter(
          ([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean",
        ),
      ),
    },
    context: {
      schema_version: observation.schema_version,
      source: observation.source,
      actor_id,
      session_id,
      correlation_id,
      request_id,
      causation_id,
      ...context,
    },
  };
}

/** Producer helper: observation failure must never fail the product action. */
export function runObservationFailOpen(task: Promise<unknown>, onFailure?: (error: unknown) => void): void {
  void task.catch((error: unknown) => {
    onFailure?.(error);
  });
}
