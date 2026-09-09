// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";
import {
  classifyVerticalSwipe,
  resolveSwipeTarget,
  SWIPE_DEADZONE_PX,
  SWIPE_MIN_DISTANCE_PX,
  SWIPE_MAX_HORIZONTAL_DRIFT_PX,
  SWIPE_MIN_VELOCITY,
} from "./swipeNavigation";
import type { SeriesEpisodePlaybackContext } from "./types";
import type { ApiEpisode } from "../types/api";

// --- test helpers ---

function makeSeriesContext(
  overrides: Partial<SeriesEpisodePlaybackContext> = {},
): SeriesEpisodePlaybackContext {
  return {
    type: "SERIES_EPISODE",
    seriesSlug: "test-series",
    seriesTitle: "Test Series",
    episodeNumber: 2,
    episodeTitle: "Episode 2",
    accessKind: "free",
    accessLabel: "Free",
    nextEpisode: undefined,
    hasLockedNextEpisode: false,
    hasUnreleasedNextEpisode: false,
    ...overrides,
  };
}

function makeEpisode(
  num: number,
  title: string = `Episode ${num}`,
): ApiEpisode {
  return {
    id: `ep-${num}`,
    number: num,
    title,
    description: "",
    runtime: "120",
    isFree: true,
    coinPrice: 0,
    coinUnlockEnabled: false,
    rewardedUnlockEnabled: false,
    rewardedAccessMode: "permanent",
    requiredRewardedCompletions: 0,
    plusAccess: false,
    lockedPreviewSeconds: 0,
    contentRatingOverride: null,
    contentDescriptorsOverride: [],
    contentRating: null,
    contentDescriptors: [],
    parentalLockRequired: false,
    ageVerificationRequired: false,
  };
}

// ─── classifyVerticalSwipe ─────────────────────────────────────────────

test("classifyVerticalSwipe: upward swipe of sufficient distance returns 'up'", () => {
  assert.equal(classifyVerticalSwipe(0, -SWIPE_MIN_DISTANCE_PX, 0), "up");
});

test("classifyVerticalSwipe: downward swipe of sufficient distance returns 'down'", () => {
  assert.equal(classifyVerticalSwipe(0, SWIPE_MIN_DISTANCE_PX, 0), "down");
});

test("classifyVerticalSwipe: small vertical movement is not a swipe", () => {
  assert.equal(classifyVerticalSwipe(0, -(SWIPE_DEADZONE_PX - 1), 0), null);
  assert.equal(classifyVerticalSwipe(0, SWIPE_DEADZONE_PX - 1, 0), null);
  assert.equal(classifyVerticalSwipe(0, -(SWIPE_DEADZONE_PX + 10), 0), null);
  assert.equal(classifyVerticalSwipe(0, SWIPE_DEADZONE_PX + 10, 0), null);
});

test("classifyVerticalSwipe: horizontal scrub drift is not a vertical swipe", () => {
    assert.equal(
    classifyVerticalSwipe(SWIPE_MAX_HORIZONTAL_DRIFT_PX + 1, -SWIPE_MIN_DISTANCE_PX, 0),
    null,
  );
});

test("classifyVerticalSwipe: fast short swipe passes via velocity", () => {
  assert.equal(classifyVerticalSwipe(0, -30, SWIPE_MIN_VELOCITY + 0.1), "up");
  assert.equal(classifyVerticalSwipe(0, 30, SWIPE_MIN_VELOCITY + 0.1), "down");
});

test("classifyVerticalSwipe: fast short swipe below deadzone does not pass", () => {
  assert.equal(classifyVerticalSwipe(0, -5, 10), null);
  assert.equal(classifyVerticalSwipe(0, 5, 10), null);
});

test("classifyVerticalSwipe: zero movement is not a swipe", () => {
  assert.equal(classifyVerticalSwipe(0, 0, 0), null);
});

test("classifyVerticalSwipe: diagonal with vertical dominance passes", () => {
  assert.equal(classifyVerticalSwipe(20, -70, 0), "up");
  assert.equal(classifyVerticalSwipe(20, 70, 0), "down");
});

test("classifyVerticalSwipe: diagonal with horizontal dominance fails", () => {
  assert.equal(classifyVerticalSwipe(70, -20, 0), null);
  assert.equal(classifyVerticalSwipe(70, 20, 0), null);
});

// ─── resolveSwipeTarget ────────────────────────────────────────────────

test("resolveSwipeTarget: series context with next episode → up resolves next", () => {
  const ctx = makeSeriesContext({
    episodeNumber: 2,
    nextEpisode: {
      episodeNumber: 3,
      episodeTitle: "Ep 3",
      accessKind: "free",
      accessLabel: "Free",
    },
  });
  const result = resolveSwipeTarget(ctx, [], "up");
  assert.deepEqual(result, { episodeNumber: 3, direction: "next" });
});

test("resolveSwipeTarget: SWIPE DOWN from episode 3 resolves episode 2", () => {
  const ctx = makeSeriesContext({ episodeNumber: 3 });
  const episodes = [makeEpisode(1), makeEpisode(2), makeEpisode(3)];
  const result = resolveSwipeTarget(ctx, episodes, "down");
  assert.deepEqual(result, { episodeNumber: 2, direction: "previous" });
});

test("resolveSwipeTarget: first episode → swipe down is null", () => {
  const ctx = makeSeriesContext({ episodeNumber: 1 });
  const result = resolveSwipeTarget(ctx, [makeEpisode(1)], "down");
  assert.equal(result, null);
});

test("resolveSwipeTarget: final episode (no nextEpisode) → swipe up is null", () => {
  const ctx = makeSeriesContext({ episodeNumber: 5 });
  const result = resolveSwipeTarget(ctx, [makeEpisode(5)], "up");
  assert.equal(result, null);
});

test("resolveSwipeTarget: locked next episode still resolves (access path handles it)", () => {
  const ctx = makeSeriesContext({
    episodeNumber: 2,
    nextEpisode: {
      episodeNumber: 3,
      episodeTitle: "Ep 3",
      accessKind: "locked",
      accessLabel: "Locked",
    },
    hasLockedNextEpisode: true,
  });
  const result = resolveSwipeTarget(ctx, [makeEpisode(2), makeEpisode(3)], "up");
  assert.deepEqual(result, { episodeNumber: 3, direction: "next" });
});

test("resolveSwipeTarget: previous episode not in array → null (unreleased)", () => {
  const ctx = makeSeriesContext({ episodeNumber: 3 });
  const episodes = [makeEpisode(3)];
  const result = resolveSwipeTarget(ctx, episodes, "down");
  assert.equal(result, null);
});

test("resolveSwipeTarget: short film context → null", () => {
  const ctx = {
    type: "SHORT_FILM" as const,
    filmSlug: "sf-1",
    title: "Test Film",
  };
  assert.equal(resolveSwipeTarget(ctx, [], "up"), null);
  assert.equal(resolveSwipeTarget(ctx, [], "down"), null);
});

test("resolveSwipeTarget: up and down resolve to different numbers for episode 2", () => {
  const ctx = makeSeriesContext({
    episodeNumber: 2,
    nextEpisode: {
      episodeNumber: 3,
      episodeTitle: "Ep 3",
      accessKind: "free",
      accessLabel: "Free",
    },
  });
  const episodes = [makeEpisode(1), makeEpisode(2), makeEpisode(3)];
  assert.deepEqual(resolveSwipeTarget(ctx, episodes, "up"), {
    episodeNumber: 3,
    direction: "next",
  });
  assert.deepEqual(resolveSwipeTarget(ctx, episodes, "down"), {
    episodeNumber: 1,
    direction: "previous",
  });
});

test("resolveSwipeTarget: does not skip N+1 when N+1 is locked — returns N+1", () => {
  const ctx = makeSeriesContext({
    episodeNumber: 2,
    nextEpisode: {
      episodeNumber: 3,
      episodeTitle: "Ep 3",
      accessKind: "locked",
      accessLabel: "Locked",
    },
  });
  const episodes = [makeEpisode(1), makeEpisode(2), makeEpisode(3), makeEpisode(4)];
  const result = resolveSwipeTarget(ctx, episodes, "up");
  assert.equal(result?.episodeNumber, 3);
  assert.equal(result?.direction, "next");
});
