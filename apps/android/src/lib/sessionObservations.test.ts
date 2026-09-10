import assert from "node:assert/strict";
import test from "node:test";

import {
  OBSERVATION_SCHEMA_VERSION,
  serializeObservation,
  toCanonicalEvent,
  validateObservation,
} from "../../../../shared/observation/foundation";
import { getEvidenceSessionId } from "./evidenceIdentity";
import { createSessionObservationController } from "./sessionObservations";
import type { ObservationEnvelope } from "../../../../shared/observation/foundation";

const SESSION_ID = "50000000-0000-4000-8000-000000000001";
const ACTOR_ID = "50000000-0000-4000-8000-000000000002";

function collect() {
  const observations: ObservationEnvelope[] = [];
  const controller = createSessionObservationController({
    actorId: ACTOR_ID,
    sessionId: SESSION_ID,
    onObservation: (observation) => observations.push(observation),
  });
  return { controller, observations };
}

test("one process session keeps one session and correlation ID", () => {
  const { controller, observations } = collect();
  controller.appOpened("2026-09-06T00:00:00.000Z");
  controller.appBackground("2026-09-06T00:01:00.000Z");
  controller.appForeground("2026-09-06T00:02:00.000Z");

  assert.deepEqual(observations.map(({ event_type }) => event_type), [
    "APP_OPENED",
    "SESSION_STARTED",
    "APP_BACKGROUND",
    "APP_FOREGROUND",
    "SESSION_RESUMED",
  ]);
  assert.equal(new Set(observations.map(({ session_id }) => session_id)).size, 1);
  assert.equal(new Set(observations.map(({ correlation_id }) => correlation_id)).size, 1);
  assert.deepEqual(observations.map(({ occurred_at }) => occurred_at), [
    "2026-09-06T00:00:00.000Z",
    "2026-09-06T00:00:00.000Z",
    "2026-09-06T00:01:00.000Z",
    "2026-09-06T00:02:00.000Z",
    "2026-09-06T00:02:00.000Z",
  ]);
});

test("background/foreground does not create a new session or duplicate foreground", () => {
  const { controller, observations } = collect();
  controller.appOpened("2026-09-06T00:00:00.000Z");
  controller.appForeground("2026-09-06T00:00:30.000Z");
  controller.appBackground("2026-09-06T00:01:00.000Z");
  controller.appBackground("2026-09-06T00:01:30.000Z");
  controller.appForeground("2026-09-06T00:02:00.000Z");
  controller.appForeground("2026-09-06T00:02:30.000Z");

  assert.deepEqual(observations.map(({ event_type }) => event_type), [
    "APP_OPENED",
    "SESSION_STARTED",
    "APP_BACKGROUND",
    "APP_FOREGROUND",
    "SESSION_RESUMED",
  ]);
});

test("app restart is explicit: a new controller gets a new session", () => {
  const first = collect();
  first.controller.appOpened("2026-09-06T00:00:00.000Z");
  const secondObservations: ObservationEnvelope[] = [];
  const secondController = createSessionObservationController({
    onObservation: (observation) => secondObservations.push(observation),
  });
  secondController.appOpened("2026-09-06T01:00:00.000Z");

  assert.equal(secondController.sessionId, getEvidenceSessionId());
  assert.equal(first.observations[0].event_type, "APP_OPENED");
  assert.equal(secondObservations[1].event_type, "SESSION_STARTED");
});

test("Android lifecycle uses the shared contract without widening it", () => {
  const { controller, observations } = collect();
  controller.appOpened("2026-09-06T00:00:00.000Z");
  const first = observations[0];
  assert.equal(first.schema_version, OBSERVATION_SCHEMA_VERSION);
  assert.equal(validateObservation(first).ok, true);
  assert.equal(serializeObservation(first), serializeObservation({ ...first }));
  assert.deepEqual(toCanonicalEvent(first), {
    event_id: first.observation_id,
    timestamp: first.occurred_at,
    observable_features: {
      domain: "SESSION",
      event_type: "APP_OPENED",
      phase: "PRE_ACTION",
      launch_reason: "process_start",
    },
    context: {
      schema_version: OBSERVATION_SCHEMA_VERSION,
      source: "android:app_lifecycle",
      actor_id: ACTOR_ID,
      session_id: SESSION_ID,
      correlation_id: SESSION_ID,
      request_id: null,
      causation_id: null,
      source_surface: "app",
    },
  });
});

test("anonymous sessions use a null actor and explicit end is available without inferring termination", () => {
  const { controller, observations } = collect();
  controller.setActorId(null);
  controller.appOpened("2026-09-06T00:00:00.000Z");
  controller.sessionEnded("2026-09-06T00:03:00.000Z");
  controller.appForeground("2026-09-06T00:04:00.000Z");

  assert.equal(observations[0].actor_id, null);
  assert.equal(observations.at(-1)?.event_type, "SESSION_ENDED");
  assert.equal(observations.length, 3);
});

test("invalid or sensitive observations are fail-open and do not throw", () => {
  const { controller, observations } = collect();
  controller.appOpened("not-a-timestamp");
  assert.equal(observations.length, 0);
});

test("Android lifecycle observations cannot omit the process session identity", () => {
  const { controller, observations } = collect();
  controller.appOpened("2026-09-06T00:00:00.000Z");
  const lifecycleObservation = { ...observations[0], session_id: null };
  assert.equal(validateObservation(lifecycleObservation).ok, false);
});

test("sink failures cannot break lifecycle or CanonicalEvent projection", () => {
  const projections: string[] = [];
  const controller = createSessionObservationController({
    sessionId: SESSION_ID,
    onObservation: (_observation, canonicalEvent) => {
      projections.push(canonicalEvent.event_id);
      throw new Error("sink unavailable");
    },
  });
  assert.doesNotThrow(() => controller.appOpened("2026-09-06T00:00:00.000Z"));
  assert.equal(projections.length, 2);
});
