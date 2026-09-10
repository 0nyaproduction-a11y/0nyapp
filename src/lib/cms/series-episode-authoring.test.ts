import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Series & Episode Authoring — pure-logic unit coverage.
 *
 * These tests exercise the framework-independent helpers that back the
 * Series/Episode CMS authoring flows: bulk-episode input building,
 * access-summary rendering, and rewarded-completion clamping.
 *
 * Modules that carry a top-level `import "server-only"` side-effect
 * (lib/cms/series, lib/cms/episodes, lib/cms/series-form, lib/cms/episode-form)
 * cannot be imported from this Node test runner, so their validation and
 * FormData-parsing functions are covered indirectly through integration
 * tests that run against a configured Supabase instance (see
 * media-attachment.test.ts for the skip-when-unconfigured pattern). The pure
 * functions below never touch the network and always run.
 */

import { buildEpisodeInputForBulkCreate } from "@/lib/cms/bulk-episodes";
import {
  buildAccessSummary,
  clampRewardedRequiredCompletions,
  type EpisodeRow,
} from "@/lib/cms/constants";

function episodeRow(overrides: Partial<EpisodeRow> = {}): EpisodeRow {
  return {
    id: "episode-id",
    series_id: "series-id",
    episode_number: 1,
    title: "Episode 1",
    synopsis: null,
    duration_seconds: 600,
    thumbnail_url: null,
    video_asset_id: null,
    media_asset_id: null,
    preview_media_asset_id: null,
    is_free: false,
    coin_price: 10,
    coin_unlock_enabled: true,
    rewarded_unlock_enabled: false,
    rewarded_access_mode: "permanent",
    required_rewarded_completions: 1,
    plus_access: false,
    locked_preview_seconds: 0,
    content_rating_override: null,
    content_descriptors_override: [],
    status: "draft",
    published_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

test("buildEpisodeInputForBulkCreate maps defaults and truncates duration", () => {
  const input = buildEpisodeInputForBulkCreate({
    episodeNumber: 5,
    title: "  Bulk Episode  ",
    durationSeconds: 120.9,
    defaults: {
      isFree: false,
      coinUnlockEnabled: true,
      coinPrice: 20,
      rewardedUnlockEnabled: false,
      rewardedAccessMode: "permanent",
      requiredRewardedCompletions: 1,
      plusAccess: true,
      lockedPreviewSeconds: 2,
      contentRatingOverride: null,
      contentDescriptorsOverride: [],
    },
  });

  assert.equal(input.episodeNumber, 5);
  assert.equal(input.title, "Bulk Episode");
  assert.equal(input.durationSeconds, 120);
  assert.equal(input.thumbnailUrl, null);
  assert.equal(input.coinPrice, 20);
  assert.equal(input.plusAccess, true);
  assert.equal(input.lockedPreviewSeconds, 2);
});

test("buildEpisodeInputForBulkCreate nulls blank titles", () => {
  const input = buildEpisodeInputForBulkCreate({
    episodeNumber: 2,
    title: "   ",
    durationSeconds: 60,
    defaults: {
      isFree: true,
      coinUnlockEnabled: false,
      coinPrice: 0,
      rewardedUnlockEnabled: false,
      rewardedAccessMode: "permanent",
      requiredRewardedCompletions: 1,
      plusAccess: false,
      lockedPreviewSeconds: 0,
      contentRatingOverride: null,
      contentDescriptorsOverride: [],
    },
  });

  assert.equal(input.title, null);
  assert.equal(input.isFree, true);
});

test("buildEpisodeInputForBulkCreate floors negative duration to zero", () => {
  const input = buildEpisodeInputForBulkCreate({
    episodeNumber: 1,
    title: "Episode",
    durationSeconds: -5,
    defaults: {
      isFree: true,
      coinUnlockEnabled: false,
      coinPrice: 0,
      rewardedUnlockEnabled: false,
      rewardedAccessMode: "permanent",
      requiredRewardedCompletions: 1,
      plusAccess: false,
      lockedPreviewSeconds: 0,
      contentRatingOverride: null,
      contentDescriptorsOverride: [],
    },
  });

  assert.equal(input.durationSeconds, 0);
});

test("buildAccessSummary reflects all enabled access methods", () => {
  // is_free alone (base row has coin_unlock_enabled: true) -> Free + coin price.
  const freeWithCoin = buildAccessSummary(episodeRow({ is_free: true }));
  assert.equal(freeWithCoin, "Free · 10 coins");

  // Free with no other methods enabled.
  assert.equal(
    buildAccessSummary(episodeRow({ is_free: true, coin_unlock_enabled: false })),
    "Free",
  );

  const coinOnly = buildAccessSummary(
    episodeRow({ is_free: false, coin_unlock_enabled: true, coin_price: 15 }),
  );
  assert.equal(coinOnly, "15 coins");

  const multi = buildAccessSummary(
    episodeRow({
      is_free: false,
      coin_unlock_enabled: true,
      coin_price: 10,
      rewarded_unlock_enabled: true,
      plus_access: true,
    }),
  );
  assert.equal(multi, "10 coins · Rewarded · Plus");

  const none = buildAccessSummary(
    episodeRow({ is_free: false, coin_unlock_enabled: false }),
  );
  assert.equal(none, "Not configured");
});

test("buildAccessSummary does not leak episode title or number", () => {
  const summary = buildAccessSummary(
    episodeRow({ is_free: false, coin_unlock_enabled: false }),
  );
  assert.ok(!summary.includes("Episode"));
});

test("clampRewardedRequiredCompletions enforces launch bounds", () => {
  assert.equal(clampRewardedRequiredCompletions(0), 1);
  assert.equal(clampRewardedRequiredCompletions(1), 1);
  assert.equal(clampRewardedRequiredCompletions(2), 2);
  assert.equal(clampRewardedRequiredCompletions(5), 2);
  assert.equal(clampRewardedRequiredCompletions(1.7), 1);
});

test("clampRewardedRequiredCompletions handles edge values", () => {
  assert.equal(clampRewardedRequiredCompletions(-100), 1);
  assert.equal(clampRewardedRequiredCompletions(Infinity), 1);
});
