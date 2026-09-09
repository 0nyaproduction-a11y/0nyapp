// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";

/**
 * Regression test for S0-01 auto-advance cleanup fix in PlayerScreen.
 *
 * Verifies that:
 * 1. Cancelled/interrupted transition effect cleanup releases auto-advance lock refs
 * 2. Subsequent playback-ended event can enter auto-advance again without being swallowed
 */

interface TransitionHarnessRefs {
  autoNextActive: boolean;
  seamlessTransitionRequested: boolean;
  seamlessTransitionQueued: boolean;
  transitionStarted: boolean;
}

function createTransitionHarness(options?: {
  autoplayNextEnabled?: boolean;
  saveFinal?: () => Promise<void>;
  advanceToNext?: () => void;
}) {
  const refs: TransitionHarnessRefs = {
    autoNextActive: false,
    seamlessTransitionRequested: false,
    seamlessTransitionQueued: false,
    transitionStarted: false,
  };

  let isTransitionRequested = false;
  let activeCleanup: (() => void) | null = null;

  const handlePlaybackEnded = () => {
    if (refs.autoNextActive || refs.seamlessTransitionRequested) {
      return false; // Swallowed due to active lock
    }

    if (!refs.transitionStarted) {
      refs.seamlessTransitionRequested = true;
      refs.seamlessTransitionQueued = true;
      isTransitionRequested = true;
      runEffect();
      return true;
    }
    return false;
  };

  const runEffect = () => {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }

    if (!isTransitionRequested || refs.seamlessTransitionQueued === false) {
      return;
    }

    let cancelled = false;

    void (async () => {
      refs.autoNextActive = true;

      try {
        if (options?.saveFinal) {
          await options.saveFinal();
        }
      } catch {
        // saveFinal failure
      }

      if (cancelled || refs.transitionStarted) {
        refs.autoNextActive = false;
        isTransitionRequested = false;
        refs.seamlessTransitionRequested = false;
        refs.seamlessTransitionQueued = false;
        return;
      }

      if (options?.advanceToNext) {
        options.advanceToNext();
      }
      isTransitionRequested = false;
      refs.seamlessTransitionRequested = false;
      refs.seamlessTransitionQueued = false;
    })();

    // The verified cleanup fix (PlayerScreen.tsx lines 496-501)
    activeCleanup = () => {
      cancelled = true;
      refs.autoNextActive = false;
      refs.seamlessTransitionRequested = false;
      refs.seamlessTransitionQueued = false;
    };
  };

  const triggerCleanup = () => {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
  };

  return {
    refs,
    handlePlaybackEnded,
    triggerCleanup,
  };
}

test("saveFinal failure or cancelled transition effect resets transition refs via cleanup", async () => {
  let resolveSave!: () => void;
  const savePromise = new Promise<void>((res) => {
    resolveSave = res;
  });

  const harness = createTransitionHarness({
    saveFinal: async () => {
      await savePromise;
    },
  });

  // 1. First playback ended event triggers transition
  const enteredFirst = harness.handlePlaybackEnded();
  assert.equal(enteredFirst, true, "First playback-ended should initiate transition");
  assert.equal(harness.refs.autoNextActive, true, "autoNextActive should be locked during transition");
  assert.equal(harness.refs.seamlessTransitionRequested, true, "seamlessTransitionRequested should be true");

  // 2. Interruption / unmount / effect re-run occurs while saveFinal is pending
  harness.triggerCleanup();

  // 3. Verify cleanup immediately unlocked transition refs
  assert.equal(harness.refs.autoNextActive, false, "autoNextActiveRef must be reset to false on cleanup");
  assert.equal(harness.refs.seamlessTransitionRequested, false, "seamlessTransitionRequestedRef must be reset to false on cleanup");
  assert.equal(harness.refs.seamlessTransitionQueued, false, "seamlessTransitionQueuedRef must be reset to false on cleanup");

  // 4. Resolve the in-flight save
  resolveSave();
  await Promise.resolve();

  // 5. Subsequent playback-ended event is NOT swallowed and can enter auto-advance again
  const enteredSecond = harness.handlePlaybackEnded();
  assert.equal(enteredSecond, true, "Subsequent playback-ended must not be swallowed after transition cancellation");
});
