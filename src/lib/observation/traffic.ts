import {
  toCanonicalEvent,
  validateObservation,
  type CanonicalEvent,
  type ObservationEnvelope,
} from "../../../shared/observation/foundation";

export type TrafficSourceKind =
  | "deep_link"
  | "referral"
  | "campaign"
  | "notification"
  | "social"
  | "organic"
  | "direct"
  | "unknown";

export type TrafficSourceAuthority = "server" | "verified_link" | "verified_notification" | "client";

export type TrafficSourceEvidence = {
  kind: TrafficSourceKind;
  authority: TrafficSourceAuthority;
  value?: string | null;
  campaignId?: string | null;
  referralId?: string | null;
  deepLinkId?: string | null;
  occurredAt: string;
};

export type TrafficObservationOptions = {
  observationId: string;
  sessionId: string;
  correlationId: string;
  actorId?: string | null;
  source: string;
};

const AUTHORITY_RANK: Record<TrafficSourceAuthority, number> = {
  server: 4,
  verified_link: 3,
  verified_notification: 3,
  client: 1,
};

const SAFE_VALUE = /^[A-Za-z0-9._:/-]{1,160}$/;
const URL_OR_QUERY = /(?:https?:\/\/|www\.|[?&#=]|%[0-9a-f]{2})/i;

function cleanReference(value: string | null | undefined, name: string, errors: string[]) {
  if (value == null) return null;
  if (!SAFE_VALUE.test(value) || URL_OR_QUERY.test(value)) {
    errors.push(`${name} must be a bounded identifier, not a URL or query string.`);
    return null;
  }
  return value;
}

export function resolveTrafficSource(
  evidence: readonly TrafficSourceEvidence[],
): TrafficSourceEvidence {
  const known = evidence.filter((item) => item.kind !== "unknown" && item.kind !== "direct");
  if (known.length === 0) {
    return { kind: "unknown", authority: "client", occurredAt: evidence[0]?.occurredAt ?? new Date(0).toISOString() };
  }
  return [...known].sort((left, right) =>
    AUTHORITY_RANK[right.authority] - AUTHORITY_RANK[left.authority] ||
    left.occurredAt.localeCompare(right.occurredAt) ||
    left.kind.localeCompare(right.kind),
  )[0];
}

export function adaptTrafficObservation(
  evidence: TrafficSourceEvidence,
  options: TrafficObservationOptions,
): { ok: true; value: ObservationEnvelope } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (evidence.kind === "unknown" || evidence.kind === "direct") {
    evidence = { ...evidence, kind: evidence.kind === "direct" ? "direct" : "unknown" };
  }
  cleanReference(evidence.campaignId, "campaignId", errors);
  cleanReference(evidence.referralId, "referralId", errors);
  cleanReference(evidence.deepLinkId, "deepLinkId", errors);
  if (evidence.value != null && (!SAFE_VALUE.test(evidence.value) || URL_OR_QUERY.test(evidence.value))) {
    errors.push("source value must be a bounded allowlisted value, not a URL or query string.");
  }
  const observation: ObservationEnvelope = {
    observation_id: options.observationId,
    schema_version: "app_observation_v1",
    occurred_at: evidence.occurredAt,
    actor_id: options.actorId ?? null,
    session_id: options.sessionId,
    domain: "TRAFFIC",
    event_type: "TRAFFIC_SOURCE_OBSERVED",
    phase: "PRE_ACTION",
    source: options.source,
    context: {
      source_surface: evidence.kind === "unknown" ? "unknown_direct" : evidence.kind,
    },
    correlation_id: options.correlationId,
    request_id: null,
    causation_id: null,
    payload: {
      source_kind: evidence.kind,
      source_value: evidence.value ?? null,
    },
  };
  if (errors.length) return { ok: false, errors };
  return validateObservation(observation);
}

export function toTrafficCanonicalEvent(observation: ObservationEnvelope): CanonicalEvent {
  return toCanonicalEvent(observation);
}
