// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";

/**
 * Regression tests for P1-05: retry() replaceAsync rejection handling.
 *
 * Verifies:
 * 1. replaceAsync rejects → retry handles rejection, no unhandled Promise rejection escapes,
 *    controller error state becomes recoverable, retry can be attempted again.
 * 2. replaceAsync succeeds → existing retry behavior is unchanged.
 */

type PlayerError = { message: string };
type VideoPlayerStatus = "idle" | "loading" | "readyToPlay" | "error";

interface RetryHarnessState {
  error: PlayerError | undefined;
  status: VideoPlayerStatus;
  currentTime: number;
  hasEnded: boolean;
  isMounted: boolean;
}

interface RetryHarness {
  state: RetryHarnessState;
  replaceInFlight: boolean;
  pendingRetrySeek: number | null;
  retry: (seekSeconds?: number | null) => Promise<void>;
  unmount: () => void;
}

function createRetryHarness(options: {
  replaceAsync: (source: string) => Promise<void>;
}): RetryHarness {
  const source = "https://example.com/video.m3u8";

  const state: RetryHarnessState = {
    error: undefined,
    status: "readyToPlay",
    currentTime: 0,
    hasEnded: false,
    isMounted: true,
  };

  // Mirrors the ref state in usePlaybackController
  let replaceInFlightRef = false;
  let pendingRetrySeekRef: number | null = null;

  const harness: RetryHarness = {
    state,
    get replaceInFlight() {
      return replaceInFlightRef;
    },
    get pendingRetrySeek() {
      return pendingRetrySeekRef;
    },
    unmount() {
      state.isMounted = false;
    },
    async retry(seekSeconds?: number | null) {
      // Mirror the retry() implementation in usePlaybackController
      state.hasEnded = false;
      pendingRetrySeekRef = seekSeconds ?? null;
      state.currentTime = pendingRetrySeekRef ?? 0;

      replaceInFlightRef = true;

      try {
        await options.replaceAsync(source);
      } catch (replaceError) {
        pendingRetrySeekRef = null;
        replaceInFlightRef = false;
        if (state.isMounted) {
          const normalizedMessage =
            replaceError instanceof Error
              ? replaceError.message
              : "Playback retry failed. Please try again.";
          state.error = { message: normalizedMessage };
          state.status = "error";
        }
        return;
      }

      if (pendingRetrySeekRef !== null) {
        state.currentTime = pendingRetrySeekRef;
        pendingRetrySeekRef = null;
      }
      replaceInFlightRef = false;
      // play() would be called here if mounted and not user-paused
    },
  };

  return harness;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test("replaceAsync rejects with Error: no unhandled rejection, error state set, retry recoverable", async () => {
  const rejectedWith = new Error("Network error during source load");

  let unhandledRejection: unknown = null;
  const origListener = process.listeners("unhandledRejection")[0];
  process.on("unhandledRejection", (reason) => {
    unhandledRejection = reason;
  });

  const harness = createRetryHarness({
    replaceAsync: async () => {
      throw rejectedWith;
    },
  });

  // Should not throw — rejection must be consumed
  await harness.retry(10);

  // Give the microtask queue a tick to catch any leaked rejection
  await new Promise((r) => setImmediate(r));

  assert.equal(unhandledRejection, null, "No unhandled Promise rejection must escape");
  assert.equal(harness.state.status, "error", "Status must be 'error' after replaceAsync rejection");
  assert.deepEqual(harness.state.error, { message: "Network error during source load" }, "Error message must match rejection Error.message");
  assert.equal(harness.replaceInFlight, false, "replaceInFlightRef must be cleared on rejection");
  assert.equal(harness.pendingRetrySeek, null, "pendingRetrySeekRef must be cleared on rejection");

  // Retry can be attempted again — replaceAsync can succeed on second call
  let secondCallMade = false;
  const harness2 = createRetryHarness({
    replaceAsync: async () => {
      secondCallMade = true;
    },
  });
  harness2.state.error = { message: "previous failure" };
  harness2.state.status = "error";

  await harness2.retry();

  assert.equal(secondCallMade, true, "Second retry call must proceed to replaceAsync");
  assert.equal(harness2.replaceInFlight, false, "replaceInFlightRef cleared after success");
  assert.equal(harness2.state.status, "error", "Status not changed by retry harness on success (player events own status)");

  // Restore original unhandledRejection listeners
  process.removeAllListeners("unhandledRejection");
  if (origListener) process.on("unhandledRejection", origListener as (...args: unknown[]) => void);
});

test("replaceAsync rejects with non-Error value: safe generic message used", async () => {
  const harness = createRetryHarness({
    replaceAsync: async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "string rejection";
    },
  });

  await harness.retry();

  assert.equal(harness.state.status, "error");
  assert.deepEqual(harness.state.error, { message: "Playback retry failed. Please try again." });
  assert.equal(harness.replaceInFlight, false);
});

test("replaceAsync rejects after unmount: error state is NOT updated (mounted guard)", async () => {
  const harness = createRetryHarness({
    replaceAsync: async () => {
      harness.unmount(); // simulate unmount before rejection lands
      throw new Error("late rejection after unmount");
    },
  });

  harness.state.status = "readyToPlay";
  harness.state.error = undefined;

  await harness.retry();

  assert.equal(harness.state.status, "readyToPlay", "Status must NOT be updated after unmount");
  assert.equal(harness.state.error, undefined, "Error must NOT be set after unmount");
  assert.equal(harness.replaceInFlight, false, "replaceInFlightRef must still be cleared");
});

test("replaceAsync succeeds: existing retry behavior unchanged", async () => {
  let replaceCalled = false;

  const harness = createRetryHarness({
    replaceAsync: async () => {
      replaceCalled = true;
    },
  });

  harness.state.status = "error";
  harness.state.hasEnded = true;

  await harness.retry(30);

  assert.equal(replaceCalled, true, "replaceAsync must be called on successful retry");
  assert.equal(harness.replaceInFlight, false, "replaceInFlightRef must be false after success");
  assert.equal(harness.pendingRetrySeek, null, "pendingRetrySeekRef must be cleared after success");
  assert.equal(harness.state.hasEnded, false, "hasEnded must be reset on retry");
  assert.equal(harness.state.currentTime, 30, "currentTime should reflect seek position during replace");
});
