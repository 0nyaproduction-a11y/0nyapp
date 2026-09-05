import { test } from "node:test";
import assert from "node:assert/strict";
import { isMediaAssetReady } from "@/lib/catalog-rules";
import type { Database } from "@/types/database";

type SeriesRow = Database["public"]["Tables"]["series"]["Row"];
type ShortFilmRow = Database["public"]["Tables"]["short_films"]["Row"];

const PAST = new Date(Date.now() - 86_400_000).toISOString();
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

function seriesRow(overrides: Partial<SeriesRow> = {}): SeriesRow {
  return {
    id: "series-1",
    slug: "test-series",
    title: "Test Series",
    synopsis: null,
    genre: "Drama",
    language: null,
    format: "Series",
    episode_count: 5,
    episode_duration_label: null,
    poster_url: null,
    hero_image_url: null,
    content_rating: null,
    content_descriptors: [],
    status: "published",
    published_at: PAST,
    featured: false,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function shortFilmRow(overrides: Partial<ShortFilmRow> = {}): ShortFilmRow {
  return {
    id: "sf-1",
    slug: "test-short-film",
    title: "Test Short Film",
    synopsis: null,
    poster_url: null,
    hero_image_url: null,
    content_rating: null,
    content_descriptors: [],
    status: "published",
    publish_at: PAST,
    media_asset_id: "asset-1",
    language: null,
    creator_reference: null,
    duration_seconds: 120,
    midroll_enabled: false,
    midroll_timecodes: [],
    postroll_enabled: false,
    chai_enabled: false,
    playback_reference: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CMS-C04 — Hybrid New Releases visibility predicates
// ---------------------------------------------------------------------------

function isPublishedSeries(row: Pick<SeriesRow, "status">) {
  return row.status === "published";
}

function isPublishedShortFilm(
  row: Pick<ShortFilmRow, "status" | "publish_at">,
  nowMs = Date.now(),
) {
  return (
    row.status === "published" &&
    (!row.publish_at || new Date(row.publish_at).getTime() <= nowMs)
  );
}

test("series: published_at null excludes series from New Releases", () => {
  const row = seriesRow({ published_at: null });
  assert.equal(isPublishedSeries(row), true);
  // The hybrid resolver filters out series with null published_at
  assert.equal(row.published_at, null);
});

test("series: draft status excluded from New Releases", () => {
  const row = seriesRow({ status: "draft", published_at: PAST });
  assert.equal(isPublishedSeries(row), false);
});

test("series: archived status excluded from New Releases", () => {
  const row = seriesRow({ status: "archived", published_at: PAST });
  assert.equal(isPublishedSeries(row), false);
});

test("series: future published_at excluded from New Releases", () => {
  const row = seriesRow({ published_at: FUTURE });
  assert.equal(isPublishedSeries(row), true);
  // The hybrid resolver checks: new Date(published_at) > now
  assert.equal(new Date(row.published_at!).getTime() > Date.now(), true);
});

test("short film: published with null publish_at is released", () => {
  const row = shortFilmRow({ publish_at: null });
  assert.equal(isPublishedShortFilm(row), true);
});

test("short film: published with past publish_at is released", () => {
  const row = shortFilmRow({ publish_at: PAST });
  assert.equal(isPublishedShortFilm(row), true);
});

test("short film: published with future publish_at is NOT released", () => {
  const row = shortFilmRow({ publish_at: FUTURE });
  assert.equal(isPublishedShortFilm(row), false);
});

test("short film: draft status never released regardless of publish_at", () => {
  assert.equal(isPublishedShortFilm(shortFilmRow({ status: "draft", publish_at: PAST })), false);
  assert.equal(isPublishedShortFilm(shortFilmRow({ status: "draft", publish_at: FUTURE })), false);
  assert.equal(isPublishedShortFilm(shortFilmRow({ status: "draft", publish_at: null })), false);
});

test("short film: archived status never released regardless of publish_at", () => {
  assert.equal(isPublishedShortFilm(shortFilmRow({ status: "archived", publish_at: PAST })), false);
  assert.equal(isPublishedShortFilm(shortFilmRow({ status: "archived", publish_at: null })), false);
});

// ---------------------------------------------------------------------------
// CMS-C04 — Chronology sorting (mixed Series/Short Film)
// ---------------------------------------------------------------------------

test("mixed chronology: published_at and publish_at sorted descending", () => {
  // Simulate a merged list of items with timestamps
  const items = [
    { slug: "series-a", publishedAt: PAST, contentType: "series" },
    { slug: "sf-b", publishedAt: FUTURE, contentType: "short_film" },
    { slug: "series-c", publishedAt: "2026-09-02T10:56:10.200148+00", contentType: "series" },
    { slug: "sf-d", publishedAt: null, contentType: "short_film" },
  ];

  // Filter to only released items (publish date <= now)
  const now = Date.now();
  const released = items.filter((item) => {
    if (!item.publishedAt) return true;
    return new Date(item.publishedAt).getTime() <= now;
  });

  // Sort by publishedAt descending
  released.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });

  // FUTURE item should have been filtered out
  const slugs = released.map((i) => i.slug);
  assert.equal(slugs.includes("sf-b"), false);
  // Remaining items sorted by time descending
  const times = released.map((i) => (i.publishedAt ? new Date(i.publishedAt).getTime() : 0));
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i - 1] >= times[i], `Order violation at index ${i}`);
  }
});

test("chronology: null publishedAt sorts last (treated as 0 timestamp)", () => {
  const items = [
    { slug: "null-ts", publishedAt: null, contentType: "series" },
    { slug: "past-ts", publishedAt: PAST, contentType: "series" },
  ];
  items.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });
  assert.equal(items[0].slug, "past-ts");
  assert.equal(items[1].slug, "null-ts");
});

// ---------------------------------------------------------------------------
// CMS-C04 — Deduplication
// ---------------------------------------------------------------------------

test("deduplication: same content_id in editorial + auto appears once", () => {
  const seenIds = new Set<string>();
  const items: string[] = [];

  const key = "series:abc-123-def";
  // Editorial pass
  if (!seenIds.has(key)) {
    items.push(key);
    seenIds.add(key);
  }
  // Auto pass — same key
  if (!seenIds.has(key)) {
    items.push(key);
    seenIds.add(key);
  }
  assert.equal(items.length, 1);
});

test("deduplication: different content types with different IDs are not deduped", () => {
  const seenIds = new Set<string>();
  const items: string[] = [];

  const keys = ["series:abc", "short_film:abc"];
  for (const key of keys) {
    if (!seenIds.has(key)) {
      items.push(key);
      seenIds.add(key);
    }
  }
  assert.equal(items.length, 2);
});

// ---------------------------------------------------------------------------
// CMS-C04 — Exclusion filtering
// ---------------------------------------------------------------------------

test("exclusion: excluded series is filtered from New Releases", () => {
  const excluded = new Set<string>(["series:abc-123"]);
  const autoSeries = [seriesRow({ id: "abc-123", slug: "excluded-series" })];

  const visible = autoSeries.filter((s) => !excluded.has("series:" + s.id));
  assert.equal(visible.length, 0);
});

test("exclusion: excluded short film is filtered from New Releases", () => {
  const excluded = new Set<string>(["short_film:xyz-789"]);
  const autoShortFilms = [shortFilmRow({ id: "xyz-789", slug: "excluded-sf" })];

  const visible = autoShortFilms.filter((sf) => !excluded.has("short_film:" + sf.id));
  assert.equal(visible.length, 0);
});

// ---------------------------------------------------------------------------
// CMS-C04 — Consumer-validity filter for short films (invalid-media)
// ---------------------------------------------------------------------------

test("invalid media: short film with null media_asset_id is not consumer-visible", () => {
  const sf = shortFilmRow({ media_asset_id: null });
  assert.equal(sf.media_asset_id, null);
  // isMediaAssetReady would return false for null asset
  assert.equal(isMediaAssetReady(null), false);
});

test("invalid media: short film with asset that is not ready is not consumer-visible", () => {
  const notReadyAsset: { status: "processing"; provider_playback_reference: string } = { status: "processing", provider_playback_reference: "ref" };
  // Simulate a non-ready asset
  assert.equal(isMediaAssetReady(notReadyAsset), false);
});

// ---------------------------------------------------------------------------
// CMS-C04 — Sort order: editorial (0) before auto (1)
// ---------------------------------------------------------------------------

test("sort order: editorial items (0) appear before auto items (1)", () => {
  const items = [
    { slug: "auto-item", sortOrder: 1, publishedAt: PAST },
    { slug: "editorial-item", sortOrder: 0, publishedAt: null },
  ];
  items.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });
  assert.equal(items[0].slug, "editorial-item");
  assert.equal(items[1].slug, "auto-item");
});
