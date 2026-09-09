import {
  toCanonicalEvent,
  validateObservation,
  type CanonicalEvent,
  type ObservationEnvelope,
} from "../../../shared/observation/foundation";

export type ContentEventType =
  | "CONTENT_PUBLISHED"
  | "CONTENT_UPDATED"
  | "CONTENT_UNPUBLISHED"
  | "CONTENT_AVAILABLE"
  | "CONTENT_UNAVAILABLE";

export type ContentAuthority = "cms" | "catalog" | "client";
export type ContentType = "series" | "series_episode" | "short_film";

export type ContentMetadata = {
  contentId: string;
  contentType: ContentType;
  creatorId?: string | null;
  language?: string | null;
  durationSeconds?: number | null;
  genreIds?: readonly string[] | null;
  publicationTimestamp?: string | null;
  availabilityState?: "available" | "unavailable" | "unknown" | null;
  publicationState?: "published" | "unpublished" | "draft" | "unknown" | null;
};

export type ContentEvidence = ContentMetadata & {
  eventType: ContentEventType;
  authority: ContentAuthority;
  occurredAt: string;
  correlationId: string;
  requestId?: string | null;
  causationId?: string | null;
};

export type ContentObservationOptions = {
  observationId: string;
  sessionId: string;
  actorId?: string | null;
  source?: string;
};

const SAFE_REFERENCE = /^[A-Za-z0-9._:/-]{1,200}$/;
const SAFE_LANGUAGE = /^[A-Za-z0-9_-]{1,32}$/;
const SAFE_GENRE = /^[A-Za-z0-9._:-]{1,80}$/;
const RANKING_FIELD = /(?:rank|score|popularity|quality|performance|reward)/i;
const AUTHORITY_RANK: Record<ContentAuthority, number> = { cms: 3, catalog: 2, client: 1 };
const isCanonicalUtcTimestamp = (value: string) =>
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function safeReference(value: string | null | undefined, field: string, errors: string[]) {
  if (value == null) return null;
  if (!SAFE_REFERENCE.test(value)) errors.push(`${field} must be a bounded content reference.`);
  return value;
}

function normalizeGenres(values: readonly string[] | null | undefined, errors: string[]) {
  if (values == null) return null;
  const unique = [...new Set(values)];
  if (unique.some((value) => !SAFE_GENRE.test(value) || RANKING_FIELD.test(value))) {
    errors.push("genreIds must contain only bounded canonical genre IDs.");
    return null;
  }
  return unique.sort().join(",");
}

function metadataPayload(evidence: ContentEvidence, errors: string[]): ObservationEnvelope["payload"] {
  const genreIds = normalizeGenres(evidence.genreIds, errors);
  if (evidence.language != null && !SAFE_LANGUAGE.test(evidence.language)) {
    errors.push("language must be a bounded language code.");
  }
  if (
    evidence.durationSeconds != null &&
    (!Number.isFinite(evidence.durationSeconds) || evidence.durationSeconds < 0)
  ) {
    errors.push("durationSeconds must be a non-negative finite number.");
  }
  if (
    evidence.publicationTimestamp != null &&
    (!SAFE_REFERENCE.test(evidence.publicationTimestamp) || !isCanonicalUtcTimestamp(evidence.publicationTimestamp))
  ) {
    errors.push("publicationTimestamp is invalid.");
  }
  return {
    content_type: evidence.contentType,
    language: evidence.language ?? null,
    duration_seconds: evidence.durationSeconds ?? null,
    availability_state: evidence.availabilityState ?? "unknown",
    publication_state: evidence.publicationState ?? "unknown",
    publication_timestamp: evidence.publicationTimestamp ?? null,
    genre_ids: genreIds,
  };
}

export function resolveAuthoritativeContentMetadata(
  evidence: readonly ContentEvidence[],
): ContentEvidence | null {
  if (evidence.length === 0) return null;
  const contentId = evidence[0].contentId;
  const matching = evidence.filter((item) => item.contentId === contentId);
  return [...matching].sort((left, right) =>
    AUTHORITY_RANK[right.authority] - AUTHORITY_RANK[left.authority] ||
    right.occurredAt.localeCompare(left.occurredAt),
  )[0] ?? null;
}

export function adaptContentObservation(
  evidence: ContentEvidence,
  options: ContentObservationOptions,
): { ok: true; value: ObservationEnvelope } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!SAFE_REFERENCE.test(evidence.contentId)) errors.push("contentId must be a stable bounded content identity.");
  if (evidence.authority === "client") errors.push("content metadata must come from CMS or catalog authority.");
  for (const key of Object.keys(evidence)) {
    if (RANKING_FIELD.test(key)) errors.push(`ranking field ${key} is not content metadata.`);
  }
  const references: NonNullable<ObservationEnvelope["context"]["references"]> = { content_id: evidence.contentId };
  const creatorId = safeReference(evidence.creatorId, "creatorId", errors);
  const genreIds = normalizeGenres(evidence.genreIds, errors);
  void creatorId;
  void genreIds;
  metadataPayload(evidence, errors);
  const observation: ObservationEnvelope = {
    observation_id: options.observationId,
    schema_version: "app_observation_v1",
    occurred_at: evidence.occurredAt,
    actor_id: options.actorId ?? null,
    session_id: options.sessionId,
    domain: "CONTENT",
    event_type: "CONTENT_PERFORMANCE",
    phase: "OUTCOME",
    source: options.source ?? `content:${evidence.authority}`,
    context: {
      source_surface: evidence.authority,
      content_type: evidence.contentType,
      references,
    },
    correlation_id: evidence.correlationId,
    request_id: evidence.requestId ?? null,
    causation_id: evidence.causationId ?? null,
    payload: { metric: evidence.eventType.toLowerCase(), value: 1 },
  };
  if (errors.length) return { ok: false, errors };
  return validateObservation(observation);
}

export function validateContentTemporalOrder(evidence: readonly ContentEvidence[]): boolean {
  return evidence.every((item, index) =>
    index === 0 ||
    item.contentId !== evidence[index - 1].contentId ||
    item.occurredAt >= evidence[index - 1].occurredAt,
  );
}

export function toContentCanonicalEvent(observation: ObservationEnvelope): CanonicalEvent {
  return toCanonicalEvent(observation);
}

export function runContentObservationFailOpen(
  task: Promise<unknown>,
  onFailure?: (error: unknown) => void,
) {
  void task.catch((error: unknown) => onFailure?.(error));
}
