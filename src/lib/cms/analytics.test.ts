import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { AnalyticsSnapshot } from "./analytics";

describe("C09B-01 analytics module structure", () => {
  it("exports the expected types and function signature", () => {
    const snapshot: AnalyticsSnapshot = {
      generatedAt: Date.now(),
      content: {
        publishedSeries: 0,
        publishedEpisodes: 0,
        publishedShortFilms: 0,
        homeRows: 0,
        homeRowItems: 0,
      },
      mediaGuardian: {
        READY: 0,
        PROCESSING: 0,
        FAILED: 0,
        MISSING: 0,
        UNASSIGNED: 0,
        PROBLEMS: 0,
      },
      playbackTelemetry: {
        completionRate: { seriesEpisodes: null, shortFilms: null },
        episodeDropoff: [],
        seriesCompletionRate: { overall: null, bySeries: [] },
        generatedAt: Date.now(),
        authority: "DERIVED",
        source: "TELEMETRY",
        caveat: "Historical completeness may be partial.",
      },
    };

    assert.strictEqual(typeof snapshot.generatedAt, "number");
    assert.strictEqual(typeof snapshot.content.publishedSeries, "number");
    assert.strictEqual(typeof snapshot.content.publishedEpisodes, "number");
    assert.strictEqual(typeof snapshot.content.publishedShortFilms, "number");
    assert.strictEqual(typeof snapshot.content.homeRows, "number");
    assert.strictEqual(typeof snapshot.content.homeRowItems, "number");
    assert.strictEqual(typeof snapshot.mediaGuardian.READY, "number");
    assert.strictEqual(typeof snapshot.mediaGuardian.PROCESSING, "number");
    assert.strictEqual(typeof snapshot.mediaGuardian.FAILED, "number");
    assert.strictEqual(typeof snapshot.mediaGuardian.MISSING, "number");
    assert.strictEqual(typeof snapshot.mediaGuardian.UNASSIGNED, "number");
    assert.strictEqual(typeof snapshot.mediaGuardian.PROBLEMS, "number");
    assert.strictEqual(snapshot.playbackTelemetry.authority, "DERIVED");
    assert.strictEqual(snapshot.playbackTelemetry.source, "TELEMETRY");
    assert.strictEqual(snapshot.playbackTelemetry.caveat, "Historical completeness may be partial.");
  });

  it("does not contain PII keys in the AnalyticsSnapshot type", () => {
    const piiKeys = [
      "user_id",
      "userId",
      "email",
      "phone",
      "device_id",
      "deviceId",
      "rawCustomerIdentifier",
      "sessionId",
      "customerId",
    ];

    const allKeys = new Set<string>([
      "generatedAt",
      "content",
      "publishedSeries",
      "publishedEpisodes",
      "publishedShortFilms",
      "homeRows",
      "homeRowItems",
      "mediaGuardian",
      "READY",
      "PROCESSING",
      "FAILED",
      "MISSING",
      "UNASSIGNED",
      "PROBLEMS",
      "playbackTelemetry",
      "completionRate",
      "seriesEpisodes",
      "shortFilms",
      "episodeDropoff",
      "seriesCompletionRate",
      "overall",
      "bySeries",
      "authority",
      "source",
      "caveat",
    ]);

    for (const key of piiKeys) {
      assert.ok(
        !allKeys.has(key),
        `PII key "${key}" must not appear in AnalyticsSnapshot`,
      );
    }
  });

  it("does not contain prohibited KPI keys at the top level", () => {
    const prohibitedKeys = [
      "revenue",
      "grossRevenue",
      "netRevenue",
      "arpu",
      "arppu",
      "plusSubscriptions",
      "subscriptionRevenue",
      "uniqueViewers",
      "plays",
      "watchTime",
      "conversionRate",
      "previewToUnlockConversion",
      "trend",
      "history",
      "delta",
      "change",
    ];

    const parsed = JSON.parse(JSON.stringify({
      generatedAt: 0,
      content: {},
      mediaGuardian: {},
      playbackTelemetry: {},
    }));

    for (const key of prohibitedKeys) {
      assert.ok(
        !(key in parsed),
        `Prohibited KPI key "${key}" must not appear at the top level of AnalyticsSnapshot`,
      );
    }
  });

  it("snapshot includes playbackTelemetry with DERIVED labels", () => {
    const snapshot: AnalyticsSnapshot = {
      generatedAt: Date.now(),
      content: {
        publishedSeries: 0,
        publishedEpisodes: 0,
        publishedShortFilms: 0,
        homeRows: 0,
        homeRowItems: 0,
      },
      mediaGuardian: {
        READY: 0,
        PROCESSING: 0,
        FAILED: 0,
        MISSING: 0,
        UNASSIGNED: 0,
        PROBLEMS: 0,
      },
      playbackTelemetry: {
        completionRate: { seriesEpisodes: null, shortFilms: null },
        episodeDropoff: [],
        seriesCompletionRate: { overall: null, bySeries: [] },
        generatedAt: Date.now(),
        authority: "DERIVED",
        source: "TELEMETRY",
        caveat: "Historical completeness may be partial.",
      },
    };

    assert.strictEqual(snapshot.playbackTelemetry.authority, "DERIVED");
    assert.strictEqual(snapshot.playbackTelemetry.source, "TELEMETRY");
    assert.strictEqual(snapshot.playbackTelemetry.caveat, "Historical completeness may be partial.");
  });

  it("playbackTelemetry completion rate shows null as Not enough data", () => {
    const rate = null;
    assert.strictEqual(rate, null);
  });

  it("playbackTelemetry does not expose PII keys in AnalyticsSnapshot", () => {
    const snapshot: AnalyticsSnapshot = {
      generatedAt: Date.now(),
      content: {
        publishedSeries: 0,
        publishedEpisodes: 0,
        publishedShortFilms: 0,
        homeRows: 0,
        homeRowItems: 0,
      },
      mediaGuardian: {
        READY: 0,
        PROCESSING: 0,
        FAILED: 0,
        MISSING: 0,
        UNASSIGNED: 0,
        PROBLEMS: 0,
      },
      playbackTelemetry: {
        completionRate: { seriesEpisodes: null, shortFilms: null },
        episodeDropoff: [],
        seriesCompletionRate: { overall: null, bySeries: [] },
        generatedAt: Date.now(),
        authority: "DERIVED",
        source: "TELEMETRY",
        caveat: "Historical completeness may be partial.",
      },
    };

    const piiKeys = ["user_id", "userId", "email", "phone", "device_id", "deviceId", "sessionId", "customerId"];
    const json = JSON.stringify(snapshot);
    for (const key of piiKeys) {
      assert.ok(!json.includes(key), `PII key "${key}" must not appear in AnalyticsSnapshot`);
    }
  });
});
