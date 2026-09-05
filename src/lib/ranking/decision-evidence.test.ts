import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  createExploreRankingDecision,
  createSearchRankingDecision,
} from "../../../apps/android/src/lib/rankingDecisionEvidence";
import {
  filterDiscoverableItems,
  sortDiscoverableItems,
  type DiscoverableItem,
} from "../../../apps/android/src/lib/discovery";
import { searchDiscoverableItems } from "../../../apps/android/src/lib/search";
import {
  createRankingDecisionEvidence,
  validateRankingDecisionSubmission,
} from "./decision-evidence";
import { validateBehaviorEvent } from "./behavior-events";

const decisionId = "123e4567-e89b-42d3-a456-426614174010";
const eventBase = {
  eventId: "123e4567-e89b-42d3-a456-426614174011",
  occurredAt: "2026-09-05T00:00:00.000Z",
  sessionId: "123e4567-e89b-42d3-b456-426614174012",
  contentId: "series-1",
  contentType: "MICRO_DRAMA",
  sourceSurface: "home",
  rowId: "row-1",
  position: 1,
  rankingDecisionId: decisionId,
  recommendationReason: "EDITORIAL",
} as const;

const entries: DiscoverableItem[] = [
  {
    contentType: "MICRO_DRAMA",
    originalIndex: 0,
    item: {
      id: "series-1", slug: "alpha", title: "Alpha", contentType: "MICRO_DRAMA",
      genre: "Drama", format: "micro_drama", episodeCount: 1, episodeDuration: "2m",
      synopsis: "A drama", poster: "alpha.jpg", contentRating: null,
      contentDescriptors: [], parentalLockRequired: false, ageVerificationRequired: false,
      episodes: [],
    },
  },
  {
    contentType: "SHORT_FILM",
    originalIndex: 1,
    item: {
      id: "film-1", slug: "beta", title: "Beta", contentType: "SHORT_FILM",
      synopsis: "A comedy", genre: "Comedy", poster: "beta.jpg", heroImage: null,
      creatorReference: null, durationSeconds: 60, durationLabel: "1m", language: "English",
      contentRating: null, contentDescriptors: [], parentalLockRequired: false,
      ageVerificationRequired: false, status: "published", publishAt: null,
      midrollEnabled: false, midrollTimecodes: [], postrollEnabled: false,
      chaiEnabled: false, playbackReady: true, sharePath: "/short-films/beta",
    },
  },
];

function exploreDecision(format: "all" | "micro-dramas" | "short-films" = "all") {
  const displayedResults = sortDiscoverableItems(filterDiscoverableItems(entries, format, "All"), "default");
  return createExploreRankingDecision({
    candidates: entries,
    displayedResults,
    normalizedQuery: "",
    selectedFormat: format,
    selectedGenre: "All",
  });
}

test("1. ranking_decision_id is unique per meaningful decision", () => {
  assert.notEqual(exploreDecision().rankingDecisionId, exploreDecision().rankingDecisionId);
});

test("2. harmless rerender reuses the current evaluation decision", () => {
  for (const file of ["ExploreScreen.tsx", "SearchResultsScreen.tsx", "HomeScreen.tsx"]) {
    const source = readFileSync(`apps/android/src/screens/${file}`, "utf8");
    assert.match(source, /const (rankingDecision|continueWatchingDecision) = useMemo\(/);
  }
});

test("3. Search query change creates a new decision", () => {
  const alpha = createSearchRankingDecision({ candidates: entries, displayedResults: [entries[0]], matchedResults: [entries[0]], normalizedQuery: "alpha", selectedFormat: "all", selectedGenre: "All" });
  const beta = createSearchRankingDecision({ candidates: entries, displayedResults: [entries[1]], matchedResults: [entries[1]], normalizedQuery: "beta", selectedFormat: "all", selectedGenre: "All" });
  assert.notEqual(alpha.rankingDecisionId, beta.rankingDecisionId);
  assert.notEqual(alpha.requestContext.queryContext, beta.requestContext.queryContext);
});

test("4. Explore filter change creates a new decision", () => {
  const all = exploreDecision("all");
  const films = exploreDecision("short-films");
  assert.notEqual(all.rankingDecisionId, films.rankingDecisionId);
  assert.notEqual(all.requestContext.format, films.requestContext.format);
});

test("5. Home row decision preserves canonical row identity", () => {
  const decision = createRankingDecisionEvidence({ sessionId: null, rankingPolicy: "editorial", rankingPolicyVersion: "home_editorial_v1", configVersion: "home_editorial_config_v1:abc", configHash: "a".repeat(64), rankingEngineVersion: "home_server_v1", sourceSurface: "home", rowId: "cms-row-1", requestContext: { rowRole: "editorial" }, candidates: [], orderedResults: [] });
  assert.equal(decision.rowId, "cms-row-1");
});

test("6. policy and version are explicit per client surface", () => {
  const explore = exploreDecision();
  const search = createSearchRankingDecision({ candidates: entries, displayedResults: [entries[0]], matchedResults: [entries[0]], normalizedQuery: "alpha", selectedFormat: "all", selectedGenre: "All" });
  assert.deepEqual([explore.rankingPolicy, explore.rankingPolicyVersion], ["default_catalog", "explore_filter_order_v1"]);
  assert.deepEqual([search.rankingPolicy, search.rankingPolicyVersion], ["search_relevance", "search_match_priority_v1"]);
});

test("7. config identity is preserved where canonical", () => {
  const hash = "b".repeat(64);
  const decision = createRankingDecisionEvidence({ sessionId: null, rankingPolicy: "editorial", rankingPolicyVersion: "home_editorial_v1", configVersion: "home_editorial_config_v1:def", configHash: hash, rankingEngineVersion: "home_server_v1", sourceSurface: "home", rowId: "row", requestContext: {}, candidates: [], orderedResults: [] });
  assert.deepEqual([decision.configVersion, decision.configHash], ["home_editorial_config_v1:def", hash]);
});

test("8. candidate set references identify the immutable same-row snapshot", () => {
  const decision = exploreDecision();
  assert.equal(decision.eligibilitySnapshotRef, decision.candidateSetId);
  assert.equal(decision.candidateCount, decision.candidates.length);
});

test("9. decision-time eligibility is reconstructible", () => {
  const decision = exploreDecision("short-films");
  assert.deepEqual(decision.candidates.map((candidate) => [candidate.contentId, candidate.eligible, candidate.filterReason]), [["series-1", false, "FORMAT_FILTER"], ["film-1", true, null]]);
});

test("10. ordered results preserve one-based positions", () => {
  assert.deepEqual(exploreDecision().orderedResults.map((result) => result.position), [1, 2]);
});

test("11. deterministic decisions do not create fake propensity", () => {
  const decision = exploreDecision();
  assert.deepEqual([decision.deterministic, decision.propensityType, decision.selectionProbability], [true, "none", null]);
  assert.ok(decision.orderedResults.every((result) => result.selectionProbability === null));
});

test("12. recommendation reasons remain separate from Autonomous namespace", () => {
  const source = readFileSync("src/lib/ranking/decision-evidence.ts", "utf8");
  assert.match(source, /SEARCH_RELEVANCE/);
  assert.doesNotMatch(source, /autonomous_decision_reason/i);
});

test("13. editorial provenance survives into decision evidence", () => {
  const decision = createRankingDecisionEvidence({ sessionId: null, rankingPolicy: "editorial", rankingPolicyVersion: "home_editorial_v1", configVersion: "home_editorial_config_v1:x", configHash: "c".repeat(64), rankingEngineVersion: "home_server_v1", sourceSurface: "home", rowId: "row", requestContext: {}, candidates: [{ contentId: "series-1", contentType: "MICRO_DRAMA", eligible: true, filterReason: null, preRankPosition: 1, finalPosition: 1, recommendationReason: "EDITORIAL", editorialIntervention: "EDITORIAL_ORDER", editorialChangeRef: null }], orderedResults: [{ contentId: "series-1", contentType: "MICRO_DRAMA", position: 1, recommendationReason: "EDITORIAL", editorialIntervention: "EDITORIAL_ORDER", editorialChangeRef: null, selectionProbability: null }] });
  assert.equal(decision.orderedResults[0].editorialIntervention, "EDITORIAL_ORDER");
});

for (const [number, eventType] of [[14, "content_served"], [15, "content_impression"], [16, "content_open"], [17, "play_start"]] as const) {
  test(`${number}. ${eventType} inherits ranking_decision_id`, () => {
    const metadata = eventType === "content_impression" ? { visibility_fraction: 0.5, visible_duration_ms: 1000 } : {};
    const result = validateBehaviorEvent({ ...eventBase, eventType, metadata });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.rankingDecisionId, decisionId);
  });
}

test("18. direct and deep-link entry allows null ranking_decision_id", () => {
  const result = validateBehaviorEvent({ ...eventBase, eventType: "play_start", sourceSurface: "direct", rowId: null, position: null, rankingDecisionId: null, recommendationReason: null });
  assert.equal(result.ok, true);
});

test("19. delayed attribution is distinct from direct provenance", () => {
  const result = validateBehaviorEvent({ ...eventBase, eventType: "play_start", attributionSource: "LATER_RETURN", attributionPolicy: "delayed_attribution_v1" });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual([result.value.rankingDecisionId, result.value.attributionSource], [decisionId, "LATER_RETURN"]);
});

test("20. decision persistence transport is fire-and-forget and fail-open", () => {
  const source = readFileSync("apps/android/src/lib/rankingDecisionEvidence.ts", "utf8");
  assert.match(source, /void task\.catch/);
});

test("21. existing deterministic ranking and filtering order remains unchanged", () => {
  assert.deepEqual(sortDiscoverableItems(filterDiscoverableItems(entries, "all", "All"), "default").map((entry) => entry.item.id), ["series-1", "film-1"]);
  assert.deepEqual(searchDiscoverableItems(entries, "beta", "all", "All").map((entry) => entry.item.id), ["film-1"]);
});

test("22. client submissions reject experiments and randomization propensity", () => {
  const decision = exploreDecision();
  assert.equal(validateRankingDecisionSubmission(decision).ok, true);
  assert.equal(validateRankingDecisionSubmission({ ...decision, experimentId: "exp-1", experimentVariant: "A" }).ok, false);
  assert.equal(validateRankingDecisionSubmission({ ...decision, propensityType: "randomized", selectionProbability: 0.5 }).ok, false);
});

test("23. RANK-05B source and migration do not introduce Autonomous integration", () => {
  const files = ["src/lib/ranking/decision-evidence.ts", "apps/android/src/lib/rankingDecisionEvidence.ts", "supabase/migrations/20260905162706_ranking_decision_evidence.sql"];
  for (const file of files) assert.doesNotMatch(readFileSync(file, "utf8"), /Autonomous|autonomous_decision/i);
});

test("submission validation bounds metadata and sanitizes private query context", () => {
  const decision = createSearchRankingDecision({ candidates: entries, displayedResults: [entries[0]], matchedResults: [entries[0]], normalizedQuery: "akash@example.com alpha", selectedFormat: "all", selectedGenre: "All" });
  const result = validateRankingDecisionSubmission(decision);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.requestContext.queryContext, "[redacted] alpha");
  assert.equal(validateRankingDecisionSubmission({ ...decision, requestContext: { accessToken: "secret" } }).ok, false);
});

test("prepared persistence is append-oriented, server-only, and keeps snapshots atomic", () => {
  const sql = readFileSync("supabase/migrations/20260905162706_ranking_decision_evidence.sql", "utf8");
  assert.match(sql, /ranking_decision_id uuid primary key/);
  assert.match(sql, /candidate_snapshot jsonb not null/);
  assert.match(sql, /ordered_results jsonb not null/);
  assert.match(sql, /revoke all on public\.ranking_decisions from public, anon, authenticated/);
  assert.match(sql, /grant select, insert on public\.ranking_decisions to service_role/);
  assert.doesNotMatch(sql, /grant update|grant delete/i);
});
