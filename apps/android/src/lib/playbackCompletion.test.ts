import test from "node:test";
import assert from "node:assert/strict";
import { isContinueWatchingProgress, isPlaybackCompleted } from "./playbackCompletion";
import { isQualifyingProgress } from "./seriesPlayback";
import type { WatchProgressItem } from "../types/api";

test("completion uses 95 percent OR the final five seconds, including exact boundaries", () => {
  for (const [durationSeconds, positionSeconds, expected] of [
    [200, 189, false], [200, 190, true], [200, 195, true], [200, 250, true],
    [60, 54, false], [60, 55, true], [60, 57, true], [4, 0, false], [4, 1, true],
    [0, 55, false], [NaN, 55, false], [60, NaN, false], [60, -1, false],
  ] as const) {
    assert.equal(isPlaybackCompleted({ durationSeconds, positionSeconds }), expected, `${durationSeconds}@${positionSeconds}`);
  }
});

test("server completion and authoritative duration override are preserved", () => {
  assert.equal(isPlaybackCompleted({ completed: true, durationSeconds: 0, positionSeconds: 0 }), true);
  assert.equal(isPlaybackCompleted({ durationSeconds: 300, positionSeconds: 190 }, 200), true);
});

test("production Continue Watching qualification uses the canonical completion predicate", () => {
  const item = { completed: false, contentType: "series_episode", durationSeconds: 200, positionSeconds: 190 } as WatchProgressItem;
  assert.equal(isContinueWatchingProgress(item), false);
  assert.equal(isQualifyingProgress(item), false);
  assert.equal(isQualifyingProgress({ ...item, positionSeconds: 180 }), true);
  assert.equal(isQualifyingProgress({ ...item, positionSeconds: 4 }), false);
});
