import {
  runObservationFailOpen,
  toCanonicalEvent,
  validateObservation,
  type CanonicalEvent,
  type ObservationEnvelope,
} from "../../../shared/observation/foundation";

export type PersistedCoinUnlockEvidence = {
  amountCoins: number;
  occurredAt: string;
  transactionId: string;
};

export type CoinUnlockObservationInput = {
  actorId: string;
  episodeId: string;
  evidence: PersistedCoinUnlockEvidence;
};

export type CoinUnlockObservationSink = (
  observation: ObservationEnvelope,
  canonicalEvent: CanonicalEvent,
) => void | Promise<void>;

export function createPersistedCoinUnlockObservation(
  input: CoinUnlockObservationInput,
) {
  return validateObservation({
    observation_id: input.evidence.transactionId,
    schema_version: "app_observation_v1",
    occurred_at: input.evidence.occurredAt,
    actor_id: input.actorId,
    session_id: null,
    domain: "MONETIZATION",
    event_type: "MONETIZATION_OUTCOME",
    phase: "OUTCOME",
    source: "server:route:episode_purchase",
    context: {
      references: {
        content_id: input.episodeId,
        transaction_id: input.evidence.transactionId,
      },
    },
    correlation_id: input.evidence.transactionId,
    request_id: null,
    causation_id: null,
    payload: {
      status: "purchase_success",
      success: true,
      amount_coins: input.evidence.amountCoins,
    },
  });
}

export function emitPersistedCoinUnlockObservation(
  input: CoinUnlockObservationInput,
  sink?: CoinUnlockObservationSink,
) {
  const result = createPersistedCoinUnlockObservation(input);
  if (!result.ok) return result;

  runObservationFailOpen(
    Promise.resolve().then(() => sink?.(result.value, toCanonicalEvent(result.value))),
  );
  return result;
}
