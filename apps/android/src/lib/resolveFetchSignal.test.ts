// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";
import { resolveFetchSignal } from "./resolveFetchSignal";

// ---------------------------------------------------------------------------
// Unit tests for resolveFetchSignal — the pure timeout/abort merging logic.
// This module has no react-native dependency, so it runs under the Node test
// harness without needing the Metro/Expo transformer.
// ---------------------------------------------------------------------------

test("no timeout configured returns caller signal unchanged", () => {
  const caller = new AbortController();
  const { signal, cleanup } = resolveFetchSignal(caller.signal, undefined);

  assert.equal(signal, caller.signal, "Without timeout, the caller signal is passed through");
  assert.equal(signal?.aborted, false);
  cleanup();
  caller.abort();
});

test("no timeout configured returns a no-op cleanup", () => {
  const { signal, cleanup } = resolveFetchSignal(undefined, undefined);

  assert.equal(signal, undefined, "No caller signal and no timeout → undefined signal");
  // Must not throw.
  cleanup();
});

test("timeout of 0 or negative is treated as no timeout", () => {
  const caller = new AbortController();
  const { signal: signalA, cleanup: cleanupA } = resolveFetchSignal(caller.signal, 0);
  assert.equal(signalA, caller.signal);
  cleanupA();

  const { signal: signalB, cleanup: cleanupB } = resolveFetchSignal(caller.signal, -1);
  assert.equal(signalB, caller.signal);
  cleanupB();
});

test("timeout aborts the merged signal after the specified duration", async () => {
  const caller = new AbortController();
  const { signal, cleanup } = resolveFetchSignal(caller.signal, 30);

  assert.notEqual(signal, caller.signal, "With timeout, a new merged signal is created");
  assert.equal(signal?.aborted, false, "Signal should not be aborted immediately");

  await new Promise<void>((resolve) => {
    signal!.addEventListener("abort", () => resolve(), { once: true });
  });

  assert.equal(signal?.aborted, true, "Signal should be aborted after timeout");
  // Caller signal must NOT be aborted — timeout is internal.
  assert.equal(caller.signal.aborted, false, "Caller signal must remain unaborted after timeout");
  cleanup();
});

test("caller abort propagates to the merged signal", async () => {
  const caller = new AbortController();
  const { signal, cleanup } = resolveFetchSignal(caller.signal, 5000);

  assert.equal(signal?.aborted, false);

  const abortPromise = new Promise<void>((resolve) => {
    signal!.addEventListener("abort", () => resolve(), { once: true });
  });

  caller.abort();
  await abortPromise;

  assert.equal(signal?.aborted, true, "Merged signal should abort when caller aborts");
  assert.equal(caller.signal.aborted, true);
  cleanup();
});

test("already-aborted caller produces an already-aborted merged signal", () => {
  const caller = new AbortController();
  caller.abort();

  const { signal, cleanup } = resolveFetchSignal(caller.signal, 5000);
  assert.equal(signal?.aborted, true, "Merged signal should be aborted immediately");
  cleanup();
});


test("cleanup clears the timeout so it does not fire after success", async () => {
  const caller = new AbortController();
  const { signal, cleanup } = resolveFetchSignal(caller.signal, 20);

  // Cleanup immediately (simulating a successful fetch).
  cleanup();

  // Wait longer than the original timeout.
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(signal?.aborted, false, "Timeout should not fire after cleanup");
  assert.equal(caller.signal.aborted, false);
});

test("cleanup removes the caller abort listener", () => {
  const caller = new AbortController();
  const { signal, cleanup } = resolveFetchSignal(caller.signal, 5000);

  cleanup();

  // After cleanup, aborting the caller should NOT abort the merged signal
  // (the listener was removed).
  caller.abort();
  assert.equal(signal?.aborted, false, "Merged signal should not react to caller abort after cleanup");
});

test("no timeout and no caller signal returns undefined signal", () => {
  const { signal, cleanup } = resolveFetchSignal(undefined, undefined);
  assert.equal(signal, undefined);
  cleanup();
});

// ---------------------------------------------------------------------------
// Integration-style tests: verify the timeout mechanism works with a mocked
// fetch that simulates a hung request. This mirrors the exact failure path
// described in H2: a stalled /api/v1/playback call must terminate
// deterministically instead of hanging forever.
// ---------------------------------------------------------------------------

test("H2: hung fetch is terminated by timeout and produces AbortError", async () => {
  const originalFetch = globalThis.fetch;
  // A hung request that rejects when the supplied signal aborts.
  (globalThis.fetch as unknown) = (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const rejectForAbort = () => reject(new DOMException("Aborted", "AbortError"));
      if (init.signal?.aborted) {
        rejectForAbort();
      } else {
        init.signal?.addEventListener("abort", rejectForAbort, { once: true });
      }
    });

  const caller = new AbortController();
  const { signal, cleanup } = resolveFetchSignal(caller.signal, 25);

  const fetchPromise = globalThis.fetch("https://example.com/api/v1/playback", {
    method: "POST",
    signal: signal!,
  });

  const result = await Promise.race([
    fetchPromise.then(
      () => ({ kind: "resolved" as const }),
      (err: unknown) => ({ kind: "rejected" as const, err }),
    ),
    new Promise<{ kind: "timeout" }>((resolve) =>
      setTimeout(() => resolve({ kind: "timeout" }), 100),
    ),
  ]);

  cleanup();
  globalThis.fetch = originalFetch;

  assert.equal(result.kind, "rejected", "Hung fetch should be rejected by timeout");
  if (result.kind === "rejected") {
    assert.ok(result.err instanceof DOMException, "Rejection should be a DOMException (AbortError)");
    assert.equal(result.err.name, "AbortError", "Error name should be AbortError");
  }
});

test("H2: timeout does not create duplicate fetch requests", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  (globalThis.fetch as unknown) = (_url: string, init: RequestInit) => {
    fetchCallCount += 1;
    // Return a fetch that respects the signal.
    return new Promise<Response>((_resolve, reject) => {
      if (init.signal) {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }
    });
  };

  const caller = new AbortController();
  const { signal, cleanup } = resolveFetchSignal(caller.signal, 20);

  const fetchPromise = globalThis.fetch("https://example.com/api/v1/playback", {
    method: "POST",
    signal: signal!,
  }).catch(() => {});

  // Wait for the timeout to fire.
  await new Promise((r) => setTimeout(r, 50));

  cleanup();
  globalThis.fetch = originalFetch;

  assert.equal(fetchCallCount, 1, "Exactly one fetch call should be made — no duplicates");
  await fetchPromise;
});

test("H2: caller abort (not timeout) still aborts the fetch", async () => {
  const originalFetch = globalThis.fetch;
  (globalThis.fetch as unknown) = (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      if (init.signal) {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("Caller cancelled", "AbortError"));
        });
      }
    });

  const caller = new AbortController();
  const { signal, cleanup } = resolveFetchSignal(caller.signal, 5000);

  const fetchPromise = globalThis.fetch("https://example.com/api/v1/playback", {
    method: "POST",
    signal: signal!,
  });

  caller.abort();

  const result = await Promise.race([
    fetchPromise.then(
      () => ({ kind: "resolved" as const }),
      (err: unknown) => ({ kind: "rejected" as const, err }),
    ),
    new Promise<{ kind: "timeout" }>((resolve) =>
      setTimeout(() => resolve({ kind: "timeout" }), 100),
    ),
  ]);

  cleanup();
  globalThis.fetch = originalFetch;

  assert.equal(result.kind, "rejected", "Caller abort should reject the fetch");
  if (result.kind === "rejected") {
    assert.equal(result.err.name, "AbortError");
  }
});
