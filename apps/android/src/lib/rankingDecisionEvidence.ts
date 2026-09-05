import type { ExploreFormat } from "../navigation/types";
import {
  ALL_GENRES_FILTER,
  matchesFormat,
  type DiscoverableItem,
} from "./discovery";
import { createEvidenceUuid, getEvidenceSessionId } from "./evidenceIdentity";
import { itemHasGenre } from "./taxonomy";

export type RankingRecommendationReason =
  | "NEW_RELEASE"
  | "CONTINUE_WATCHING"
  | "SEARCH_RELEVANCE"
  | "GENRE_FILTER"
  | "FORMAT_FILTER"
  | "EDITORIAL";

export type RankingDecisionEvidence = {
  decisionSchemaVersion: "ranking_decision_v1";
  rankingDecisionId: string;
  createdAt: string;
  sessionId: string;
  rankingPolicy: "default_catalog" | "search_relevance" | "continue_watching";
  rankingPolicyVersion: "explore_filter_order_v1" | "search_match_priority_v1" | "last_watched_at_desc_v1";
  configVersion: "explore_request_v1" | "search_request_v1" | "watch_progress_v1";
  configHash: null;
  rankingEngineVersion: "android_discovery_v1" | "android_continue_watching_v1";
  candidateSetId: string;
  candidateSetVersion: "ranking_candidate_set_v1";
  candidateCount: number;
  eligibilitySnapshotRef: string;
  sourceSurface: "home" | "explore" | "search";
  rowId: null;
  deterministic: true;
  experimentId: null;
  experimentVariant: null;
  propensityType: "none";
  selectionProbability: null;
  requestContext: Record<string, string>;
  candidates: Array<{
    contentId: string;
    contentType: "MICRO_DRAMA" | "SHORT_FILM" | "SERIES_EPISODE";
    eligible: boolean;
    filterReason: "FORMAT_FILTER" | "GENRE_FILTER" | null;
    preRankPosition: number;
    finalPosition: number | null;
    recommendationReason: RankingRecommendationReason | null;
    editorialIntervention: null;
    editorialChangeRef: null;
  }>;
  orderedResults: Array<{
    contentId: string;
    contentType: "MICRO_DRAMA" | "SHORT_FILM" | "SERIES_EPISODE";
    position: number;
    recommendationReason: RankingRecommendationReason | null;
    editorialIntervention: null;
    editorialChangeRef: null;
    selectionProbability: null;
  }>;
};

function contentId(entry: DiscoverableItem) {
  return entry.item.id ?? `${entry.contentType}:${entry.item.slug}`;
}

function contentKey(entry: DiscoverableItem) {
  return `${entry.contentType}:${contentId(entry)}`;
}

function reasonForRequest(
  selectedFormat: ExploreFormat,
  selectedGenre: string,
  hasQueryMatch: boolean,
): RankingRecommendationReason | null {
  if (hasQueryMatch) return "SEARCH_RELEVANCE";
  if (selectedGenre !== ALL_GENRES_FILTER) return "GENRE_FILTER";
  if (selectedFormat !== "all") return "FORMAT_FILTER";
  return null;
}

function createDiscoveryDecision(input: {
  candidates: DiscoverableItem[];
  configVersion: "explore_request_v1" | "search_request_v1";
  displayedResults: DiscoverableItem[];
  matchedResults: DiscoverableItem[];
  normalizedQuery: string;
  rankingPolicy: "default_catalog" | "search_relevance";
  rankingPolicyVersion: "explore_filter_order_v1" | "search_match_priority_v1";
  selectedFormat: ExploreFormat;
  selectedGenre: string;
  sourceSurface: "explore" | "search";
}) {
  const candidateSetId = createEvidenceUuid();
  const finalPositionByKey = new Map(
    input.displayedResults.map((entry, index) => [contentKey(entry), index + 1]),
  );
  const queryMatchKeys = new Set(input.matchedResults.map(contentKey));

  const candidates = input.candidates.map((entry) => {
    const formatEligible = matchesFormat(entry, input.selectedFormat);
    const genreEligible = input.selectedGenre === ALL_GENRES_FILTER || itemHasGenre(entry.item, input.selectedGenre);
    const eligible = formatEligible && genreEligible;
    const key = contentKey(entry);
    return {
      contentId: contentId(entry),
      contentType: entry.contentType,
      eligible,
      filterReason: !formatEligible ? "FORMAT_FILTER" as const : !genreEligible ? "GENRE_FILTER" as const : null,
      preRankPosition: entry.originalIndex + 1,
      finalPosition: finalPositionByKey.get(key) ?? null,
      recommendationReason: finalPositionByKey.has(key)
        ? reasonForRequest(input.selectedFormat, input.selectedGenre, queryMatchKeys.has(key) && input.normalizedQuery.length > 0)
        : null,
      editorialIntervention: null,
      editorialChangeRef: null,
    };
  });
  const candidatesByKey = new Map(candidates.map((candidate) => [`${candidate.contentType}:${candidate.contentId}`, candidate]));

  return {
    decisionSchemaVersion: "ranking_decision_v1",
    rankingDecisionId: createEvidenceUuid(),
    createdAt: new Date().toISOString(),
    sessionId: getEvidenceSessionId(),
    rankingPolicy: input.rankingPolicy,
    rankingPolicyVersion: input.rankingPolicyVersion,
    configVersion: input.configVersion,
    configHash: null,
    rankingEngineVersion: "android_discovery_v1",
    candidateSetId,
    candidateSetVersion: "ranking_candidate_set_v1",
    candidateCount: candidates.length,
    eligibilitySnapshotRef: candidateSetId,
    sourceSurface: input.sourceSurface,
    rowId: null,
    deterministic: true,
    experimentId: null,
    experimentVariant: null,
    propensityType: "none",
    selectionProbability: null,
    requestContext: {
      format: input.selectedFormat,
      genre: input.selectedGenre,
      queryContext: input.normalizedQuery,
      sort: "default",
    },
    candidates,
    orderedResults: input.displayedResults.map((entry, index) => {
      const candidate = candidatesByKey.get(contentKey(entry))!;
      return {
        contentId: candidate.contentId,
        contentType: candidate.contentType,
        position: index + 1,
        recommendationReason: candidate.recommendationReason,
        editorialIntervention: null,
        editorialChangeRef: null,
        selectionProbability: null,
      };
    }),
  } satisfies RankingDecisionEvidence;
}

export function createExploreRankingDecision(input: {
  candidates: DiscoverableItem[];
  displayedResults: DiscoverableItem[];
  normalizedQuery: string;
  selectedFormat: ExploreFormat;
  selectedGenre: string;
}) {
  return createDiscoveryDecision({
    ...input,
    configVersion: "explore_request_v1",
    matchedResults: input.displayedResults,
    rankingPolicy: "default_catalog",
    rankingPolicyVersion: "explore_filter_order_v1",
    sourceSurface: "explore",
  });
}

export function createSearchRankingDecision(input: {
  candidates: DiscoverableItem[];
  displayedResults: DiscoverableItem[];
  matchedResults: DiscoverableItem[];
  normalizedQuery: string;
  selectedFormat: ExploreFormat;
  selectedGenre: string;
}) {
  return createDiscoveryDecision({
    ...input,
    configVersion: "search_request_v1",
    rankingPolicy: "search_relevance",
    rankingPolicyVersion: "search_match_priority_v1",
    sourceSurface: "search",
  });
}

export function createContinueWatchingRankingDecision(
  results: Array<{ contentId: string; contentType: "SERIES_EPISODE" | "SHORT_FILM" }>,
) {
  const candidateSetId = createEvidenceUuid();
  const candidates = results.map((result, index) => ({
    ...result,
    eligible: true,
    filterReason: null,
    preRankPosition: index + 1,
    finalPosition: index + 1,
    recommendationReason: "CONTINUE_WATCHING" as const,
    editorialIntervention: null,
    editorialChangeRef: null,
  }));
  return {
    decisionSchemaVersion: "ranking_decision_v1",
    rankingDecisionId: createEvidenceUuid(),
    createdAt: new Date().toISOString(),
    sessionId: getEvidenceSessionId(),
    rankingPolicy: "continue_watching",
    rankingPolicyVersion: "last_watched_at_desc_v1",
    configVersion: "watch_progress_v1",
    configHash: null,
    rankingEngineVersion: "android_continue_watching_v1",
    candidateSetId,
    candidateSetVersion: "ranking_candidate_set_v1",
    candidateCount: candidates.length,
    eligibilitySnapshotRef: candidateSetId,
    sourceSurface: "home",
    rowId: null,
    deterministic: true,
    experimentId: null,
    experimentVariant: null,
    propensityType: "none",
    selectionProbability: null,
    requestContext: { ordering: "last_watched_at_desc" },
    candidates,
    orderedResults: candidates.map((candidate) => ({
      contentId: candidate.contentId,
      contentType: candidate.contentType,
      position: candidate.finalPosition,
      recommendationReason: candidate.recommendationReason,
      editorialIntervention: null,
      editorialChangeRef: null,
      selectionProbability: null,
    })),
  } satisfies RankingDecisionEvidence;
}

export function recommendationReasonForResult(
  decision: RankingDecisionEvidence,
  entry: DiscoverableItem,
) {
  return decision.orderedResults.find(
    (result) => result.contentType === entry.contentType && result.contentId === contentId(entry),
  )?.recommendationReason ?? null;
}

export function runRankingDecisionEvidenceFailOpen(task: Promise<unknown>) {
  void task.catch((error: unknown) => {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[ranking decision evidence] persistence failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  });
}
