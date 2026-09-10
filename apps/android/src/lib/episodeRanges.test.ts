import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEpisodeRanges,
  getActiveEpisodeRange,
  getEpisodesInRange,
  getInitialEpisodeRangeStart,
  getRangeStartForEpisode,
  EPISODE_RANGE_SIZE,
} from "./episodeRanges";
import type { ApiEpisode } from "../types/api";

function createMockEpisodes(count: number): ApiEpisode[] {
  return Array.from({ length: count }, (_, i) => ({
    ageVerificationRequired: false,
    coinPrice: 10,
    coinUnlockEnabled: true,
    contentDescriptors: [],
    contentDescriptorsOverride: [],
    contentRating: null,
    contentRatingOverride: null,
    description: `Episode ${i + 1}`,
    id: `ep-${i + 1}`,
    isFree: i < 3,
    lockedPreviewSeconds: 5,
    number: i + 1,
    parentalLockRequired: false,
    plusAccess: false,
    requiredRewardedCompletions: 1,
    rewardedAccessMode: "permanent",
    rewardedUnlockEnabled: false,
    runtime: "2:00",
    title: `Episode ${i + 1}`,
  }));
}

test("EPISODE_RANGE_SIZE is locked at 20", () => {
  assert.equal(EPISODE_RANGE_SIZE, 20);
});

test("buildEpisodeRanges: 12 episodes -> one range (1-20)", () => {
  const episodes = createMockEpisodes(12);
  const ranges = buildEpisodeRanges(episodes);
  assert.equal(ranges.length, 1);
  assert.deepEqual(ranges[0], { start: 1, end: 20 });
});

test("buildEpisodeRanges: 20 episodes -> one range (1-20)", () => {
  const episodes = createMockEpisodes(20);
  const ranges = buildEpisodeRanges(episodes);
  assert.equal(ranges.length, 1);
  assert.deepEqual(ranges[0], { start: 1, end: 20 });
});

test("buildEpisodeRanges: 21 episodes -> two ranges (1-20, 21-40)", () => {
  const episodes = createMockEpisodes(21);
  const ranges = buildEpisodeRanges(episodes);
  assert.equal(ranges.length, 2);
  assert.deepEqual(ranges[0], { start: 1, end: 20 });
  assert.deepEqual(ranges[1], { start: 21, end: 40 });
});

test("buildEpisodeRanges: 200 episodes -> ten ranges", () => {
  const episodes = createMockEpisodes(200);
  const ranges = buildEpisodeRanges(episodes);
  assert.equal(ranges.length, 10);
  assert.deepEqual(ranges[0], { start: 1, end: 20 });
  assert.deepEqual(ranges[9], { start: 181, end: 200 });
});

test("buildEpisodeRanges: 300 episodes -> fifteen ranges", () => {
  const episodes = createMockEpisodes(300);
  const ranges = buildEpisodeRanges(episodes);
  assert.equal(ranges.length, 15);
  assert.deepEqual(ranges[0], { start: 1, end: 20 });
  assert.deepEqual(ranges[14], { start: 281, end: 300 });
});

test("getActiveEpisodeRange: Ep1 active range = 1-20", () => {
  const episodes = createMockEpisodes(300);
  const ranges = buildEpisodeRanges(episodes);
  const active = getActiveEpisodeRange(ranges, 1);
  assert.deepEqual(active, { start: 1, end: 20 });
});

test("getActiveEpisodeRange: Ep20 active range = 1-20", () => {
  const episodes = createMockEpisodes(300);
  const ranges = buildEpisodeRanges(episodes);
  const active = getActiveEpisodeRange(ranges, 20);
  assert.deepEqual(active, { start: 1, end: 20 });
});

test("getActiveEpisodeRange: Ep21 active range = 21-40", () => {
  const episodes = createMockEpisodes(300);
  const ranges = buildEpisodeRanges(episodes);
  const active = getActiveEpisodeRange(ranges, 21);
  assert.deepEqual(active, { start: 21, end: 40 });
});

test("getActiveEpisodeRange: Ep37 active range = 21-40", () => {
  const episodes = createMockEpisodes(300);
  const ranges = buildEpisodeRanges(episodes);
  const active = getActiveEpisodeRange(ranges, 37);
  assert.deepEqual(active, { start: 21, end: 40 });
});

test("getActiveEpisodeRange: Ep100 active range = 81-100", () => {
  const episodes = createMockEpisodes(300);
  const ranges = buildEpisodeRanges(episodes);
  const active = getActiveEpisodeRange(ranges, 100);
  assert.deepEqual(active, { start: 81, end: 100 });
});

test("getActiveEpisodeRange: Ep221 active range = 221-240", () => {
  const episodes = createMockEpisodes(300);
  const ranges = buildEpisodeRanges(episodes);
  const active = getActiveEpisodeRange(ranges, 221);
  assert.deepEqual(active, { start: 221, end: 240 });
});

test("getActiveEpisodeRange: Ep300 active range = 281-300", () => {
  const episodes = createMockEpisodes(300);
  const ranges = buildEpisodeRanges(episodes);
  const active = getActiveEpisodeRange(ranges, 300);
  assert.deepEqual(active, { start: 281, end: 300 });
});

test("getActiveEpisodeRange: user selectedRangeStart overrides preferred episode number", () => {
  const episodes = createMockEpisodes(300);
  const ranges = buildEpisodeRanges(episodes);
  // User is playing Ep5 (in 1-20), but has tapped range 41-60
  const active = getActiveEpisodeRange(ranges, 5, 41);
  assert.deepEqual(active, { start: 41, end: 60 });
});

test("getEpisodesInRange: extracts only episodes in active range", () => {
  const episodes = createMockEpisodes(50);
  const range = { start: 21, end: 40 };
  const visible = getEpisodesInRange(episodes, range);
  assert.equal(visible.length, 20);
  assert.equal(visible[0].number, 21);
  assert.equal(visible[19].number, 40);
});

test("getEpisodesInRange: bounded for 12-episode series", () => {
  const episodes = createMockEpisodes(12);
  const range = { start: 1, end: 20 };
  const visible = getEpisodesInRange(episodes, range);
  assert.equal(visible.length, 12);
  assert.equal(visible[0].number, 1);
  assert.equal(visible[11].number, 12);
});

test("getRangeStartForEpisode math check", () => {
  assert.equal(getRangeStartForEpisode(1, 20), 1);
  assert.equal(getRangeStartForEpisode(20, 20), 1);
  assert.equal(getRangeStartForEpisode(21, 20), 21);
  assert.equal(getRangeStartForEpisode(40, 20), 21);
  assert.equal(getRangeStartForEpisode(41, 20), 41);
  assert.equal(getRangeStartForEpisode(281, 20), 281);
  assert.equal(getRangeStartForEpisode(300, 20), 281);
});

test("getActiveEpisodeRange: Ep137 active range = 121-140", () => {
  const episodes = createMockEpisodes(300);
  const ranges = buildEpisodeRanges(episodes);
  const active = getActiveEpisodeRange(ranges, 137);
  assert.deepEqual(active, { start: 121, end: 140 });
});

test("range selector hidden for series <= 20 episodes (ranges.length <= 1)", () => {
  const episodes12 = createMockEpisodes(12);
  const ranges12 = buildEpisodeRanges(episodes12);
  assert.equal(ranges12.length, 1);
  assert.equal(ranges12.length <= 1, true);

  const episodes20 = createMockEpisodes(20);
  const ranges20 = buildEpisodeRanges(episodes20);
  assert.equal(ranges20.length, 1);
  assert.equal(ranges20.length <= 1, true);

  const episodes21 = createMockEpisodes(21);
  const ranges21 = buildEpisodeRanges(episodes21);
  assert.equal(ranges21.length, 2);
  assert.equal(ranges21.length <= 1, false);
});