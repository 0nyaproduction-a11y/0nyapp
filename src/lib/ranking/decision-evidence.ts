import { randomUUID } from "node:crypto";

import { sanitizeSearchQueryContext } from "@/lib/ranking/privacy";
import type { Json } from "@/types/database";

export const RANKING_DECISION_SCHEMA_VERSION = "ranking_decision_v1" as const;
export const RANKING_CANDIDATE_SET_VERSION = "ranking_candidate_set_v1" as const;

export const RANKING_POLICIES = [
  "editorial",
  "default_catalog",
  "search_relevance",
  "continue_watching",
] as const;

export const RANKING_SURFACES = ["home", "explore", "search"] as const;
export const RANKING_CONTENT_TYPES = ["MICRO_DRAMA", "SHORT_FILM", "SERIES_EPISODE"] as const;
export const RANKING_FILTER_REASONS = [
  "FORMAT_FILTER",
  "GENRE_FILTER",
] as const;
export const RECOMMENDATION_REASONS = [
  "NEW_RELEASE",
  "CONTINUE_WATCHING",
  "SEARCH_RELEVANCE",
  "GENRE_FILTER",
  "FORMAT_FILTER",
  "EDITORIAL",
] as const;
export const EDITORIAL_INTERVENTIONS = [
  "EDITORIAL_PIN",
  "EDITORIAL_REMOVE",
  "EDITORIAL_ORDER",
] as const;

export type RankingPolicy = (typeof RANKING_POLICIES)[number];
export type RankingSurface = (typeof RANKING_SURFACES)[number];
export type RankingContentType = (typeof RANKING_CONTENT_TYPES)[number];
export type RankingFilterReason = (typeof RANKING_FILTER_REASONS)[number];
export type RecommendationReason = (typeof RECOMMENDATION_REASONS)[number];
export type RankingEditorialIntervention = (typeof EDITORIAL_INTERVENTIONS)[number];

export type RankingCandidateEvidence = {
  contentId: string;
  contentType: RankingContentType;
  eligible: boolean;
  filterReason: RankingFilterReason | null;
  preRankPosition: number;
  finalPosition: number | null;
  recommendationReason: RecommendationReason | null;
  editorialIntervention: RankingEditorialIntervention | null;
  editorialChangeRef: string | null;
};

export type RankingResultEvidence = {
  contentId: string;
  contentType: RankingContentType;
  position: number;
  recommendationReason: RecommendationReason | null;
  editorialIntervention: RankingEditorialIntervention | null;
  editorialChangeRef: string | null;
  selectionProbability: null;
};

export type RankingDecisionEvidence = {
  decisionSchemaVersion: typeof RANKING_DECISION_SCHEMA_VERSION;
  rankingDecisionId: string;
  createdAt: string;
  sessionId: string | null;
  rankingPolicy: RankingPolicy;
  rankingPolicyVersion: string;
  configVersion: string;
  configHash: string | null;
  rankingEngineVersion: string | null;
  candidateSetId: string;
  candidateSetVersion: typeof RANKING_CANDIDATE_SET_VERSION;
  candidateCount: number;
  eligibilitySnapshotRef: string;
  sourceSurface: RankingSurface;
  rowId: string | null;
  deterministic: true;
  experimentId: null;
  experimentVariant: null;
  propensityType: "none";
  selectionProbability: null;
  requestContext: Record<string, unknown>;
  candidates: RankingCandidateEvidence[];
  orderedResults: RankingResultEvidence[];
};

type ValidationResult =
  | { ok: true; value: RankingDecisionEvidence }
  | { ok: false; errors: string[] };

type CreateDecisionInput = Omit<
  RankingDecisionEvidence,
  | "decisionSchemaVersion"
  | "rankingDecisionId"
  | "createdAt"
  | "candidateSetId"
  | "candidateSetVersion"
  | "candidateCount"
  | "eligibilitySnapshotRef"
  | "deterministic"
  | "experimentId"
  | "experimentVariant"
  | "propensityType"
  | "selectionProbability"
>;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY = /(authorization|cookie|otp|password|pin|secret|service.?role|access.?token|refresh.?token|purchase.?token|signed.?url|playback.?url|api.?key|phone)/i;
const MAX_CANDIDATES = 200;

const CLIENT_POLICY_CONTRACTS = [
  {
    configVersion: "explore_request_v1",
    contentTypes: ["MICRO_DRAMA", "SHORT_FILM"],
    rankingEngineVersion: "android_discovery_v1",
    rankingPolicy: "default_catalog",
    rankingPolicyVersion: "explore_filter_order_v1",
    sourceSurface: "explore",
  },
  {
    configVersion: "search_request_v1",
    contentTypes: ["MICRO_DRAMA", "SHORT_FILM"],
    rankingEngineVersion: "android_discovery_v1",
    rankingPolicy: "search_relevance",
    rankingPolicyVersion: "search_match_priority_v1",
    sourceSurface: "search",
  },
  {
    configVersion: "watch_progress_v1",
    contentTypes: ["SERIES_EPISODE", "SHORT_FILM"],
    rankingEngineVersion: "android_continue_watching_v1",
    rankingPolicy: "continue_watching",
    rankingPolicyVersion: "last_watched_at_desc_v1",
    sourceSurface: "home",
  },
] as const;

function hasSensitiveKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => SENSITIVE_KEY.test(key) || hasSensitiveKey(child),
  );
}

function hasExactKeys(value: Record<string, unknown>, allowed: readonly string[], errors: string[], label: string) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key) || SENSITIVE_KEY.test(key)) errors.push(`${label} contains unsupported field: ${key}.`);
  }
}

function isBoundedId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}

function sanitizeRequestContext(value: Record<string, unknown>) {
  const sanitized = { ...value };
  if (typeof sanitized.queryContext === "string") {
    sanitized.queryContext = sanitizeSearchQueryContext(sanitized.queryContext);
  }
  return sanitized;
}

export function createRankingDecisionEvidence(input: CreateDecisionInput): RankingDecisionEvidence {
  const candidateSetId = randomUUID();
  return {
    ...input,
    decisionSchemaVersion: RANKING_DECISION_SCHEMA_VERSION,
    rankingDecisionId: randomUUID(),
    createdAt: new Date().toISOString(),
    candidateSetId,
    candidateSetVersion: RANKING_CANDIDATE_SET_VERSION,
    candidateCount: input.candidates.length,
    eligibilitySnapshotRef: candidateSetId,
    deterministic: true,
    experimentId: null,
    experimentVariant: null,
    propensityType: "none",
    selectionProbability: null,
  };
}

export function validateRankingDecisionSubmission(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["Ranking decision must be an object."] };
  }
  const input = value as Record<string, unknown>;
  hasExactKeys(input, [
    "decisionSchemaVersion", "rankingDecisionId", "createdAt", "sessionId",
    "rankingPolicy", "rankingPolicyVersion", "configVersion", "configHash",
    "rankingEngineVersion", "candidateSetId", "candidateSetVersion", "candidateCount",
    "eligibilitySnapshotRef", "sourceSurface", "rowId", "deterministic",
    "experimentId", "experimentVariant", "propensityType", "selectionProbability",
    "requestContext", "candidates", "orderedResults",
  ], errors, "Ranking decision");

  if (input.decisionSchemaVersion !== RANKING_DECISION_SCHEMA_VERSION) errors.push("decisionSchemaVersion is invalid.");
  if (typeof input.rankingDecisionId !== "string" || !UUID_V4.test(input.rankingDecisionId)) errors.push("rankingDecisionId must be a UUIDv4.");
  if (typeof input.candidateSetId !== "string" || !UUID_V4.test(input.candidateSetId)) errors.push("candidateSetId must be a UUIDv4.");
  if (input.eligibilitySnapshotRef !== input.candidateSetId) errors.push("eligibilitySnapshotRef must identify the immutable candidate snapshot.");
  if (input.candidateSetVersion !== RANKING_CANDIDATE_SET_VERSION) errors.push("candidateSetVersion is invalid.");
  if (typeof input.createdAt !== "string" || !Number.isFinite(Date.parse(input.createdAt))) errors.push("createdAt must be ISO-8601.");
  if (input.sessionId != null && (typeof input.sessionId !== "string" || !UUID_V4.test(input.sessionId))) errors.push("sessionId must be a UUIDv4 when supplied.");
  if (input.rowId != null) errors.push("Client ranking decisions cannot set rowId.");
  if (input.deterministic !== true) errors.push("Current ranking decisions must be deterministic.");
  if (input.experimentId != null || input.experimentVariant != null) errors.push("Experiments are not active.");
  if (input.propensityType !== "none" || input.selectionProbability != null) errors.push("Deterministic ranking must not submit propensity values.");
  if (input.configHash != null) errors.push("Client policies do not have a canonical config hash.");

  const policyContract = CLIENT_POLICY_CONTRACTS.find(
    (contract) => contract.sourceSurface === input.sourceSurface && contract.rankingPolicy === input.rankingPolicy,
  );
  if (!policyContract) {
    errors.push("The policy/surface combination is not allowed for client evidence.");
  } else {
    if (input.rankingPolicyVersion !== policyContract.rankingPolicyVersion) errors.push("rankingPolicyVersion does not match the allowed policy.");
    if (input.configVersion !== policyContract.configVersion) errors.push("configVersion does not match the allowed policy.");
    if (input.rankingEngineVersion !== policyContract.rankingEngineVersion) errors.push("rankingEngineVersion does not match the allowed producer.");
  }

  const requestContext = input.requestContext;
  if (!requestContext || typeof requestContext !== "object" || Array.isArray(requestContext) || JSON.stringify(requestContext).length > 1024 || hasSensitiveKey(requestContext)) {
    errors.push("requestContext is invalid or sensitive.");
  } else {
    hasExactKeys(requestContext as Record<string, unknown>, ["format", "genre", "queryContext", "sort", "ordering"], errors, "requestContext");
    for (const child of Object.values(requestContext as Record<string, unknown>)) {
      if (child != null && (typeof child !== "string" || child.length > 200)) errors.push("requestContext values must be bounded strings.");
    }
  }

  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const orderedResults = Array.isArray(input.orderedResults) ? input.orderedResults : [];
  if (!Array.isArray(input.candidates)) errors.push("candidates must be an array.");
  if (!Array.isArray(input.orderedResults)) errors.push("orderedResults must be an array.");
  if (!Number.isInteger(input.candidateCount) || (input.candidateCount as number) < 0 || (input.candidateCount as number) > MAX_CANDIDATES || input.candidateCount !== candidates.length) {
    errors.push(`candidateCount must equal the bounded candidate snapshot length (0-${MAX_CANDIDATES}).`);
  }
  if (orderedResults.length > candidates.length) errors.push("orderedResults cannot exceed the candidate count.");

  const candidatesByKey = new Map<string, Record<string, unknown>>();
  const preRankPositions = new Set<number>();
  for (const [index, rawCandidate] of candidates.entries()) {
    if (!rawCandidate || typeof rawCandidate !== "object" || Array.isArray(rawCandidate)) {
      errors.push(`Candidate ${index + 1} must be an object.`);
      continue;
    }
    const candidate = rawCandidate as Record<string, unknown>;
    hasExactKeys(candidate, ["contentId", "contentType", "eligible", "filterReason", "preRankPosition", "finalPosition", "recommendationReason", "editorialIntervention", "editorialChangeRef"], errors, `Candidate ${index + 1}`);
    const key = `${candidate.contentType}:${candidate.contentId}`;
    if (!isBoundedId(candidate.contentId)) errors.push(`Candidate ${index + 1} contentId is invalid.`);
    if (!RANKING_CONTENT_TYPES.includes(candidate.contentType as RankingContentType)) errors.push(`Candidate ${index + 1} contentType is invalid.`);
    if (policyContract && !policyContract.contentTypes.includes(candidate.contentType as never)) errors.push(`Candidate ${index + 1} contentType is not allowed for this policy.`);
    if (candidatesByKey.has(key)) errors.push(`Candidate ${index + 1} duplicates content identity.`);
    candidatesByKey.set(key, candidate);
    if (typeof candidate.eligible !== "boolean") errors.push(`Candidate ${index + 1} eligible is invalid.`);
    if (candidate.filterReason != null && !RANKING_FILTER_REASONS.includes(candidate.filterReason as RankingFilterReason)) errors.push(`Candidate ${index + 1} filterReason is invalid.`);
    if (candidate.eligible === true && candidate.filterReason != null) errors.push(`Candidate ${index + 1} cannot be eligible and filtered.`);
    if (candidate.eligible === false && candidate.filterReason == null) errors.push(`Candidate ${index + 1} requires a filterReason when ineligible.`);
    if (!Number.isInteger(candidate.preRankPosition) || (candidate.preRankPosition as number) < 1 || (candidate.preRankPosition as number) > candidates.length) errors.push(`Candidate ${index + 1} preRankPosition is invalid.`);
    else if (preRankPositions.has(candidate.preRankPosition as number)) errors.push(`Candidate ${index + 1} duplicates preRankPosition.`);
    else preRankPositions.add(candidate.preRankPosition as number);
    if (candidate.finalPosition != null && (!Number.isInteger(candidate.finalPosition) || (candidate.finalPosition as number) < 1)) errors.push(`Candidate ${index + 1} finalPosition is invalid.`);
    if (candidate.recommendationReason != null && !RECOMMENDATION_REASONS.includes(candidate.recommendationReason as RecommendationReason)) errors.push(`Candidate ${index + 1} recommendationReason is invalid.`);
    if (candidate.editorialIntervention != null || candidate.editorialChangeRef != null) errors.push(`Candidate ${index + 1} cannot submit editorial provenance from a client policy.`);
  }

  const resultKeys = new Set<string>();
  for (const [index, rawResult] of orderedResults.entries()) {
    if (!rawResult || typeof rawResult !== "object" || Array.isArray(rawResult)) {
      errors.push(`Ordered result ${index + 1} must be an object.`);
      continue;
    }
    const result = rawResult as Record<string, unknown>;
    hasExactKeys(result, ["contentId", "contentType", "position", "recommendationReason", "editorialIntervention", "editorialChangeRef", "selectionProbability"], errors, `Ordered result ${index + 1}`);
    const key = `${result.contentType}:${result.contentId}`;
    const candidate = candidatesByKey.get(key);
    if (result.position !== index + 1) errors.push("Ordered result positions must be contiguous and one-based.");
    if (resultKeys.has(key)) errors.push(`Ordered result ${index + 1} duplicates content identity.`);
    resultKeys.add(key);
    if (!candidate || candidate.eligible !== true) errors.push(`Ordered result ${index + 1} must reference an eligible candidate.`);
    if (candidate && candidate.finalPosition !== result.position) errors.push(`Ordered result ${index + 1} does not match candidate finalPosition.`);
    if (result.recommendationReason != null && !RECOMMENDATION_REASONS.includes(result.recommendationReason as RecommendationReason)) errors.push(`Ordered result ${index + 1} recommendationReason is invalid.`);
    if (candidate && candidate.recommendationReason !== result.recommendationReason) errors.push(`Ordered result ${index + 1} does not match candidate recommendationReason.`);
    if (result.editorialIntervention != null || result.editorialChangeRef != null) errors.push(`Ordered result ${index + 1} cannot submit editorial provenance from a client policy.`);
    if (result.selectionProbability != null) errors.push(`Ordered result ${index + 1} must not include a propensity value.`);
  }
  for (const candidate of candidatesByKey.values()) {
    if (candidate.finalPosition != null && !resultKeys.has(`${candidate.contentType}:${candidate.contentId}`)) errors.push("Every finalPosition must have an ordered result.");
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...(input as unknown as RankingDecisionEvidence),
      configHash: null,
      requestContext: sanitizeRequestContext(requestContext as Record<string, unknown>),
      rowId: null,
      sessionId: (input.sessionId as string | null | undefined) ?? null,
    },
  };
}

function toCandidateSnapshot(candidates: RankingCandidateEvidence[]): Json {
  return candidates.map((candidate) => ({
    content_id: candidate.contentId,
    content_type: candidate.contentType,
    eligible: candidate.eligible,
    filter_reason: candidate.filterReason,
    pre_rank_position: candidate.preRankPosition,
    final_position: candidate.finalPosition,
    recommendation_reason: candidate.recommendationReason,
    editorial_intervention: candidate.editorialIntervention,
    editorial_change_ref: candidate.editorialChangeRef,
  }));
}

function toOrderedResults(results: RankingResultEvidence[]): Json {
  return results.map((result) => ({
    content_id: result.contentId,
    content_type: result.contentType,
    position: result.position,
    recommendation_reason: result.recommendationReason,
    editorial_intervention: result.editorialIntervention,
    editorial_change_ref: result.editorialChangeRef,
    selection_probability: null,
  }));
}

export async function persistRankingDecisionEvidence(
  decision: RankingDecisionEvidence,
  actorId: string | null,
) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { error } = await createAdminClient().from("ranking_decisions").insert({
    ranking_decision_id: decision.rankingDecisionId,
    decision_schema_version: decision.decisionSchemaVersion,
    created_at: decision.createdAt,
    actor_id: actorId,
    session_id: decision.sessionId,
    ranking_policy: decision.rankingPolicy,
    ranking_policy_version: decision.rankingPolicyVersion,
    config_version: decision.configVersion,
    config_hash: decision.configHash,
    ranking_engine_version: decision.rankingEngineVersion,
    candidate_set_id: decision.candidateSetId,
    candidate_set_version: decision.candidateSetVersion,
    candidate_count: decision.candidateCount,
    eligibility_snapshot_ref: decision.eligibilitySnapshotRef,
    source_surface: decision.sourceSurface,
    row_id: decision.rowId,
    deterministic: true,
    experiment_id: null,
    experiment_variant: null,
    propensity_type: "none",
    selection_probability: null,
    request_context: decision.requestContext as Json,
    candidate_snapshot: toCandidateSnapshot(decision.candidates),
    ordered_results: toOrderedResults(decision.orderedResults),
  });
  if (error?.code === "23505") return { recorded: true, deduplicated: true };
  if (error) return { recorded: false, deduplicated: false, errorCode: error.code ?? "unknown" };
  return { recorded: true, deduplicated: false };
}
