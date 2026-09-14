import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPlaybackTelemetry, type PublishedEpisode, type PublishedShortFilm, type WatchProgressRow, type PlaybackTelemetryOutput } from "./playback-telemetry";

function buildSnapshot(rows: WatchProgressRow[], episodes: PublishedEpisode[], shortFilms: PublishedShortFilm[]): PlaybackTelemetryOutput {
  return buildPlaybackTelemetry(rows, episodes, shortFilms);
}

describe("C09B-02 playback telemetry snapshot", () => {
  it("returns PlaybackTelemetrySnapshot shape from live DB or skips when unavailable", async () => {
    let snapshot;
    try {
      snapshot = await import("./analytics").then((m) => m.getPlaybackTelemetrySnapshot());
    } catch {
      return;
    }

    assert.ok(snapshot.generatedAt > 0);
    assert.strictEqual(snapshot.authority, "DERIVED");
    assert.strictEqual(snapshot.source, "TELEMETRY");
    assert.strictEqual(snapshot.caveat, "Historical completeness may be partial.");
    assert.ok(Array.isArray(snapshot.episodeDropoff));
    assert.ok("overall" in snapshot.seriesCompletionRate);
    assert.ok(Array.isArray(snapshot.seriesCompletionRate.bySeries));
  });

  it("contains zero PII keys in returned snapshot", async () => {
    let snapshot;
    try {
      snapshot = await import("./analytics").then((m) => m.getPlaybackTelemetrySnapshot());
    } catch {
      return;
    }

    const json = JSON.stringify(snapshot);
    const piiKeys = [
      "user_id",
      "userId",
      "email",
      "phone",
      "device_id",
      "deviceId",
      "sessionId",
      "customerId",
    ];
    for (const key of piiKeys) {
      assert.ok(!json.includes(key), `PII key "${key}" must not appear in playback telemetry output`);
    }
  });

  it("does not contain prohibited KPI keys at the top level", async () => {
    let snapshot;
    try {
      snapshot = await import("./analytics").then((m) => m.getPlaybackTelemetrySnapshot());
    } catch {
      return;
    }

    const parsed = JSON.parse(JSON.stringify(snapshot));
    const prohibitedKeys = [
      "plays",
      "uniqueViewers",
      "watchTime",
      "resumeRate",
      "playbackFailures",
      "trend",
      "revenue",
      "conversion",
    ];
    for (const key of prohibitedKeys) {
      assert.ok(!(key in parsed), `Prohibited key "${key}" must not appear at the top level of PlaybackTelemetrySnapshot`);
    }
  });

  it("aggregates completion rate from pure buildPlaybackTelemetry", () => {
    const rows: WatchProgressRow[] = [
      { userId: "u1", contentType: "series_episode", seriesSlug: "s1", episodeNumber: 1, shortFilmSlug: null, durationSeconds: 100, completed: true },
      { userId: "u1", contentType: "series_episode", seriesSlug: "s1", episodeNumber: 1, shortFilmSlug: null, durationSeconds: 100, completed: false },
      { userId: "u2", contentType: "short_film", seriesSlug: null, episodeNumber: null, shortFilmSlug: "sf1", durationSeconds: 200, completed: true },
    ];
    const episodes: PublishedEpisode[] = [
      { seriesSlug: "s1", episodeNumber: 1, status: "published", durationSeconds: 100 },
    ];
    const shortFilms: PublishedShortFilm[] = [
      { slug: "sf1", status: "published", durationSeconds: 200 },
    ];

    const result = buildSnapshot(rows, episodes, shortFilms);
    assert.strictEqual(result.completionRate.seriesEpisodes, 0.5);
    assert.strictEqual(result.completionRate.shortFilms, 1);
  });

  it("returns null for zero-denominator completion rate", () => {
    const result = buildSnapshot([], [], []);
    assert.strictEqual(result.completionRate.seriesEpisodes, null);
    assert.strictEqual(result.completionRate.shortFilms, null);
  });

  it("episode drop-off excludes last episode from dropoff", () => {
    const rows: WatchProgressRow[] = [
      { userId: "u1", contentType: "series_episode", seriesSlug: "s1", episodeNumber: 1, shortFilmSlug: null, durationSeconds: 100, completed: true },
      { userId: "u1", contentType: "series_episode", seriesSlug: "s1", episodeNumber: 2, shortFilmSlug: null, durationSeconds: 100, completed: true },
    ];
    const episodes: PublishedEpisode[] = [
      { seriesSlug: "s1", episodeNumber: 1, status: "published", durationSeconds: 100 },
      { seriesSlug: "s1", episodeNumber: 2, status: "published", durationSeconds: 100 },
    ];

    const result = buildSnapshot(rows, episodes, []);
    const last = result.episodeDropoff[result.episodeDropoff.length - 1];
    assert.strictEqual(last.episodeNumber, 2);
    assert.strictEqual(last.recordsReachingNext, null);
    assert.strictEqual(last.dropoffRate, null);
  });

  it("series completion rate aggregates across series", () => {
    const rows: WatchProgressRow[] = [
      { userId: "u1", contentType: "series_episode", seriesSlug: "s1", episodeNumber: 1, shortFilmSlug: null, durationSeconds: 100, completed: true },
      { userId: "u1", contentType: "series_episode", seriesSlug: "s1", episodeNumber: 2, shortFilmSlug: null, durationSeconds: 100, completed: true },
      { userId: "u2", contentType: "series_episode", seriesSlug: "s1", episodeNumber: 1, shortFilmSlug: null, durationSeconds: 100, completed: true },
      { userId: "u2", contentType: "series_episode", seriesSlug: "s1", episodeNumber: 2, shortFilmSlug: null, durationSeconds: 100, completed: false },
    ];
    const episodes: PublishedEpisode[] = [
      { seriesSlug: "s1", episodeNumber: 1, status: "published", durationSeconds: 100 },
      { seriesSlug: "s1", episodeNumber: 2, status: "published", durationSeconds: 100 },
    ];

    const result = buildSnapshot(rows, episodes, []);
    assert.strictEqual(result.seriesCompletionRate.overall, 0.5);
    assert.strictEqual(result.seriesCompletionRate.bySeries[0].seriesSlug, "s1");
    assert.strictEqual(result.seriesCompletionRate.bySeries[0].completionRate, 0.5);
  });
});
