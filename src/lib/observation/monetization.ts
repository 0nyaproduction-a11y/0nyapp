import {
  serializeObservation,
  toCanonicalEvent,
  validateObservation,
  type CanonicalEvent,
  type ObservationEnvelope,
} from "../../../shared/observation/foundation";
import {
  validateMonetizationEvent,
  type ValidationResult,
} from "../monetization/validation";
import type {
  MonetizationEvent,
  MonetizationEventType,
} from "../monetization/events";

export type MonetizationObservationOptions = {
  sessionId: string;
  actorId?: string | null;
};

export type MonetizationObservationResult =
  | { ok: true; value: ObservationEnvelope }
  | { ok: false; errors: string[] };

const EVENT_MAP: Partial<Record<MonetizationEventType, ObservationEnvelope["event_type"]>> = {
  COIN_PURCHASE_STARTED: "MONETIZATION_ACTION",
  COIN_PURCHASE_COMPLETED: "MONETIZATION_OUTCOME",
  COIN_PURCHASE_FAILED: "MONETIZATION_OUTCOME",
  REWARDED_UNLOCK_STARTED: "MONETIZATION_ACTION",
  REWARDED_UNLOCK_GRANTED: "MONETIZATION_OUTCOME",
  REWARDED_UNLOCK_FAILED: "MONETIZATION_OUTCOME",
  CHAI_TIP_STARTED: "MONETIZATION_ACTION",
  CHAI_TIP_COMPLETED: "MONETIZATION_OUTCOME",
  CHAI_TIP_FAILED: "MONETIZATION_OUTCOME",
};

const PURCHASE_TYPES = new Set<MonetizationEventType>([
  "COIN_PURCHASE_STARTED",
  "COIN_PURCHASE_COMPLETED",
  "COIN_PURCHASE_FAILED",
]);

const ATTEMPT_TYPES = new Set<MonetizationEventType>([
  "COIN_PURCHASE_STARTED",
  "REWARDED_UNLOCK_STARTED",
  "CHAI_TIP_STARTED",
]);

function safeAmount(event: MonetizationEvent): number | undefined {
  const amount = event.outcome?.amount_coins ?? event.offer?.coin_price;
  if (amount === undefined || amount === null) return undefined;
  if (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000) return NaN;
  return amount;
}

function references(event: MonetizationEvent) {
  const result: ObservationEnvelope["context"]["references"] = {};
  if (event.provider_refs?.provider_transaction_id) {
    result.provider_transaction_id = event.provider_refs.provider_transaction_id;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function adaptMonetizationObservation(
  input: unknown,
  options: MonetizationObservationOptions,
): MonetizationObservationResult {
  const validated: ValidationResult<MonetizationEvent> = validateMonetizationEvent(input);
  if (!validated.ok) return validated;

  const event = validated.value;
  const eventType = EVENT_MAP[event.event_type];
  if (!eventType) return { ok: false, errors: [`${event.event_type} has no authoritative observation mapping.`] };
  if (
    ATTEMPT_TYPES.has(event.event_type) &&
    (!event.request_id || !event.dedupe_key)
  ) {
    return {
      ok: false,
      errors: ["attempt observation requires both request_id and dedupe_key for later authoritative correlation."],
    };
  }

  const amount = safeAmount(event);
  if (Number.isNaN(amount)) return { ok: false, errors: ["amount_coins must be a non-negative integer within bounds."] };
  if (PURCHASE_TYPES.has(event.event_type) && amount === undefined) {
    return { ok: false, errors: ["coin purchase observations require an authoritative amount_coins or coin_price."] };
  }

  const outcome = event.outcome;
  const payload: ObservationEnvelope["payload"] =
    eventType === "MONETIZATION_ACTION"
      ? {
          offer_type: event.offer?.offer_type ?? (event.event_type.startsWith("CHAI") ? "chai_tip" : "coin_purchase"),
          selected_method: event.offer?.selected_method ?? null,
        }
      : {
          status: outcome?.status ?? "unknown",
          success: outcome?.success ?? null,
          amount_coins: amount ?? null,
        };

  const observation: ObservationEnvelope = {
    observation_id: event.event_id,
    schema_version: "app_observation_v1",
    occurred_at: event.occurred_at,
    actor_id: options.actorId ?? event.user_id ?? null,
    session_id: options.sessionId,
    domain: "MONETIZATION",
    event_type: eventType,
    phase: eventType === "MONETIZATION_ACTION" ? "PRE_ACTION" : "OUTCOME",
    source: event.source,
    context: {
      references: references(event),
    },
    correlation_id: event.correlation_id,
    request_id: event.request_id ?? null,
    causation_id: null,
    payload,
  };
  return validateObservation(observation);
}

export function serializeMonetizationObservation(observation: ObservationEnvelope) {
  return serializeObservation(observation);
}

export function toMonetizationCanonicalEvent(observation: ObservationEnvelope): CanonicalEvent {
  return toCanonicalEvent(observation);
}

export function runMonetizationObservationFailOpen(
  task: Promise<unknown>,
  onFailure?: (error: unknown) => void,
) {
  void task.catch((error: unknown) => onFailure?.(error));
}
