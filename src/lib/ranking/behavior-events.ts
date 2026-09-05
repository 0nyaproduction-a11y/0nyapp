import { sanitizeSearchQueryContext } from "@/lib/ranking/privacy";

export { sanitizeSearchQueryContext } from "@/lib/ranking/privacy";

export const BEHAVIOR_EVENT_SCHEMA_VERSION = "ranking_behavior_v1" as const;

export const BEHAVIOR_EVENT_TYPES = [
  "content_served",
  "content_impression",
  "content_open",
  "play_start",
  "qualified_watch",
  "play_complete",
  "play_abandon",
] as const;

export const BEHAVIOR_SOURCE_SURFACES = [
  "home",
  "explore",
  "search",
  "continue_watching",
  "detail",
  "direct",
] as const;

export const BEHAVIOR_CONTENT_TYPES = ["MICRO_DRAMA", "SHORT_FILM", "SERIES_EPISODE"] as const;
export const BEHAVIOR_RECOMMENDATION_REASONS = [
  "NEW_RELEASE",
  "CONTINUE_WATCHING",
  "SEARCH_RELEVANCE",
  "GENRE_FILTER",
  "FORMAT_FILTER",
  "EDITORIAL",
] as const;
export const BEHAVIOR_ATTRIBUTION_SOURCES = ["LATER_SEARCH", "LATER_RETURN", "RELATED_NAVIGATION"] as const;

export type BehaviorEventType = (typeof BEHAVIOR_EVENT_TYPES)[number];
export type BehaviorSourceSurface = (typeof BEHAVIOR_SOURCE_SURFACES)[number];
export type BehaviorContentType = (typeof BEHAVIOR_CONTENT_TYPES)[number];
export type BehaviorRecommendationReason = (typeof BEHAVIOR_RECOMMENDATION_REASONS)[number];
export type BehaviorAttributionSource = (typeof BEHAVIOR_ATTRIBUTION_SOURCES)[number];

export type BehaviorEventInput = {
  eventId: string;
  eventType: BehaviorEventType;
  occurredAt: string;
  sessionId?: string | null;
  contentId: string;
  contentType: BehaviorContentType;
  sourceSurface: BehaviorSourceSurface;
  rowId?: string | null;
  position?: number | null;
  searchQueryContext?: string | null;
  searchResultPosition?: number | null;
  rankingDecisionId?: string | null;
  recommendationReason?: BehaviorRecommendationReason | null;
  attributionSource?: BehaviorAttributionSource | null;
  attributionPolicy?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ValidationResult = { ok: true; value: BehaviorEventInput } | { ok: false; errors: string[] };
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY = /(authorization|cookie|otp|password|pin|secret|service.?role|access.?token|refresh.?token|purchase.?token|signed.?url|playback.?url|api.?key)/i;
function hasSensitiveKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => SENSITIVE_KEY.test(key) || hasSensitiveKey(child),
  );
}

const EVENT_METADATA_KEYS: Record<BehaviorEventType, readonly string[]> = {
  content_served: [],
  content_impression: ["visibility_fraction", "visible_duration_ms"],
  content_open: [],
  play_start: [],
  qualified_watch: ["definition", "watched_seconds"],
  play_complete: ["completion_source"],
  play_abandon: ["reason"],
};

function validateEventMetadata(eventType: BehaviorEventType, metadata: Record<string, unknown>, errors: string[]) {
  const allowed = new Set(EVENT_METADATA_KEYS[eventType]);
  for (const key of Object.keys(metadata)) {
    if (!allowed.has(key)) errors.push(`metadata field ${key} is not allowed for ${eventType}.`);
  }
}

export function qualifiesViewportImpression(visibilityFraction: number, visibleDurationMs: number) {
  return visibilityFraction >= 0.5 && visibleDurationMs >= 1000;
}

export function validateBehaviorEvent(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["Event must be an object."] };
  const input = value as Record<string, unknown>;
  const allowed = new Set(["eventId", "eventType", "occurredAt", "sessionId", "contentId", "contentType", "sourceSurface", "rowId", "position", "searchQueryContext", "searchResultPosition", "rankingDecisionId", "recommendationReason", "attributionSource", "attributionPolicy", "metadata"]);
  for (const key of Object.keys(input)) if (!allowed.has(key) || SENSITIVE_KEY.test(key)) errors.push(`Unsupported field: ${key}.`);
  if (typeof input.eventId !== "string" || !UUID_V4.test(input.eventId)) errors.push("eventId must be a UUIDv4.");
  if (!BEHAVIOR_EVENT_TYPES.includes(input.eventType as BehaviorEventType)) errors.push("eventType is invalid.");
  if (typeof input.occurredAt !== "string" || !Number.isFinite(Date.parse(input.occurredAt))) errors.push("occurredAt must be ISO-8601.");
  if (input.sessionId != null && (typeof input.sessionId !== "string" || !UUID_V4.test(input.sessionId))) errors.push("sessionId must be a UUIDv4 when supplied.");
  if (typeof input.contentId !== "string" || input.contentId.trim().length < 1 || input.contentId.length > 200) errors.push("contentId is invalid.");
  if (!BEHAVIOR_CONTENT_TYPES.includes(input.contentType as BehaviorContentType)) errors.push("contentType is invalid.");
  if (!BEHAVIOR_SOURCE_SURFACES.includes(input.sourceSurface as BehaviorSourceSurface)) errors.push("sourceSurface is invalid.");
  for (const key of ["position", "searchResultPosition"] as const) if (input[key] != null && (!Number.isInteger(input[key]) || (input[key] as number) < 1)) errors.push(`${key} must be one-based.`);
  if (input.rowId != null && (typeof input.rowId !== "string" || input.rowId.length > 200)) errors.push("rowId is invalid.");
  if (input.searchQueryContext != null && (typeof input.searchQueryContext !== "string" || input.searchQueryContext.length > 500)) errors.push("searchQueryContext is invalid.");
  if (input.sourceSurface === "search" && (!Number.isInteger(input.searchResultPosition) || (input.searchResultPosition as number) < 1)) errors.push("Search evidence requires searchResultPosition.");
  if (input.rankingDecisionId != null && (typeof input.rankingDecisionId !== "string" || !UUID_V4.test(input.rankingDecisionId))) errors.push("rankingDecisionId must be a UUIDv4 when supplied.");
  if (input.recommendationReason != null && !BEHAVIOR_RECOMMENDATION_REASONS.includes(input.recommendationReason as BehaviorRecommendationReason)) errors.push("recommendationReason is invalid.");
  if (input.attributionSource != null && !BEHAVIOR_ATTRIBUTION_SOURCES.includes(input.attributionSource as BehaviorAttributionSource)) errors.push("attributionSource is invalid.");
  if ((input.attributionSource == null) !== (input.attributionPolicy == null)) errors.push("Delayed attribution source and policy must be supplied together.");
  if (input.attributionPolicy != null && (typeof input.attributionPolicy !== "string" || !/^[a-z0-9_:-]{1,100}$/i.test(input.attributionPolicy))) errors.push("attributionPolicy is invalid.");
  if (input.attributionSource != null && input.rankingDecisionId == null) errors.push("Delayed attribution requires an explicit rankingDecisionId reference.");
  const metadata = input.metadata ?? {};
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || JSON.stringify(metadata).length > 2048 || hasSensitiveKey(metadata)) errors.push("metadata is invalid or sensitive.");
  else if (BEHAVIOR_EVENT_TYPES.includes(input.eventType as BehaviorEventType)) validateEventMetadata(input.eventType as BehaviorEventType, metadata as Record<string, unknown>, errors);
  if (input.eventType === "content_impression") {
    const m = metadata as Record<string, unknown>;
    if (typeof m.visibility_fraction !== "number" || typeof m.visible_duration_ms !== "number" || !qualifiesViewportImpression(m.visibility_fraction, m.visible_duration_ms)) errors.push("content_impression requires >=50% visibility for >=1000ms.");
  }
  if (input.eventType === "qualified_watch" && (metadata as Record<string, unknown>).definition !== "continuous_playback_30s_v1") errors.push("qualified_watch requires its provisional v1 definition.");
  if (input.eventType === "play_abandon" && (metadata as Record<string, unknown>).reason !== "explicit_exit") errors.push("play_abandon requires an explicit_exit reason.");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { ...(input as BehaviorEventInput), searchQueryContext: typeof input.searchQueryContext === "string" ? sanitizeSearchQueryContext(input.searchQueryContext) : null, metadata: metadata as Record<string, unknown> } };
}

export function accumulateQualifiedWatch(previousSeconds: number, deltaSeconds: number, playing: boolean) {
  if (!playing || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 2) return previousSeconds;
  return previousSeconds + deltaSeconds;
}

export function isQualifiedWatch(seconds: number) { return seconds >= 30; }

export function shouldEmitPlayAbandon(state: { started: boolean; completed: boolean; reason: string }) {
  return state.started && !state.completed && state.reason === "explicit_exit";
}
