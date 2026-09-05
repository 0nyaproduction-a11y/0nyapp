import {
  BEHAVIOR_EVENT_SCHEMA_VERSION,
  type BehaviorEventInput,
  validateBehaviorEvent,
} from "@/lib/ranking/behavior-events";
import {
  RANKING_CANDIDATE_SET_VERSION,
  RANKING_CONTENT_TYPES,
  RANKING_DECISION_SCHEMA_VERSION,
  RANKING_FILTER_REASONS,
  RANKING_POLICIES,
  RANKING_SURFACES,
  RECOMMENDATION_REASONS,
  type RankingDecisionEvidence,
} from "@/lib/ranking/decision-evidence";
import { sanitizeSearchQueryContext } from "@/lib/ranking/privacy";

export const RANKING_OBSERVATION_SCHEMA_VERSION = "ranking_observation_v1" as const;
export const RANKING_OBSERVATION_ADAPTER_VERSION = "ranking_observation_adapter_v1" as const;
export const AUTONOMOUS_CANONICAL_EVENT_CONTRACT_VERSION = "canonical_event_unversioned_2026-09-05" as const;
export const MAX_EXPORTED_CANDIDATES = 200;
export const MAX_EXPORTED_RESULTS = 200;

export const RANKING_OBSERVATION_TYPES = [
  "RANKING_DECISION",
  "CONTENT_SERVED",
  "CONTENT_IMPRESSION",
  "CONTENT_OPEN",
  "PLAY_START",
  "QUALIFIED_WATCH",
  "PLAY_COMPLETE",
  "PLAY_ABANDON",
] as const;

export type RankingObservationType = (typeof RANKING_OBSERVATION_TYPES)[number];
export type RankingEvidencePhase = "PRE_DECISION" | "DECISION_TIME" | "POST_DECISION";

type CandidateObservation = {
  content_id: string;
  content_type: string;
  eligible: boolean;
  filter_reason: string | null;
  pre_rank_position: number;
  final_position: number | null;
  recommendation_reason: string | null;
  editorial_intervention: string | null;
  editorial_change_ref: string | null;
};

type OrderedResultObservation = {
  content_id: string;
  content_type: string;
  position: number;
  recommendation_reason: string | null;
  editorial_intervention: string | null;
  editorial_change_ref: string | null;
};

export type RankingObservationEnvelope = {
  observation_id: string;
  observation_schema_version: typeof RANKING_OBSERVATION_SCHEMA_VERSION;
  adapter_version: typeof RANKING_OBSERVATION_ADAPTER_VERSION;
  source_event_schema_version: string;
  occurred_at: string;
  observation_type: RankingObservationType;
  evidence_phase: RankingEvidencePhase;
  ranking_decision_id: string | null;
  actor_id: string | null;
  session_id: string | null;
  content_id: string | null;
  content_type: string | null;
  source_surface: string;
  row_id: string | null;
  position: number | null;
  ranking_policy: string | null;
  ranking_policy_version: string | null;
  config_version: string | null;
  config_hash: string | null;
  ranking_engine_version: string | null;
  candidate_set_id: string | null;
  candidate_set_version: string | null;
  recommendation_reason: string | null;
  behavior_event_type: string | null;
  attribution_source: string | null;
  attribution_policy: string | null;
  payload: Record<string, unknown>;
};

export type AutonomousCanonicalEvent = {
  event_id: string;
  timestamp: string;
  observable_features: Record<string, unknown>;
  context: Record<string, unknown>;
};

type AdapterContext = { serverActorId?: string | null };
type AdapterResult = { ok: true; value: RankingObservationEnvelope } | { ok: false; errors: string[] };

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const BOUNDED_ID = /^[^\u0000-\u001f]{1,200}$/;
const POLICY_VERSION = /^[a-z0-9_:.@/-]{1,100}$/i;
const AUTONOMOUS_DECISION_REASONS = new Set(["GREEDY", "EXPLORE", "SURVIVAL", "SAFETY_RESTRICTED", "OWNER_OVERRIDE"]);
const REQUEST_CONTEXT_KEYS = new Set(["format", "genre", "queryContext", "sort", "ordering"]);

const BEHAVIOR_OBSERVATION_TYPES: Record<BehaviorEventInput["eventType"], RankingObservationType> = {
  content_served: "CONTENT_SERVED",
  content_impression: "CONTENT_IMPRESSION",
  content_open: "CONTENT_OPEN",
  play_start: "PLAY_START",
  qualified_watch: "QUALIFIED_WATCH",
  play_complete: "PLAY_COMPLETE",
  play_abandon: "PLAY_ABANDON",
};

function validTimestamp(value: string) {
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function validateActor(actorId: string | null | undefined, errors: string[]) {
  if (actorId != null && !UUID_V4.test(actorId)) errors.push("serverActorId must be a UUIDv4 or null.");
}

function validVersion(value: unknown) {
  return typeof value === "string" && POLICY_VERSION.test(value);
}

function normalizeMetadata(event: BehaviorEventInput, errors: string[]): Record<string, unknown> {
  const metadata = event.metadata ?? {};
  switch (event.eventType) {
    case "content_impression": {
      const visibility = metadata.visibility_fraction;
      const duration = metadata.visible_duration_ms;
      if (typeof visibility !== "number" || visibility < 0.5 || visibility > 1) errors.push("visibility_fraction must be between 0.5 and 1.");
      if (!Number.isFinite(duration) || (duration as number) < 1000 || (duration as number) > 86_400_000) errors.push("visible_duration_ms is outside the allowed range.");
      return { visibility_fraction: visibility, visible_duration_ms: duration };
    }
    case "qualified_watch": {
      const seconds = metadata.watched_seconds;
      if (metadata.definition !== "continuous_playback_30s_v1") errors.push("qualified_watch definition is invalid.");
      if (seconds != null && (!Number.isFinite(seconds) || (seconds as number) < 30 || (seconds as number) > 86_400)) errors.push("watched_seconds is outside the allowed range.");
      return { definition: "continuous_playback_30s_v1", ...(seconds == null ? {} : { watched_seconds: seconds }) };
    }
    case "play_complete":
      if (metadata.completion_source != null && metadata.completion_source !== "watch_progress_final_save") errors.push("completion_source is invalid.");
      return metadata.completion_source == null ? {} : { completion_source: metadata.completion_source };
    case "play_abandon":
      if (metadata.reason !== "explicit_exit") errors.push("play_abandon reason is invalid.");
      return { reason: "explicit_exit" };
    default:
      return {};
  }
}

function validateDecision(decision: RankingDecisionEvidence, context: AdapterContext): string[] {
  const errors: string[] = [];
  validateActor(context.serverActorId, errors);
  if (decision.decisionSchemaVersion !== RANKING_DECISION_SCHEMA_VERSION) errors.push("Unknown ranking decision schema version.");
  if (!UUID_V4.test(decision.rankingDecisionId)) errors.push("rankingDecisionId must be a UUIDv4.");
  if (!UUID_V4.test(decision.candidateSetId)) errors.push("candidateSetId must be a UUIDv4.");
  if (decision.sessionId != null && !UUID_V4.test(decision.sessionId)) errors.push("sessionId must be a UUIDv4 or null.");
  if (!validTimestamp(decision.createdAt)) errors.push("createdAt must be canonical ISO-8601 UTC.");
  if (!RANKING_POLICIES.includes(decision.rankingPolicy)) errors.push("Unknown ranking policy.");
  if (!RANKING_SURFACES.includes(decision.sourceSurface)) errors.push("Unknown ranking surface.");
  if (!validVersion(decision.rankingPolicyVersion) || !validVersion(decision.configVersion)) errors.push("Policy/config version is invalid.");
  if (decision.rankingEngineVersion != null && !validVersion(decision.rankingEngineVersion)) errors.push("rankingEngineVersion is invalid.");
  if (decision.configHash != null && !SHA256.test(decision.configHash)) errors.push("configHash must be a lowercase SHA-256 value.");
  if (decision.candidateSetVersion !== RANKING_CANDIDATE_SET_VERSION) errors.push("Unknown candidate set version.");
  if (decision.candidateCount !== decision.candidates.length || decision.candidateCount > MAX_EXPORTED_CANDIDATES) errors.push("Candidate evidence is inconsistent or exceeds its bound.");
  if (decision.orderedResults.length > MAX_EXPORTED_RESULTS || decision.orderedResults.length > decision.candidates.length) errors.push("Ordered results exceed their bound.");
  if (decision.eligibilitySnapshotRef !== decision.candidateSetId) errors.push("Candidate snapshot reference is inconsistent.");
  if (decision.deterministic !== true || decision.experimentId != null || decision.experimentVariant != null || decision.propensityType !== "none" || decision.selectionProbability != null) errors.push("Only current deterministic, non-experiment decisions are observable.");
  if (decision.rowId != null && !BOUNDED_ID.test(decision.rowId)) errors.push("rowId is invalid.");
  if (JSON.stringify(decision.requestContext).length > 1024) errors.push("requestContext exceeds its bound.");
  for (const [key, value] of Object.entries(decision.requestContext)) {
    if (!REQUEST_CONTEXT_KEYS.has(key)) errors.push(`requestContext field ${key} is not exportable.`);
    if (value != null && (typeof value !== "string" || value.length > 200)) errors.push(`requestContext field ${key} is invalid.`);
  }
  const candidateKeys = new Set<string>();
  for (const [index, candidate] of decision.candidates.entries()) {
    const key = `${candidate.contentType}:${candidate.contentId}`;
    if (!BOUNDED_ID.test(candidate.contentId) || !RANKING_CONTENT_TYPES.includes(candidate.contentType)) errors.push(`Candidate ${index + 1} identity is invalid.`);
    if (candidateKeys.has(key)) errors.push(`Candidate ${index + 1} is duplicated.`);
    candidateKeys.add(key);
    if (candidate.preRankPosition !== index + 1) errors.push("Candidate pre-rank positions must be contiguous and one-based.");
    if (candidate.eligible === (candidate.filterReason != null)) errors.push(`Candidate ${index + 1} eligibility/filter evidence is inconsistent.`);
    if (candidate.filterReason != null && !RANKING_FILTER_REASONS.includes(candidate.filterReason)) errors.push(`Candidate ${index + 1} filter reason is invalid.`);
    if (candidate.recommendationReason != null && !RECOMMENDATION_REASONS.includes(candidate.recommendationReason)) errors.push(`Candidate ${index + 1} recommendation reason is invalid.`);
    if (candidate.recommendationReason != null && AUTONOMOUS_DECISION_REASONS.has(candidate.recommendationReason)) errors.push("Autonomous decision reasons are forbidden.");
  }
  for (const [index, result] of decision.orderedResults.entries()) {
    if (result.position !== index + 1) errors.push("Ordered result positions must be contiguous and one-based.");
    if (!candidateKeys.has(`${result.contentType}:${result.contentId}`)) errors.push(`Ordered result ${index + 1} has no candidate evidence.`);
    const candidate = decision.candidates.find((item) => item.contentId === result.contentId && item.contentType === result.contentType);
    if (!candidate?.eligible || candidate.finalPosition !== result.position) errors.push(`Ordered result ${index + 1} is inconsistent with candidate evidence.`);
  }
  return errors;
}

export function adaptRankingDecisionObservation(decision: RankingDecisionEvidence, context: AdapterContext = {}): AdapterResult {
  const errors = validateDecision(decision, context);
  if (errors.length) return { ok: false, errors };
  const candidates: CandidateObservation[] = decision.candidates.map((candidate) => ({
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
  const orderedResults: OrderedResultObservation[] = decision.orderedResults.map((result) => ({
    content_id: result.contentId,
    content_type: result.contentType,
    position: result.position,
    recommendation_reason: result.recommendationReason,
    editorial_intervention: result.editorialIntervention,
    editorial_change_ref: result.editorialChangeRef,
  }));
  const requestContext = Object.fromEntries(Object.entries(decision.requestContext).map(([key, value]) => [
    key,
    key === "queryContext" && typeof value === "string" ? sanitizeSearchQueryContext(value) : value,
  ]));
  return { ok: true, value: {
    observation_id: decision.rankingDecisionId,
    observation_schema_version: RANKING_OBSERVATION_SCHEMA_VERSION,
    adapter_version: RANKING_OBSERVATION_ADAPTER_VERSION,
    source_event_schema_version: decision.decisionSchemaVersion,
    occurred_at: decision.createdAt,
    observation_type: "RANKING_DECISION",
    evidence_phase: "DECISION_TIME",
    ranking_decision_id: decision.rankingDecisionId,
    actor_id: context.serverActorId ?? null,
    session_id: decision.sessionId,
    content_id: null,
    content_type: null,
    source_surface: decision.sourceSurface,
    row_id: decision.rowId,
    position: null,
    ranking_policy: decision.rankingPolicy,
    ranking_policy_version: decision.rankingPolicyVersion,
    config_version: decision.configVersion,
    config_hash: decision.configHash,
    ranking_engine_version: decision.rankingEngineVersion,
    candidate_set_id: decision.candidateSetId,
    candidate_set_version: decision.candidateSetVersion,
    recommendation_reason: null,
    behavior_event_type: null,
    attribution_source: null,
    attribution_policy: null,
    payload: {
      pre_decision: {
        candidate_count: decision.candidateCount,
        candidate_export: "BOUNDED_NORMALIZED",
        candidates,
        request_context: requestContext,
      },
      decision_time: {
        deterministic: true,
        ordered_results: orderedResults,
      },
    },
  } };
}

export function adaptBehaviorObservation(value: unknown, context: AdapterContext = {}): AdapterResult {
  const parsed = validateBehaviorEvent(value);
  const errors = parsed.ok ? [] : [...parsed.errors];
  validateActor(context.serverActorId, errors);
  if (!parsed.ok) return { ok: false, errors };
  const event = parsed.value;
  if (!validTimestamp(event.occurredAt)) errors.push("occurredAt must be canonical ISO-8601 UTC.");
  const evidence = normalizeMetadata(event, errors);
  if (event.searchQueryContext?.includes("@") || /(?:\+?\d[\d\s().-]{7,}\d)/.test(event.searchQueryContext ?? "")) errors.push("Search query context was not safely redacted.");
  if (event.recommendationReason != null && AUTONOMOUS_DECISION_REASONS.has(event.recommendationReason)) errors.push("Autonomous decision reasons are forbidden.");
  if (errors.length) return { ok: false, errors };
  const position = event.position ?? event.searchResultPosition ?? null;
  return { ok: true, value: {
    observation_id: event.eventId,
    observation_schema_version: RANKING_OBSERVATION_SCHEMA_VERSION,
    adapter_version: RANKING_OBSERVATION_ADAPTER_VERSION,
    source_event_schema_version: BEHAVIOR_EVENT_SCHEMA_VERSION,
    occurred_at: event.occurredAt,
    observation_type: BEHAVIOR_OBSERVATION_TYPES[event.eventType],
    evidence_phase: "POST_DECISION",
    ranking_decision_id: event.rankingDecisionId ?? null,
    actor_id: context.serverActorId ?? null,
    session_id: event.sessionId ?? null,
    content_id: event.contentId,
    content_type: event.contentType,
    source_surface: event.sourceSurface,
    row_id: event.rowId ?? null,
    position,
    ranking_policy: null,
    ranking_policy_version: null,
    config_version: null,
    config_hash: null,
    ranking_engine_version: null,
    candidate_set_id: null,
    candidate_set_version: null,
    recommendation_reason: event.recommendationReason ?? null,
    behavior_event_type: event.eventType,
    attribution_source: event.attributionSource ?? null,
    attribution_policy: event.attributionPolicy ?? null,
    payload: { post_decision: {
      evidence,
      ...(event.searchQueryContext == null ? {} : { search_query_context: event.searchQueryContext }),
    } },
  } };
}

export function toAutonomousCanonicalEvent(observation: RankingObservationEnvelope): AutonomousCanonicalEvent {
  const decisionObservation = observation.observation_type === "RANKING_DECISION";
  return {
    event_id: observation.observation_id,
    timestamp: observation.occurred_at,
    observable_features: decisionObservation ? {
      candidate_count: (observation.payload.pre_decision as Record<string, unknown>).candidate_count,
      deterministic: true,
      observation_type: observation.observation_type,
      ranking_policy: observation.ranking_policy,
      ranking_policy_version: observation.ranking_policy_version,
      source_surface: observation.source_surface,
    } : {
      observation_type: observation.observation_type,
      source_surface: observation.source_surface,
    },
    context: {
      adapter_version: observation.adapter_version,
      actor_id: observation.actor_id,
      attribution_policy: observation.attribution_policy,
      attribution_source: observation.attribution_source,
      behavior_event_type: observation.behavior_event_type,
      candidate_set_id: observation.candidate_set_id,
      candidate_set_version: observation.candidate_set_version,
      config_hash: observation.config_hash,
      config_version: observation.config_version,
      content_id: observation.content_id,
      content_type: observation.content_type,
      evidence_phase: observation.evidence_phase,
      observation_schema_version: observation.observation_schema_version,
      ranking_decision_id: observation.ranking_decision_id,
      ranking_engine_version: observation.ranking_engine_version,
      recommendation_reason: observation.recommendation_reason,
      row_id: observation.row_id,
      session_id: observation.session_id,
      source_event_schema_version: observation.source_event_schema_version,
      position: observation.position,
      ...(decisionObservation ? { decision_evidence: observation.payload } : { outcome: observation.payload }),
    },
  };
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sortValue(child)]));
  return value;
}

export function serializeRankingObservation(observation: RankingObservationEnvelope) {
  return JSON.stringify(sortValue(observation));
}

export function sortRankingObservationsForReplay(observations: RankingObservationEnvelope[]) {
  return [...observations].sort((left, right) => left.occurred_at.localeCompare(right.occurred_at) || left.observation_id.localeCompare(right.observation_id));
}
