import { recordBehaviorEvent } from "./api";
import { createEvidenceUuid, getEvidenceSessionId } from "./evidenceIdentity";

export type BehaviorEvidence = {
  eventType: "content_served" | "content_impression" | "content_open" | "play_start" | "qualified_watch" | "play_complete" | "play_abandon";
  contentId: string;
  contentType: "MICRO_DRAMA" | "SHORT_FILM" | "SERIES_EPISODE";
  sourceSurface: "home" | "explore" | "search" | "continue_watching" | "detail" | "direct";
  rowId?: string | null;
  position?: number | null;
  searchQueryContext?: string | null;
  searchResultPosition?: number | null;
  rankingDecisionId?: string | null;
  recommendationReason?: "NEW_RELEASE" | "CONTINUE_WATCHING" | "SEARCH_RELEVANCE" | "GENRE_FILTER" | "FORMAT_FILTER" | "EDITORIAL" | null;
  attributionSource?: "LATER_SEARCH" | "LATER_RETURN" | "RELATED_NAVIGATION" | null;
  attributionPolicy?: string | null;
  metadata?: Record<string, unknown>;
};

export function getBehaviorSessionId() { return getEvidenceSessionId(); }

export function emitBehaviorEvidence(accessToken: string | null | undefined, evidence: BehaviorEvidence) {
  const eventId = createEvidenceUuid();
  runBehaviorEvidenceFailOpen(recordBehaviorEvent(accessToken, {
    ...evidence,
    eventId,
    occurredAt: new Date().toISOString(),
    sessionId: getEvidenceSessionId(),
  }));
  return eventId;
}

export function runBehaviorEvidenceFailOpen(task: Promise<unknown>) {
  void task.catch((error: unknown) => {
    if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("[behavior evidence] persistence failed", error instanceof Error ? error.message : String(error));
  });
}
