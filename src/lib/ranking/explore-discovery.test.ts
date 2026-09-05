import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ALL_GENRES_FILTER,
  filterDiscoverableItems,
  getAvailableGenreOptions,
  getReleaseTimestamp,
  sortDiscoverableItems,
  toDiscoverableItems,
} from "../../../apps/android/src/lib/discovery";
import type {
  ApiGenre,
  ApiSeries,
  ApiShortFilm,
} from "../../../apps/android/src/types/api";

const romance: ApiGenre = { id: "romance", displayName: "Romance" };
const drama: ApiGenre = { id: "drama", displayName: "Drama" };
const thriller: ApiGenre = { id: "thriller", displayName: "Thriller" };

function series(overrides: Partial<ApiSeries> = {}): ApiSeries {
  return {
    title: overrides.title ?? "Series",
    slug: overrides.slug ?? "series",
    contentType: "MICRO_DRAMA",
    publishedAt: overrides.publishedAt ?? "2026-01-01T00:00:00.000Z",
    genre: overrides.genre ?? null,
    primaryGenre: overrides.primaryGenre ?? romance,
    secondaryGenres: overrides.secondaryGenres ?? [],
    format: "Series",
    episodeCount: 1,
    episodeDuration: "1:00",
    synopsis: "",
    poster: "",
    contentRating: null,
    contentDescriptors: [],
    parentalLockRequired: false,
    ageVerificationRequired: false,
    episodes: [],
  };
}

function shortFilm(overrides: Partial<ApiShortFilm> = {}): ApiShortFilm {
  return {
    id: overrides.id ?? "short-film-id",
    slug: overrides.slug ?? "short-film",
    title: overrides.title ?? "Short Film",
    contentType: "SHORT_FILM",
    synopsis: "",
    genre: overrides.genre ?? null,
    primaryGenre: overrides.primaryGenre ?? drama,
    secondaryGenres: overrides.secondaryGenres ?? [],
    poster: "",
    heroImage: null,
    creatorReference: null,
    durationSeconds: 120,
    durationLabel: "2m",
    language: null,
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
    sharePath: "/short-films/short-film",
  };
}

test("format filters use canonical contentType values", () => {
  const entries = toDiscoverableItems([series()], [shortFilm()]);

  assert.deepEqual(
    filterDiscoverableItems(entries, "micro-dramas", ALL_GENRES_FILTER).map(
      (entry) => entry.contentType,
    ),
    ["MICRO_DRAMA"],
  );
  assert.deepEqual(
    filterDiscoverableItems(entries, "short-films", ALL_GENRES_FILTER).map(
      (entry) => entry.contentType,
    ),
    ["SHORT_FILM"],
  );
});

test("genre filters use stable canonical IDs and ignore unknown IDs", () => {
  const entries = toDiscoverableItems(
    [series({ slug: "romance-series", primaryGenre: romance })],
    [shortFilm({ slug: "drama-film", primaryGenre: drama })],
  );

  assert.deepEqual(
    filterDiscoverableItems(entries, "all", "romance").map(
      (entry) => entry.item.slug,
    ),
    ["romance-series"],
  );
  assert.deepEqual(
    filterDiscoverableItems(entries, "all", "unknown").map(
      (entry) => entry.item.slug,
    ),
    [],
  );
});

test("available genre options come from canonical API genre identities", () => {
  const entries = toDiscoverableItems(
    [
      series({
        genre: "Free Form Label",
        primaryGenre: romance,
        secondaryGenres: [thriller],
      }),
    ],
    [shortFilm({ genre: "Another Label", primaryGenre: drama })],
  );

  assert.deepEqual(
    getAvailableGenreOptions(entries, "all").map((genre) => genre.id),
    ["drama", "romance", "thriller"],
  );
});

test("format and genre filters compose", () => {
  const entries = toDiscoverableItems(
    [series({ slug: "series-drama", primaryGenre: drama })],
    [shortFilm({ slug: "film-drama", primaryGenre: drama })],
  );

  assert.deepEqual(
    filterDiscoverableItems(entries, "short-films", "drama").map(
      (entry) => entry.item.slug,
    ),
    ["film-drama"],
  );
});

test("newest uses authoritative publication dates with stable tie-breaks", () => {
  const entries = toDiscoverableItems(
    [
      series({ slug: "b-series", publishedAt: "2026-01-03T00:00:00.000Z" }),
      series({ slug: "a-series", publishedAt: "2026-01-03T00:00:00.000Z" }),
    ],
    [shortFilm({ slug: "new-film", publishAt: "2026-01-04T00:00:00.000Z" })],
  );

  assert.deepEqual(
    sortDiscoverableItems(entries, "newest").map((entry) => entry.item.slug),
    ["new-film", "a-series", "b-series"],
  );
  assert.equal(
    getReleaseTimestamp(entries[0].item),
    Date.parse("2026-01-03T00:00:00.000Z"),
  );
});

test("default ordering preserves the current catalog order", () => {
  const entries = toDiscoverableItems(
    [series({ slug: "first" }), series({ slug: "second" })],
    [shortFilm({ slug: "third" })],
  );

  assert.deepEqual(
    sortDiscoverableItems(entries, "default").map((entry) => entry.item.slug),
    ["first", "second", "third"],
  );
});
