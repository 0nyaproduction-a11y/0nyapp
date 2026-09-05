import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createSearchResultContext,
  normalizeSearchQuery,
  searchDiscoverableItems,
} from "../../../apps/android/src/lib/search";
import {
  MAX_RECENT_SEARCHES,
  normalizeRecentSearchList,
  prependRecentSearch,
} from "../../../apps/android/src/lib/recentSearchModel";
import { toDiscoverableItems } from "../../../apps/android/src/lib/discovery";
import type {
  ApiGenre,
  ApiSeries,
  ApiShortFilm,
} from "../../../apps/android/src/types/api";

const drama: ApiGenre = { id: "drama", displayName: "Drama" };

function series(overrides: Partial<ApiSeries> = {}): ApiSeries {
  return {
    id: overrides.id ?? "series-id",
    title: overrides.title ?? "A Series",
    slug: overrides.slug ?? "a-series",
    contentType: "MICRO_DRAMA",
    publishedAt: overrides.publishedAt ?? "2026-01-01T00:00:00.000Z",
    language: overrides.language ?? "Hindi",
    genre: overrides.genre ?? "Drama",
    primaryGenre: overrides.primaryGenre ?? drama,
    secondaryGenres: overrides.secondaryGenres ?? [],
    format: "Series",
    episodeCount: 1,
    episodeDuration: "1:00",
    synopsis: overrides.synopsis ?? "A family searches for home.",
    poster: "",
    contentRating: null,
    contentDescriptors: [],
    parentalLockRequired: false,
    ageVerificationRequired: false,
    episodes: overrides.episodes ?? [
      {
        id: "episode-id",
        number: 1,
        title: "The First Letter",
        description: "A hidden envelope changes everything.",
        runtime: "1:00",
        isFree: true,
        coinPrice: 0,
        coinUnlockEnabled: false,
        rewardedUnlockEnabled: false,
        rewardedAccessMode: "permanent",
        requiredRewardedCompletions: 1,
        plusAccess: true,
        lockedPreviewSeconds: 0,
        contentRatingOverride: null,
        contentDescriptorsOverride: [],
        contentRating: null,
        contentDescriptors: [],
        parentalLockRequired: false,
        ageVerificationRequired: false,
      },
    ],
  };
}

function shortFilm(overrides: Partial<ApiShortFilm> = {}): ApiShortFilm {
  return {
    id: overrides.id ?? "film-id",
    slug: overrides.slug ?? "a-film",
    title: overrides.title ?? "A Film",
    contentType: "SHORT_FILM",
    synopsis: overrides.synopsis ?? "A musician returns to Mumbai.",
    genre: overrides.genre ?? "Drama",
    primaryGenre: overrides.primaryGenre ?? drama,
    secondaryGenres: overrides.secondaryGenres ?? [],
    poster: "",
    heroImage: null,
    creatorReference: overrides.creatorReference ?? "Anita Rao",
    durationSeconds: 120,
    durationLabel: "2m",
    language: overrides.language ?? "Marathi",
    contentRating: null,
    contentDescriptors: [],
    parentalLockRequired: false,
    ageVerificationRequired: false,
    status: "published",
    publishAt: overrides.publishAt ?? "2026-01-02T00:00:00.000Z",
    midrollEnabled: false,
    midrollTimecodes: [],
    postrollEnabled: false,
    chaiEnabled: false,
    playbackReady: true,
    sharePath: "/short-films/a-film",
  };
}

test("query normalization is deterministic", () => {
  assert.equal(normalizeSearchQuery("  MICRO\u00a0  Drama  "), "micro drama");
  assert.equal(normalizeSearchQuery("Ｍｉｃｒｏ"), "micro");
});

test("canonical genre IDs and canonical content formats drive Search", () => {
  const entries = toDiscoverableItems(
    [series({ genre: "Unapproved local genre" })],
    [shortFilm()],
  );

  assert.deepEqual(
    searchDiscoverableItems(entries, "drama", "all", "drama").map(
      (result) => result.item.slug,
    ),
    ["a-film", "a-series"],
  );
  assert.deepEqual(
    searchDiscoverableItems(entries, "short film", "all", "All").map(
      (result) => result.item.slug,
    ),
    ["a-film"],
  );
  assert.equal(
    searchDiscoverableItems(entries, "unapproved local genre", "all", "All")
      .length,
    0,
  );
});

test("real supported metadata fields are searchable without fabricated fields", () => {
  const entries = toDiscoverableItems([series()], [shortFilm()]);
  const find = (query: string) =>
    searchDiscoverableItems(entries, query, "all", "All").map(
      (result) => result.item.slug,
    );

  assert.deepEqual(find("a series"), ["a-series"]);
  assert.deepEqual(find("anita rao"), ["a-film"]);
  assert.deepEqual(find("marathi"), ["a-film"]);
  assert.deepEqual(find("musician"), ["a-film"]);
  assert.deepEqual(find("first letter"), ["a-series"]);
  assert.deepEqual(find("hidden envelope"), ["a-series"]);
  assert.deepEqual(find("2026-01-02"), []);
  assert.deepEqual(find("imaginary cast member"), []);
});

test("matching strength, title, and stable identifier produce deterministic order", () => {
  const entries = toDiscoverableItems(
    [
      series({ id: "z", slug: "z", title: "Moon" }),
      series({ id: "a", slug: "a", title: "Moon" }),
      series({ slug: "prefix", title: "Moonlight" }),
      series({ slug: "substring", title: "Blue Moon" }),
    ],
    [],
  );

  const first = searchDiscoverableItems(entries, "moon", "all", "All").map(
    (result) => result.item.slug,
  );
  const second = searchDiscoverableItems(entries, " moon ", "all", "All").map(
    (result) => result.item.slug,
  );

  assert.deepEqual(first, ["a", "z", "prefix", "substring"]);
  assert.deepEqual(second, first);
});

test("result navigation context carries query, one-based position, surface, and content", () => {
  const entry = toDiscoverableItems([], [shortFilm()])[0];
  assert.ok(entry);

  assert.deepEqual(createSearchResultContext(entry, "  Anita Rao ", 2), {
    contentId: "film-id",
    contentSlug: "a-film",
    contentType: "SHORT_FILM",
    searchQueryContext: "anita rao",
    searchResultPosition: 3,
    sourceSurface: "search",
  });
});

test("recent Search normalization, deduplication, order, and retention are preserved", () => {
  assert.deepEqual(
    normalizeRecentSearchList(["  Drama ", "drama", "Comedy", null]),
    ["Drama", "Comedy"],
  );
  assert.deepEqual(prependRecentSearch(["Drama", "Comedy"], " drama "), [
    "drama",
    "Comedy",
  ]);
  assert.equal(
    prependRecentSearch(
      Array.from({ length: MAX_RECENT_SEARCHES }, (_, index) => `q${index}`),
      "new",
    ).length,
    MAX_RECENT_SEARCHES,
  );
});
