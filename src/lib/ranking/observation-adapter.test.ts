import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptBehaviorObservation,
  adaptRankingDecisionObservation,
  RANKING_OBSERVATION_ADAPTER_VERSION,
  serializeRankingObservation,
  sortRankingObservationsForReplay,
  toAutonomousCanonicalEvent,
} from "@/lib/ranking/observation-adapter";
import { RANKING_OBSERVATION_REPLAY_FIXTURES } from "@/lib/ranking/observation-adapter.fixtures";

const actorId = "50000000-0000-4000-8000-000000000001";

function mustAdaptDecision() {
  const result = adaptRankingDecisionObservation(RANKING_OBSERVATION_REPLAY_FIXTURES.homeEditorialComplete.decision, { serverActorId: actorId });
  assert.equal(result.ok, true, result.ok ? undefined : result.errors.join(" "));
  return result.value;
}

function mustAdaptEvent(value: unknown) {
  const result = adaptBehaviorObservation(value, { serverActorId: actorId });
  assert.equal(result.ok, true, result.ok ? undefined : result.errors.join(" "));
  return result.value;
}

test("1, 6, 8, 9, 10: RankingDecision maps with linkage, versions, one-based bounded evidence", () => {
  const observation = mustAdaptDecision();
  assert.equal(observation.observation_type, "RANKING_DECISION");
  assert.equal(observation.ranking_decision_id, RANKING_OBSERVATION_REPLAY_FIXTURES.homeEditorialComplete.decision.rankingDecisionId);
  assert.equal(observation.ranking_policy, "editorial");
  assert.equal(observation.adapter_version, RANKING_OBSERVATION_ADAPTER_VERSION);
  const preDecision = observation.payload.pre_decision as Record<string, unknown>;
  const decisionTime = observation.payload.decision_time as Record<string, unknown>;
  assert.equal((decisionTime.ordered_results as Array<{ position: number }>)[0].position, 1);
  assert.equal((preDecision.candidates as unknown[]).length, 1);
  assert.equal(preDecision.candidate_export, "BOUNDED_NORMALIZED");
});

test("2-5: all behavior families map to the controlled observation vocabulary", () => {
  const events = RANKING_OBSERVATION_REPLAY_FIXTURES.homeEditorialComplete.events;
  assert.equal(mustAdaptEvent(events[0]).observation_type, "CONTENT_SERVED");
  assert.equal(mustAdaptEvent(events[1]).observation_type, "CONTENT_IMPRESSION");
  assert.equal(mustAdaptEvent(events[2]).observation_type, "CONTENT_OPEN");
  assert.equal(mustAdaptEvent(events[3]).observation_type, "PLAY_START");
  assert.equal(mustAdaptEvent(events[4]).observation_type, "QUALIFIED_WATCH");
  assert.equal(mustAdaptEvent(events[5]).observation_type, "PLAY_COMPLETE");
  assert.equal(mustAdaptEvent(RANKING_OBSERVATION_REPLAY_FIXTURES.exploreAbandon.events[3]).observation_type, "PLAY_ABANDON");
});

test("7: null ranking_decision_id remains null for direct entry", () => {
  const observation = mustAdaptEvent(RANKING_OBSERVATION_REPLAY_FIXTURES.directPlayback.events[0]);
  assert.equal(observation.ranking_decision_id, null);
  assert.equal(observation.source_surface, "direct");
});

test("11, 12: private App internals and sensitive arbitrary metadata are not exported", () => {
  const base = RANKING_OBSERVATION_REPLAY_FIXTURES.homeEditorialComplete.events[0];
  const result = adaptBehaviorObservation({ ...base, metadata: { signed_media_url: "https://private", table_name: "ranking_behavior_events" } });
  assert.equal(result.ok, false);
  const clean = mustAdaptEvent(base);
  assert.deepEqual((clean.payload.post_decision as Record<string, unknown>).evidence, {});
  assert.equal(serializeRankingObservation(clean).includes("table_name"), false);
});

test("13: Search query privacy is preserved and email/phone-like values are redacted", () => {
  const base = RANKING_OBSERVATION_REPLAY_FIXTURES.searchPlay.events[0];
  const observation = mustAdaptEvent({ ...base, searchQueryContext: "find person@example.com or +91 98765 43210" });
  assert.equal((observation.payload.post_decision as Record<string, unknown>).search_query_context, "find [redacted] or [redacted]");
  assert.equal(serializeRankingObservation(observation).includes("person@example.com"), false);
});

test("14, 15: original event time is retained and no processing timestamp replaces it", () => {
  const source = RANKING_OBSERVATION_REPLAY_FIXTURES.homeEditorialComplete.events[0];
  const observation = mustAdaptEvent(source);
  assert.equal(observation.occurred_at, source.occurredAt);
  assert.equal("adapted_at" in observation, false);
});

test("16, 17: decision-time and post-decision evidence remain structurally distinct", () => {
  const decision = mustAdaptDecision();
  const outcome = mustAdaptEvent(RANKING_OBSERVATION_REPLAY_FIXTURES.homeEditorialComplete.events[5]);
  assert.equal(decision.evidence_phase, "DECISION_TIME");
  assert.equal(outcome.evidence_phase, "POST_DECISION");
  assert.equal("outcome" in decision.payload, false);
  const decisionCanonical = toAutonomousCanonicalEvent(decision);
  const outcomeCanonical = toAutonomousCanonicalEvent(outcome);
  assert.equal("decision_evidence" in decisionCanonical.context, true);
  assert.equal("outcome" in decisionCanonical.context, false);
  assert.equal("outcome" in outcomeCanonical.context, true);
  assert.equal("decision_evidence" in outcomeCanonical.context, false);
});

test("Home replay proves decision through qualified watch and completion into CanonicalEvent", () => {
  const fixture = RANKING_OBSERVATION_REPLAY_FIXTURES.homeEditorialComplete;
  const observations = [mustAdaptFixtureDecision(fixture.decision), ...fixture.events.map(mustAdaptEvent)];
  assert.deepEqual(observations.map((item) => item.observation_type), [
    "RANKING_DECISION",
    "CONTENT_SERVED",
    "CONTENT_IMPRESSION",
    "CONTENT_OPEN",
    "PLAY_START",
    "QUALIFIED_WATCH",
    "PLAY_COMPLETE",
  ]);
  assert.deepEqual(sortRankingObservationsForReplay(observations), observations);
  for (const observation of observations) {
    assert.equal(observation.ranking_decision_id, fixture.decision.rankingDecisionId);
    const canonical = toAutonomousCanonicalEvent(observation);
    assert.deepEqual(Object.keys(canonical).sort(), ["context", "event_id", "observable_features", "timestamp"]);
    assert.equal(canonical.context.ranking_decision_id, fixture.decision.rankingDecisionId);
  }
});

test("18: serialization and replay ordering are deterministic", () => {
  const observation = mustAdaptDecision();
  assert.equal(serializeRankingObservation(observation), serializeRankingObservation({ ...observation }));
  const later = mustAdaptEvent(RANKING_OBSERVATION_REPLAY_FIXTURES.homeEditorialComplete.events[0]);
  assert.deepEqual(sortRankingObservationsForReplay([later, observation]).map((item) => item.observation_id), [observation.observation_id, later.observation_id]);
});

test("19: malformed observations fail closed", () => {
  const event = RANKING_OBSERVATION_REPLAY_FIXTURES.homeEditorialComplete.events[0];
  assert.equal(adaptBehaviorObservation({ ...event, eventId: "not-a-uuid" }).ok, false);
  assert.equal(adaptBehaviorObservation({ ...event, occurredAt: "yesterday" }).ok, false);
  const decision = structuredClone(RANKING_OBSERVATION_REPLAY_FIXTURES.homeEditorialComplete.decision);
  decision.orderedResults[0].position = 0;
  assert.equal(adaptRankingDecisionObservation(decision).ok, false);
});

test("20: no Autonomous decision reason is fabricated", () => {
  const serialized = serializeRankingObservation(mustAdaptDecision());
  for (const reason of ["GREEDY", "EXPLORE", "SURVIVAL", "SAFETY_RESTRICTED", "OWNER_OVERRIDE"]) assert.equal(serialized.includes(reason), false);
});

test("22-24: replay fixtures preserve chronology/provenance without action, Seed, or Constitution fields", () => {
  const fixtureSets = Object.values(RANKING_OBSERVATION_REPLAY_FIXTURES);
  for (const fixture of fixtureSets) {
    const observations = [
      ...("decision" in fixture ? [mustAdaptFixtureDecision(fixture.decision)] : []),
      ...fixture.events.map((event) => mustAdaptEvent(event)),
    ];
    const ordered = sortRankingObservationsForReplay(observations);
    assert.deepEqual(ordered, observations);
    const serialized = ordered.map(serializeRankingObservation).join("\n");
    assert.equal(/action_adapter|seed_action|constitution/i.test(serialized), false);
  }
});

function mustAdaptFixtureDecision(decision: Parameters<typeof adaptRankingDecisionObservation>[0]) {
  const result = adaptRankingDecisionObservation(decision, { serverActorId: actorId });
  assert.equal(result.ok, true, result.ok ? undefined : result.errors.join(" "));
  return result.value;
}

test("CanonicalEvent compatibility preserves contract shape and excludes identifiers from observable features", () => {
  const canonical = toAutonomousCanonicalEvent(mustAdaptDecision());
  assert.deepEqual(Object.keys(canonical).sort(), ["context", "event_id", "observable_features", "timestamp"]);
  assert.equal("actor_id" in canonical.observable_features, false);
  assert.equal("content_id" in canonical.observable_features, false);
  assert.equal("ranking_decision_id" in canonical.observable_features, false);
  assert.equal(canonical.context.evidence_phase, "DECISION_TIME");
});
