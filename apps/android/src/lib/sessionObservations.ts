import {
  createEvidenceUuid,
  getEvidenceSessionId,
} from "./evidenceIdentity";
import {
  OBSERVATION_SCHEMA_VERSION,
  serializeObservation,
  toCanonicalEvent,
  validateObservation,
  type CanonicalEvent,
  type ObservationEnvelope,
  type ObservationEventType,
} from "../../../../shared/observation/foundation";

export type SessionObservationSink = (
  observation: ObservationEnvelope,
  canonicalEvent: CanonicalEvent,
) => void | Promise<void>;

export type SessionObservationController = {
  appBackground: (occurredAt?: string) => void;
  appForeground: (occurredAt?: string) => void;
  appOpened: (occurredAt?: string) => void;
  sessionEnded: (occurredAt?: string) => void;
  setActorId: (actorId: string | null) => void;
  sessionId: string;
};

type SessionObservationOptions = {
  actorId?: string | null;
  now?: () => string;
  onObservation?: SessionObservationSink;
  sessionId?: string;
};

const EVENT_PAYLOADS: Record<ObservationEventType, Record<string, string | boolean>> = {
  SESSION_STARTED: { entry_point: "app" },
  SESSION_RESUMED: { resume_reason: "foreground_after_background" },
  SESSION_ENDED: { end_reason: "explicit" },
  APP_OPENED: { launch_reason: "process_start" },
  APP_BACKGROUND: { background_reason: "app_state" },
  APP_FOREGROUND: { foreground_reason: "app_state" },
  MONETIZATION_ACTION: {},
  MONETIZATION_OUTCOME: {},
  TRAFFIC_SOURCE_OBSERVED: {},
  NOTIFICATION_OUTCOME: {},
  CONTENT_PERFORMANCE: {},
  ACCESS_OUTCOME: {},
  SYSTEM_FAILURE: {},
};

function emitFailOpen(
  observation: ObservationEnvelope,
  onObservation: SessionObservationSink | undefined,
) {
  const result = validateObservation(observation);
  if (!result.ok) return;

  if (!onObservation) return;
  try {
    const resultPromise = onObservation(result.value, toCanonicalEvent(result.value));
    if (resultPromise instanceof Promise) {
      void resultPromise.catch(() => undefined);
    }
  } catch {
    // Observation is non-authoritative and must never affect app lifecycle.
  }
}

export function createSessionObservationController(
  options: SessionObservationOptions = {},
): SessionObservationController {
  const sessionId = options.sessionId ?? getEvidenceSessionId();
  const correlationId = sessionId;
  let actorId = options.actorId ?? null;
  let lifecycleStarted = false;
  let lifecycleEnded = false;
  let isBackgrounded = false;
  let lastOccurredAt: string | null = null;
  const now = options.now ?? (() => new Date().toISOString());

  function record(
    eventType: ObservationEventType,
    occurredAt = now(),
  ) {
    if (lifecycleEnded) return;
    if (lastOccurredAt && occurredAt < lastOccurredAt) return;
    lastOccurredAt = occurredAt;
    emitFailOpen(
      {
        observation_id: createEvidenceUuid(),
        schema_version: OBSERVATION_SCHEMA_VERSION,
        occurred_at: occurredAt,
        actor_id: actorId,
        session_id: sessionId,
        domain: "SESSION",
        event_type: eventType,
        phase: eventType === "SESSION_ENDED" || eventType === "APP_BACKGROUND" ? "OUTCOME" : "PRE_ACTION",
        source: "android:app_lifecycle",
        context: { source_surface: "app" },
        correlation_id: correlationId,
        request_id: null,
        causation_id: null,
        payload: EVENT_PAYLOADS[eventType],
      },
      options.onObservation,
    );
  }

  return {
    sessionId,
    setActorId: (nextActorId) => {
      actorId = nextActorId;
    },
    appOpened: (occurredAt) => {
      if (lifecycleStarted) return;
      lifecycleStarted = true;
      record("APP_OPENED", occurredAt);
      record("SESSION_STARTED", occurredAt);
    },
    appBackground: (occurredAt) => {
      if (!lifecycleStarted || lifecycleEnded || isBackgrounded) return;
      isBackgrounded = true;
      record("APP_BACKGROUND", occurredAt);
    },
    appForeground: (occurredAt) => {
      if (!lifecycleStarted || lifecycleEnded || !isBackgrounded) return;
      isBackgrounded = false;
      record("APP_FOREGROUND", occurredAt);
      record("SESSION_RESUMED", occurredAt);
    },
    sessionEnded: (occurredAt) => {
      if (!lifecycleStarted || lifecycleEnded) return;
      record("SESSION_ENDED", occurredAt);
      lifecycleEnded = true;
    },
  };
}

export function serializeSessionObservation(observation: ObservationEnvelope) {
  return serializeObservation(observation);
}
