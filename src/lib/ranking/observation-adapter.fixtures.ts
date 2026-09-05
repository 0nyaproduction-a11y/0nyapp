import type { BehaviorEventInput } from "@/lib/ranking/behavior-events";
import type { RankingDecisionEvidence } from "@/lib/ranking/decision-evidence";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";

function decision(id: string, candidateId: string, at: string, surface: "home" | "explore" | "search", contentId: string): RankingDecisionEvidence {
  const reason = surface === "home" ? "EDITORIAL" : surface === "search" ? "SEARCH_RELEVANCE" : null;
  const policy = surface === "home" ? "editorial" : surface === "search" ? "search_relevance" : "default_catalog";
  return {
    decisionSchemaVersion: "ranking_decision_v1", rankingDecisionId: id, createdAt: at, sessionId: SESSION_ID,
    rankingPolicy: policy, rankingPolicyVersion: `${surface}_fixture_policy_v1`, configVersion: `${surface}_fixture_config_v1`, configHash: null,
    rankingEngineVersion: "fixture_engine_v1", candidateSetId: candidateId, candidateSetVersion: "ranking_candidate_set_v1", candidateCount: 1,
    eligibilitySnapshotRef: candidateId, sourceSurface: surface, rowId: surface === "home" ? "editorial-row" : null, deterministic: true,
    experimentId: null, experimentVariant: null, propensityType: "none", selectionProbability: null, requestContext: surface === "search" ? { queryContext: "mystery" } : {},
    candidates: [{ contentId, contentType: "MICRO_DRAMA", eligible: true, filterReason: null, preRankPosition: 1, finalPosition: 1, recommendationReason: reason, editorialIntervention: surface === "home" ? "EDITORIAL_ORDER" : null, editorialChangeRef: null }],
    orderedResults: [{ contentId, contentType: "MICRO_DRAMA", position: 1, recommendationReason: reason, editorialIntervention: surface === "home" ? "EDITORIAL_ORDER" : null, editorialChangeRef: null, selectionProbability: null }],
  };
}

function event(eventId: string, eventType: BehaviorEventInput["eventType"], occurredAt: string, contentId: string, rankingDecisionId: string | null, sourceSurface: BehaviorEventInput["sourceSurface"], metadata: Record<string, unknown> = {}): BehaviorEventInput {
  return { eventId, eventType, occurredAt, sessionId: SESSION_ID, contentId, contentType: "MICRO_DRAMA", sourceSurface, position: 1, rankingDecisionId, metadata };
}

export const RANKING_OBSERVATION_REPLAY_FIXTURES = {
  homeEditorialComplete: {
    decision: decision("10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002", "2026-09-05T10:00:00.000Z", "home", "home-title"),
    events: [
      event("10000000-0000-4000-8000-000000000003", "content_served", "2026-09-05T10:00:01.000Z", "home-title", "10000000-0000-4000-8000-000000000001", "home"),
      event("10000000-0000-4000-8000-000000000004", "content_impression", "2026-09-05T10:00:03.000Z", "home-title", "10000000-0000-4000-8000-000000000001", "home", { visibility_fraction: 0.75, visible_duration_ms: 1200 }),
      event("10000000-0000-4000-8000-000000000005", "content_open", "2026-09-05T10:00:05.000Z", "home-title", "10000000-0000-4000-8000-000000000001", "home"),
      event("10000000-0000-4000-8000-000000000006", "play_start", "2026-09-05T10:00:10.000Z", "home-title", "10000000-0000-4000-8000-000000000001", "home"),
      event("10000000-0000-4000-8000-000000000007", "qualified_watch", "2026-09-05T10:00:40.000Z", "home-title", "10000000-0000-4000-8000-000000000001", "home", { definition: "continuous_playback_30s_v1", watched_seconds: 30 }),
      event("10000000-0000-4000-8000-000000000008", "play_complete", "2026-09-05T10:10:00.000Z", "home-title", "10000000-0000-4000-8000-000000000001", "home", { completion_source: "watch_progress_final_save" }),
    ],
  },
  exploreAbandon: {
    decision: decision("20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002", "2026-09-05T11:00:00.000Z", "explore", "explore-title"),
    events: [
      event("20000000-0000-4000-8000-000000000003", "content_served", "2026-09-05T11:00:01.000Z", "explore-title", "20000000-0000-4000-8000-000000000001", "explore"),
      event("20000000-0000-4000-8000-000000000004", "content_impression", "2026-09-05T11:00:03.000Z", "explore-title", "20000000-0000-4000-8000-000000000001", "explore", { visibility_fraction: 0.5, visible_duration_ms: 1000 }),
      event("20000000-0000-4000-8000-000000000005", "content_open", "2026-09-05T11:00:05.000Z", "explore-title", "20000000-0000-4000-8000-000000000001", "explore"),
      event("20000000-0000-4000-8000-000000000006", "play_abandon", "2026-09-05T11:01:00.000Z", "explore-title", "20000000-0000-4000-8000-000000000001", "explore", { reason: "explicit_exit" }),
    ],
  },
  searchPlay: {
    decision: decision("30000000-0000-4000-8000-000000000001", "30000000-0000-4000-8000-000000000002", "2026-09-05T12:00:00.000Z", "search", "search-title"),
    events: [
      { ...event("30000000-0000-4000-8000-000000000003", "content_served", "2026-09-05T12:00:01.000Z", "search-title", "30000000-0000-4000-8000-000000000001", "search"), searchQueryContext: "mystery", searchResultPosition: 1 },
      { ...event("30000000-0000-4000-8000-000000000004", "content_impression", "2026-09-05T12:00:03.000Z", "search-title", "30000000-0000-4000-8000-000000000001", "search", { visibility_fraction: 0.8, visible_duration_ms: 1400 }), searchQueryContext: "mystery", searchResultPosition: 1 },
      { ...event("30000000-0000-4000-8000-000000000005", "content_open", "2026-09-05T12:00:05.000Z", "search-title", "30000000-0000-4000-8000-000000000001", "search"), searchQueryContext: "mystery", searchResultPosition: 1 },
      { ...event("30000000-0000-4000-8000-000000000006", "play_start", "2026-09-05T12:00:10.000Z", "search-title", "30000000-0000-4000-8000-000000000001", "search"), searchQueryContext: "mystery", searchResultPosition: 1 },
    ],
  },
  directPlayback: {
    events: [event("40000000-0000-4000-8000-000000000001", "play_start", "2026-09-05T13:00:00.000Z", "direct-title", null, "direct")],
  },
} as const;
