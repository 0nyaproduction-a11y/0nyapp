// @ts-expect-error node:test resolves at runtime via tsx; see authReturnIntent.test.ts.
import { test } from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";
import {
  clampPlaybackRate,
  clampPositionMs,
  classifyDrift,
  correctionRateForDrift,
  createPlayTogetherCommandId,
  DEFAULT_PLAY_TOGETHER_SYNC,
  estimateClockOffsetMs,
  expectedPositionMs,
  isNewerStateVersion,
  offsetSampleMs,
  parseStateServerTimeMs,
} from "./playTogetherSync";

const CONFIG = DEFAULT_PLAY_TOGETHER_SYNC;

test("clampPositionMs floors and clamps to duration", () => {
  assert.equal(clampPositionMs(12.9, 1000), 12);
  assert.equal(clampPositionMs(-3, null), 0);
  assert.equal(clampPositionMs(Number.NaN, 1000), 0);
  assert.equal(clampPositionMs(2000, 1000), 1000);
  assert.equal(clampPositionMs(2000, 0), 2000);
  assert.equal(clampPositionMs(500, 1000), 500);
});

test("parseStateServerTimeMs accepts ISO timestamps and rejects garbage", () => {
  assert.equal(parseStateServerTimeMs("2026-09-02T12:00:00.000Z"), Date.parse("2026-09-02T12:00:00.000Z"));
  assert.equal(parseStateServerTimeMs(null), null);
  assert.equal(parseStateServerTimeMs(undefined), null);
  assert.equal(parseStateServerTimeMs("not-a-date"), null);
});

test("offsetSampleMs is serverTime minus RTT midpoint", () => {
  assert.equal(offsetSampleMs({ requestStartMs: 100, requestEndMs: 200, serverTimeMs: 1000 }), 850);
  assert.equal(offsetSampleMs({ requestStartMs: 100, requestEndMs: 300, serverTimeMs: 1000 }), 800);
});

test("offsetSampleMs discards non-finite or wild samples", () => {
  assert.equal(offsetSampleMs({ requestStartMs: Number.NaN, requestEndMs: 200, serverTimeMs: 1000 }), null);
  assert.equal(offsetSampleMs({ requestStartMs: 100, requestEndMs: 200, serverTimeMs: null }), null);
  assert.equal(offsetSampleMs({ requestStartMs: 100, requestEndMs: 200, serverTimeMs: 1_000_000 }), null);
});

test("estimateClockOffsetMs returns rolling median bounded by the window", () => {
  assert.equal(estimateClockOffsetMs([]), 0);
  assert.equal(estimateClockOffsetMs([20, 100, 30]), 30);
  assert.equal(
    estimateClockOffsetMs([1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900], 8),
    1600,
  );
  assert.equal(estimateClockOffsetMs([Number.NaN, Number.NaN]), 0);
});

test("expectedPositionMs projects the host position along playback time", () => {
  const anchor = Date.parse("2026-09-02T12:00:00.000Z");
  const options = {
    durationMs: 600_000,
    hostPositionMs: 60_000,
    nowMs: anchor + 10_000,
    offsetMs: 0,
    playbackRate: 1,
    playbackState: "playing",
    stateServerTimeMs: anchor,
  };

  assert.equal(expectedPositionMs(options), 70_000);
});

test("expectedPositionMs never moves while paused or without an anchor", () => {
  const anchor = Date.parse("2026-09-02T12:00:00.000Z");
  const playing = {
    durationMs: null,
    hostPositionMs: 60_000,
    nowMs: anchor + 10_000,
    offsetMs: 0,
    playbackRate: 1,
    playbackState: "playing",
    stateServerTimeMs: anchor,
  };

  assert.equal(
    expectedPositionMs({ ...playing, playbackState: "paused" }),
    60_000,
    "paused rooms hold the anchored Host position",
  );
  assert.equal(expectedPositionMs({ ...playing, stateServerTimeMs: null }), 60_000);
  assert.equal(expectedPositionMs({ ...playing, nowMs: anchor - 5_000 }), 60_000, "future anchors clamp to zero elapsed");
});

test("expectedPositionMs clips to episode duration", () => {
  const anchor = Date.parse("2026-09-02T12:00:00.000Z");
  assert.equal(
    expectedPositionMs({
      durationMs: 60_000,
      hostPositionMs: 59_000,
      nowMs: anchor + 10_000,
      offsetMs: 0,
      playbackRate: 1,
      playbackState: "playing",
      stateServerTimeMs: anchor,
    }),
    60_000,
  );
});

test("classifyDrift applies the three-band policy", () => {
  assert.equal(classifyDrift(0, CONFIG), "ignore");
  assert.equal(classifyDrift(CONFIG.smallDriftIgnoredMs, CONFIG), "ignore");
  assert.equal(classifyDrift(CONFIG.smallDriftIgnoredMs + 1, CONFIG), "rate");
  assert.equal(classifyDrift(-CONFIG.smallDriftIgnoredMs - 1, CONFIG), "rate");
  assert.equal(classifyDrift(CONFIG.largeDriftCorrectionMs + 1, CONFIG), "seek");
  assert.equal(classifyDrift(-CONFIG.largeDriftCorrectionMs - 1, CONFIG), "seek");
});

test("correctionRateForDrift speeds up when behind and slows down when ahead", () => {
  const behind = correctionRateForDrift({ canonicalRate: 1, config: CONFIG, driftMs: 500 });
  assert.equal(behind.drift, "rate");
  assert.equal(behind.rate, 1 * CONFIG.rateMaxFactor);

  const ahead = correctionRateForDrift({ canonicalRate: 1, config: CONFIG, driftMs: -500 });
  assert.equal(ahead.drift, "rate");
  assert.equal(ahead.rate, 1 * CONFIG.rateMinFactor);

  const ignored = correctionRateForDrift({ canonicalRate: 1, config: CONFIG, driftMs: 100 });
  assert.equal(ignored.drift, "ignore");
  assert.equal(ignored.rate, 1);

  const seek = correctionRateForDrift({ canonicalRate: 1, config: CONFIG, driftMs: 5000 });
  assert.equal(seek.drift, "seek");
});

test("correctionRateForDrift clamps the factor road to playback-rate bounds", () => {
  const result = correctionRateForDrift({ canonicalRate: 1, config: CONFIG, driftMs: 500 });
  assert.ok(result.rate >= 0.5 && result.rate <= 2);
});

test("clampPlaybackRate bounds to the safe playback range", () => {
  assert.equal(clampPlaybackRate(0.97), 0.97);
  assert.equal(clampPlaybackRate(0.1), 0.5);
  assert.equal(clampPlaybackRate(3), 2);
  assert.equal(clampPlaybackRate(Number.NaN), 1);
});

test("isNewerStateVersion only accepts strict monotonic growth", () => {
  assert.equal(isNewerStateVersion(2, 1), true);
  assert.equal(isNewerStateVersion(2, 2), false);
  assert.equal(isNewerStateVersion(2, 3), false);
});

test("createPlayTogetherCommandId produces a backend-compatible commandId", () => {
  const id = createPlayTogetherCommandId();
  assert.match(id, /^[\x21-\x7e]{8,160}$/);
});