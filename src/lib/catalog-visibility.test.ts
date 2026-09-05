import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * CMS-C05 — Catalog & Consumer Visibility rules.
 *
 * `lib/catalog-rules` is intentionally free of `server-only` imports so the
 * Node test runner can lock the exact consumer-visibility predicates the
 * catalog and Home server paths apply. `lib/api/serializers` is pure as well,
 * so the consumer payload contract (no undefined/null malformed leakage, no
 * internal media asset references) is covered here too.
 */

import {
  isMediaAssetReady,
  isReleased,
  isSeriesConsumerVisible,
  isShortFilmConsumerVisible,
  resolveShortFilmPlaybackReady,
} from "@/lib/catalog-rules";
import { serializeEpisode, serializeSeries, serializeShortFilm, serializeEpisodeAccess } from "@/lib/api/serializers";
import type { ContentItem, Episode } from "@/data/content";
import {
  normalizeContentRating,
  normalizeContentDescriptors,
  CONTENT_RATINGS,
  CONTENT_DESCRIPTORS,
  getParentalLockRequired,
  getAgeVerificationRequired,
  resolveContentClassification,
} from "@/lib/classification";

const FUTURE = new Date(Date.now() + 86_400_000).toISOString(); // tomorrow
const PAST = new Date(Date.now() - 86_400_000).toISOString(); // yesterday

function assertNoUndefined(value: unknown, path = "root") {
  if (value === undefined) {
    throw new Error(`Undefined value leaked at ${path}`);
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUndefined(item, `${path}[${index}]`));
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assertNoUndefined(child, `${path}.${key}`);
    }
  }
}

const INTERNAL_MEDIA_KEYS = [
  "media_asset_id",
  "mediaAssetId",
  "playback_reference",
  "provider_playback_reference",
  "video_asset_id",
  "preview_media_asset_id",
];
// ---------------------------------------------------------------------------
// Scheduled publish visibility (short films)
// ---------------------------------------------------------------------------

test("isReleased: null/past publish dates are released, future is not", () => {
  assert.equal(isReleased(null), true);
  assert.equal(isReleased(PAST), true);
  assert.equal(isReleased(FUTURE), false);
  assert.equal(isReleased("not-a-date"), false);
  assert.equal(isReleased(FUTURE, Date.parse(FUTURE)), true);
});

test("isShortFilmConsumerVisible: published+released only", () => {
  assert.equal(isShortFilmConsumerVisible({ status: "published", publish_at: null }), true);
  assert.equal(isShortFilmConsumerVisible({ status: "published", publish_at: PAST }), true);
  assert.equal(isShortFilmConsumerVisible({ status: "published", publish_at: FUTURE }), false);
  assert.equal(isShortFilmConsumerVisible({ status: "draft", publish_at: null }), false);
  assert.equal(isShortFilmConsumerVisible({ status: "archived", publish_at: null }), false);
});

// ---------------------------------------------------------------------------
// Home Short Films category auto-population eligibility
// ---------------------------------------------------------------------------
// The Short Films category must be "all published short films" (published AND
// publish_at IS NULL OR publish_at <= now). It delegates to the same
// consumer-visibility predicate as the catalog so the category can never drop
// NULL publish_at rows the way the old `.lte("publish_at", now)` SQL filter
// silently did (in Postgres, `NULL <= now` is not true, so NULL rows vanished).

test("short films category: published + publish_at=NULL is INCLUDED", () => {
  assert.equal(isShortFilmConsumerVisible({ status: "published", publish_at: null }), true);
  assert.equal(isShortFilmConsumerVisible({ status: "published", publish_at: "" }, 0), true);
});

test("short films category: published + past publish_at is INCLUDED", () => {
  assert.equal(isShortFilmConsumerVisible({ status: "published", publish_at: PAST }), true);
});

test("short films category: future publish_at is EXCLUDED", () => {
  assert.equal(isShortFilmConsumerVisible({ status: "published", publish_at: FUTURE }), false);
});

test("short films category: unpublished is EXCLUDED regardless of publish_at", () => {
  for (const status of ["draft", "archived"] as const) {
    assert.equal(isShortFilmConsumerVisible({ status, publish_at: null }), false);
    assert.equal(isShortFilmConsumerVisible({ status, publish_at: PAST }), false);
    assert.equal(isShortFilmConsumerVisible({ status, publish_at: FUTURE }), false);
  }
});

// ---------------------------------------------------------------------------
// Media readiness (source of truth: media_assets.status + playback reference)
// ---------------------------------------------------------------------------

test("isMediaAssetReady: requires ready status and a playback reference", () => {
  assert.equal(isMediaAssetReady(null), false);
  assert.equal(isMediaAssetReady(undefined), false);
  assert.equal(
    isMediaAssetReady({ status: "ready", provider_playback_reference: "playback/abc" }),
    true,
  );
  assert.equal(isMediaAssetReady({ status: "ready", provider_playback_reference: null }), false);
  assert.equal(isMediaAssetReady({ status: "ready", provider_playback_reference: "   " }), false);
  assert.equal(
    isMediaAssetReady({ status: "processing", provider_playback_reference: "playback/abc" }),
    false,
  );
  assert.equal(
    isMediaAssetReady({ status: "failed", provider_playback_reference: "playback/abc" }),
    false,
  );
});
test("short film playbackReady: media_assets readiness governs (legacy column ignored)", () => {
  // The production media-assignment path never writes short_films.playback_reference,
  // so readiness must come from the assigned media asset, not the legacy column.
  assert.equal(
    resolveShortFilmPlaybackReady({
      status: "published",
      publishAt: null,
      mediaReady: true,
      ageVerificationRequired: false,
    }),
    true,
  );
  assert.equal(
    resolveShortFilmPlaybackReady({
      status: "published",
      publishAt: FUTURE,
      mediaReady: true,
      ageVerificationRequired: false,
    }),
    false,
  );
  assert.equal(
    resolveShortFilmPlaybackReady({
      status: "published",
      publishAt: null,
      mediaReady: false,
      ageVerificationRequired: false,
    }),
    false,
  );
  assert.equal(
    resolveShortFilmPlaybackReady({
      status: "published",
      publishAt: null,
      mediaReady: true,
      ageVerificationRequired: true,
    }),
    false,
  );
  assert.equal(
    resolveShortFilmPlaybackReady({
      status: "draft",
      publishAt: null,
      mediaReady: true,
      ageVerificationRequired: false,
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// Series visibility: only series serving at least one episode are visible
// ---------------------------------------------------------------------------

test("isSeriesConsumerVisible: empty episode lists are not consumer-visible", () => {
  assert.equal(isSeriesConsumerVisible([]), false);
  assert.equal(isSeriesConsumerVisible([{ number: 1 }]), true);
});

test("catalog episode media filter: only episodes with a ready media asset survive", () => {
  const rows = [
    { episode_number: 1, media_asset_id: "ready-asset" },
    { episode_number: 2, media_asset_id: "processing-asset" },
    { episode_number: 3, media_asset_id: null },
    { episode_number: 4, media_asset_id: "ready-asset" },
  ];
  const readyAssetIds = new Set(["ready-asset"]);
  const served = rows.filter((row) => row.media_asset_id && readyAssetIds.has(row.media_asset_id));

  assert.deepEqual(
    served.map((row) => row.episode_number),
    [1, 4],
  );
});
// ---------------------------------------------------------------------------
// Consumer payload serialization — malformed/null/undefined protection
// ---------------------------------------------------------------------------

function episodeFixture(overrides: Partial<Episode> = {}): Episode {
  return {
    number: 1,
    title: "Episode One",
    description: "A description",
    runtime: "1:30",
    isFree: false,
    isLocked: true,
    coinUnlockEnabled: true,
    rewardedUnlockEnabled: false,
    rewardedAccessMode: "permanent",
    requiredRewardedCompletions: 1,
    plusAccess: false,
    lockedPreviewSeconds: 0,
    ...overrides,
  };
}

test("serializeEpisode: full access payload, defaults applied, no media internals", () => {
  const serialized = serializeEpisode(
    episodeFixture({
      number: 3,
      id: "episode-uuid",
      contentRating: "U/A 13+",
      contentDescriptors: ["language"],
      parentalLockRequired: true,
      ageVerificationRequired: false,
    }),
  );

  assert.equal(serialized.number, 3);
  assert.equal(serialized.id, "episode-uuid");
  assert.equal(serialized.coinPrice, 0); // defaulted from undefined
  assert.equal(serialized.contentRating, "U/A 13+");
  assert.equal(serialized.contentRatingOverride, null); // defaulted
  assert.deepEqual(serialized.contentDescriptorsOverride, []); // defaulted
  assert.equal(serialized.rewardedAccessMode, "permanent");

  assertNoUndefined(serialized);
  for (const key of INTERNAL_MEDIA_KEYS) {
    assert.equal(key in serialized, false, `episode serializer must not expose ${key}`);
  }
});
test("serializeSeries: episodeCount matches served episodes and nothing leaks", () => {
  const series: ContentItem = {
    id: "series-slug",
    title: "A Series",
    slug: "a-series",
    contentType: "MICRO_DRAMA",
    genre: "Drama",
    primaryGenre: { id: "drama", displayName: "Drama" },
    secondaryGenres: [],
    format: "Series",
    episodeCount: 2,
    episodeDuration: "8 min episodes",
    synopsis: "Synopsis",
    poster: "/poster.jpg",
    accent: "#0DD1BC",
    episodes: [episodeFixture({ number: 1 }), episodeFixture({ number: 2 })],
    contentRating: "U",
    contentDescriptors: [],
    parentalLockRequired: false,
    ageVerificationRequired: false,
  };

  const serialized = serializeSeries(series);

  assert.equal(serialized.episodeCount, 2);
  assert.equal(serialized.episodes.length, 2);
  assert.equal(serialized.episodes[0].number, 1);
  assertNoUndefined(serialized);
  for (const key of INTERNAL_MEDIA_KEYS) {
    assert.equal(key in serialized, false, `series serializer must not expose ${key}`);
  }
});

test("serializeShortFilm: status/publishAt preserved, no undefined, no media internals", () => {
  const shortFilm = {
    id: "short-uuid",
    slug: "a-short",
    title: "A Short Film",
    contentType: "SHORT_FILM" as const,
    synopsis: "Synopsis",
    genre: null,
    primaryGenre: null,
    secondaryGenres: [],
    poster: "/poster.jpg",
    heroImage: null,
    creatorReference: null,
    durationSeconds: 180,
    durationLabel: "3 min",
    language: "Hindi",
    contentRating: null,
    contentDescriptors: [],
    parentalLockRequired: false,
    ageVerificationRequired: false,
    status: "published" as const,
    publishAt: PAST,
    midrollEnabled: true,
    midrollTimecodes: [15],
    postrollEnabled: false,
    chaiEnabled: true,
    playbackReady: true,
    sharePath: "/short-films/a-short",
  };

  const serialized = serializeShortFilm(shortFilm);

  assert.equal(serialized.slug, "a-short");
  assert.equal(serialized.status, "published");
  assert.equal(serialized.publishAt, PAST);
  assert.equal(serialized.chaiEnabled, true);
  assert.equal(serialized.playbackReady, true);
  assert.equal(serialized.sharePath, "/short-films/a-short");
  assertNoUndefined(serialized);
  for (const key of INTERNAL_MEDIA_KEYS) {
    assert.equal(key in serialized, false, `short film serializer must not expose ${key}`);
  }
});

test("serializeEpisodeAccess: access map keyed by episode number", () => {
  const serialized = serializeEpisodeAccess(
    new Map([
      [1, { canWatch: true, kind: "free", label: "Free" }],
      [2, { canWatch: false, kind: "locked", label: "Locked" }],
    ]),
  );

  assert.equal(serialized["1"].canWatch, true);
  assert.equal(serialized["1"].kind, "free");
  assert.equal(serialized["2"].kind, "locked");
  assert.equal(serialized["2"].canWatch, false);
});

// ---------------------------------------------------------------------------
// CMS-C07 — Scheduling edge cases
// ---------------------------------------------------------------------------

test("isReleased: null publish_at means immediately released", () => {
  assert.equal(isReleased(null), true);
  assert.equal(isReleased(undefined), true);
});

test("isReleased: unparseable date string is treated as not yet released", () => {
  assert.equal(isReleased("not-a-date"), false);
  assert.equal(isReleased("   "), false);
});

test("isReleased: exact boundary — timestamp at or before now is released", () => {
  const now = Date.now();
  assert.equal(isReleased(new Date(now).toISOString(), now), true);
  assert.equal(isReleased(new Date(now - 1_000).toISOString(), now), true);
});

test("isShortFilmConsumerVisible: archived status is never visible even with null publish_at", () => {
  assert.equal(isShortFilmConsumerVisible({ status: "archived", publish_at: null }), false);
  assert.equal(isShortFilmConsumerVisible({ status: "archived", publish_at: PAST }), false);
});

test("isShortFilmConsumerVisible: draft status is never visible regardless of publish_at", () => {
  assert.equal(isShortFilmConsumerVisible({ status: "draft", publish_at: null }), false);
  assert.equal(isShortFilmConsumerVisible({ status: "draft", publish_at: PAST }), false);
  assert.equal(isShortFilmConsumerVisible({ status: "draft", publish_at: FUTURE }), false);
});

test("resolveShortFilmPlaybackReady: future publish_at blocks playback even when media is ready", () => {
  assert.equal(
    resolveShortFilmPlaybackReady({
      status: "published",
      publishAt: FUTURE,
      mediaReady: true,
      ageVerificationRequired: false,
    }),
    false,
  );
});

test("resolveShortFilmPlaybackReady: null publish_at releases immediately when media ready", () => {
  assert.equal(
    resolveShortFilmPlaybackReady({
      status: "published",
      publishAt: null,
      mediaReady: true,
      ageVerificationRequired: false,
    }),
    true,
  );
});

test("consumer short-film serializer preserves publishAt for released content", () => {
  const shortFilm = {
    id: "sf-1",
    slug: "released-sf",
    title: "Released Short",
    contentType: "SHORT_FILM" as const,
    synopsis: "Synopsis",
    genre: null,
    primaryGenre: null,
    secondaryGenres: [],
    poster: "/poster.jpg",
    heroImage: null,
    creatorReference: null,
    durationSeconds: 120,
    durationLabel: "2 min",
    language: null,
    contentRating: "U" as const,
    contentDescriptors: [],
    parentalLockRequired: false,
    ageVerificationRequired: false,
    status: "published" as const,
    publishAt: PAST,
    midrollEnabled: false,
    midrollTimecodes: [],
    postrollEnabled: false,
    chaiEnabled: false,
    playbackReady: true,
    sharePath: "/short-films/released-sf",
  };

  const serialized = serializeShortFilm(shortFilm);
  assert.equal(serialized.publishAt, PAST);
  assert.equal(serialized.status, "published");
});

test("consumer short-film serializer: null publish_at is passed through for immediate release", () => {
  const shortFilm = {
    id: "sf-2",
    slug: "immediate-sf",
    title: "Immediate Short",
    contentType: "SHORT_FILM" as const,
    synopsis: "Synopsis",
    genre: null,
    primaryGenre: null,
    secondaryGenres: [],
    poster: "/poster.jpg",
    heroImage: null,
    creatorReference: null,
    durationSeconds: 120,
    durationLabel: "2 min",
    language: null,
    contentRating: null,
    contentDescriptors: [],
    parentalLockRequired: false,
    ageVerificationRequired: false,
    status: "published" as const,
    publishAt: null,
    midrollEnabled: false,
    midrollTimecodes: [],
    postrollEnabled: false,
    chaiEnabled: false,
    playbackReady: true,
    sharePath: "/short-films/immediate-sf",
  };

  const serialized = serializeShortFilm(shortFilm);
  assert.equal(serialized.publishAt, null);
});

// ---------------------------------------------------------------------------
// CMS-C07 — Ratings and descriptors validation (pure functions)
// ---------------------------------------------------------------------------

test("normalizeContentRating: accepts all five CBFC ratings", () => {
  for (const rating of CONTENT_RATINGS) {
    assert.equal(normalizeContentRating(rating), rating);
  }
});

test("normalizeContentRating: rejects unknown values and returns null", () => {
  assert.equal(normalizeContentRating("PG-13"), null);
  assert.equal(normalizeContentRating("X"), null);
  assert.equal(normalizeContentRating(""), null);
  assert.equal(normalizeContentRating(undefined), null);
  assert.equal(normalizeContentRating(null), null);
});

test("normalizeContentDescriptors: deduplicates and preserves order", () => {
  const result = normalizeContentDescriptors(["violence", "language", "violence", "mature themes"]);
  assert.deepEqual(result, ["violence", "language", "mature themes"]);
});

test("normalizeContentDescriptors: silently drops invalid vocabulary", () => {
  const result = normalizeContentDescriptors(["language", "bad-descriptor", "violence"]);
  assert.deepEqual(result, ["language", "violence"]);
});

test("normalizeContentDescriptors: null/undefined input yields empty array", () => {
  assert.deepEqual(normalizeContentDescriptors(null), []);
  assert.deepEqual(normalizeContentDescriptors(undefined), []);
});

test("normalizeContentDescriptors: all six CBFC descriptors accepted", () => {
  const result = normalizeContentDescriptors([...CONTENT_DESCRIPTORS]);
  assert.deepEqual(result, [...CONTENT_DESCRIPTORS]);
});

test("getParentalLockRequired: U/A 13+, U/A 16+, A require parental lock; U, U/A 7+, null do not", () => {
  assert.equal(getParentalLockRequired("U"), false);
  assert.equal(getParentalLockRequired("U/A 7+"), false);
  assert.equal(getParentalLockRequired("U/A 13+"), true);
  assert.equal(getParentalLockRequired("U/A 16+"), true);
  assert.equal(getParentalLockRequired("A"), true);
  assert.equal(getParentalLockRequired(null), false);
});

test("getAgeVerificationRequired: only A-rated content requires age verification", () => {
  assert.equal(getAgeVerificationRequired("A"), true);
  assert.equal(getAgeVerificationRequired("U/A 16+"), false);
  assert.equal(getAgeVerificationRequired(null), false);
});

test("resolveContentClassification: derives parental and age flags from rating", () => {
  const result = resolveContentClassification("U/A 13+", ["violence"]);
  assert.equal(result.contentRating, "U/A 13+");
  assert.deepEqual(result.contentDescriptors, ["violence"]);
  assert.equal(result.parentalLockRequired, true);
  assert.equal(result.ageVerificationRequired, false);
});

test("resolveContentClassification: null rating yields no flags and empty descriptors default", () => {
  const result = resolveContentClassification(null);
  assert.equal(result.contentRating, null);
  assert.deepEqual(result.contentDescriptors, []);
  assert.equal(result.parentalLockRequired, false);
  assert.equal(result.ageVerificationRequired, false);
});

// ---------------------------------------------------------------------------
// CMS-C07 — Consumer payload: ratings/descriptors parity across content types
// ---------------------------------------------------------------------------

test("consumer series serializer: contentRating and contentDescriptors present after normalization", () => {
  const series: ContentItem = {
    id: "s1",
    title: "Series",
    slug: "s1",
    genre: "Drama",
    format: "Series",
    episodeCount: 1,
    episodeDuration: "8 min",
    synopsis: "Synopsis",
    poster: "/poster.jpg",
    accent: "#000",
    episodes: [],
    contentRating: "U/A 13+",
    contentDescriptors: ["violence"],
    parentalLockRequired: true,
    ageVerificationRequired: false,
  };

  const serialized = serializeSeries(series);
  assert.equal(serialized.contentRating, "U/A 13+");
  assert.deepEqual(serialized.contentDescriptors, ["violence"]);
  assert.equal(serialized.parentalLockRequired, true);
});

test("consumer episode serializer: override fields default to null/[] when absent", () => {
  const episode: Episode = {
    number: 1,
    title: "Ep",
    description: "Desc",
    runtime: "1:00",
    isFree: false,
    isLocked: true,
    coinUnlockEnabled: false,
    rewardedUnlockEnabled: false,
    rewardedAccessMode: "permanent",
    requiredRewardedCompletions: 1,
    plusAccess: false,
    lockedPreviewSeconds: 0,
  };

  const serialized = serializeEpisode(episode);
  assert.equal(serialized.contentRatingOverride, null);
  assert.deepEqual(serialized.contentDescriptorsOverride, []);
  assert.equal(serialized.contentRating, null);
  assert.deepEqual(serialized.contentDescriptors, []);
});
