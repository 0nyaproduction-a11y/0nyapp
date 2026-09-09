import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptContentObservation,
  resolveAuthoritativeContentMetadata,
  runContentObservationFailOpen,
  toContentCanonicalEvent,
  validateContentTemporalOrder,
} from "./content";

const base = {
  observationId: "50000000-0000-4000-8000-000000000201",
  sessionId: "50000000-0000-4000-8000-000000000202",
  correlationId: "50000000-0000-4000-8000-000000000203",
};

const evidence = (overrides: Record<string, unknown> = {}) => ({
  contentId: "series-1",
  contentType: "series" as const,
  authority: "cms" as const,
  eventType: "CONTENT_PUBLISHED" as const,
  occurredAt: "2026-09-06T00:00:00.000Z",
  correlationId: base.correlationId,
  ...overrides,
});

test("preserves stable content identity and authoritative metadata", () => {
  const result = adaptContentObservation(evidence({
    creatorId: "creator-1",
    language: "en",
    durationSeconds: 120,
    genreIds: ["drama", "romance"],
    publicationTimestamp: "2026-09-06T00:00:00.000Z",
    publicationState: "published",
    availabilityState: "available",
  }), base);
  assert.equal(result.ok, true);
  assert.equal(result.value.context.references?.content_id, "series-1");
  assert.equal(result.value.event_type, "CONTENT_PERFORMANCE");
  assert.equal(result.value.payload.metric, "content_published");
  assert.equal(result.value.payload.value, 1);
});

test("CMS authority wins over catalog and client metadata", () => {
  const resolved = resolveAuthoritativeContentMetadata([
    evidence({ authority: "client", language: "fr" }),
    evidence({ authority: "catalog", language: "hi" }),
    evidence({ authority: "cms", language: "en" }),
  ]);
  assert.equal(resolved?.authority, "cms");
  assert.equal(resolved?.language, "en");
});

test("publish/update/unpublish ordering is temporal and deterministic", () => {
  const ordered = [
    evidence({ eventType: "CONTENT_PUBLISHED", occurredAt: "2026-09-06T00:00:00.000Z" }),
    evidence({ eventType: "CONTENT_UPDATED", occurredAt: "2026-09-06T00:01:00.000Z" }),
    evidence({ eventType: "CONTENT_UNPUBLISHED", occurredAt: "2026-09-06T00:02:00.000Z" }),
  ];
  assert.equal(validateContentTemporalOrder(ordered), true);
  assert.equal(validateContentTemporalOrder([ordered[1], ordered[0]]), false);
});

test("null metadata remains unknown and client metadata cannot override truth", () => {
  const result = adaptContentObservation(evidence({
    language: null,
    durationSeconds: null,
    genreIds: null,
    publicationState: "unknown",
    availabilityState: "unknown",
  }), base);
  assert.equal(result.ok, true);
  assert.equal(result.value.payload.metric, "content_published");
  assert.equal(result.value.payload.value, 1);
  assert.equal(adaptContentObservation(evidence({ authority: "client" }), base).ok, false);
});

test("rejects ranking contamination and fabricated performance metrics", () => {
  assert.equal(adaptContentObservation(evidence({ score: 99 }), base).ok, false);
  assert.equal(adaptContentObservation(evidence({ genreIds: ["quality-score"] }), base).ok, false);
});

test("CanonicalEvent projection is valid and observation failure is fail-open", async () => {
  const result = adaptContentObservation(evidence(), base);
  assert.equal(result.ok, true);
  assert.equal(toContentCanonicalEvent(result.value).event_id, base.observationId);
  let failure: unknown = null;
  runContentObservationFailOpen(Promise.reject(new Error("sink unavailable")), (error) => {
    failure = error;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((failure as Error).message, "sink unavailable");
});
