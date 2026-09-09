// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";

import {
  createBoundedFetchSignal,
  PlaybackTimeoutError,
} from "../lib/playbackTimeout";

test("H2: without timeoutMs caller signal passes through unchanged", () => {
  const caller = new AbortController();
  const { signal, cleanup } = createBoundedFetchSignal(caller.signal, undefined);
  assert.equal(signal, caller.signal);
  assert.equal(signal?.aborted, false);
  cleanup();
});

test("H2: hung request times out after timeoutMs", async () => {
  const { signal, cleanup } = createBoundedFetchSignal(undefined, 50);
  assert.ok(signal instanceof AbortSignal);
  assert.equal(signal.aborted, false);
  await new Promise<void>((resolve) => {
    signal!.addEventListener("abort", () => resolve(), { once: true });
  });
  assert.equal(signal.aborted, true);
  cleanup();
});

test("H2: timeout abort is NOT reflected on caller signal (recoverable)", async () => {
  const caller = new AbortController();
  const { signal, cleanup } = createBoundedFetchSignal(caller.signal, 50);
  await new Promise<void>((resolve) => {
    signal!.addEventListener("abort", () => resolve(), { once: true });
  });
  assert.equal(signal.aborted, true, "merged signal aborted by timeout");
  assert.equal(caller.signal.aborted, false, "caller signal must stay recoverable");
  cleanup();
});

test("H2: caller abort propagates to merged signal", async () => {
  const caller = new AbortController();
  const { signal, cleanup } = createBoundedFetchSignal(caller.signal, 5000);
  assert.equal(signal!.aborted, false);
  caller.abort();
  assert.equal(signal!.aborted, true);
  cleanup();
});

test("H2: already-aborted caller aborts merged signal immediately", async () => {
  const caller = new AbortController();
  caller.abort();
  const { signal, cleanup } = createBoundedFetchSignal(caller.signal, 5000);
  assert.equal(signal!.aborted, true);
  cleanup();
});

test("H2: cleanup clears timeout and detaches listener", async () => {
  const caller = new AbortController();
  const { signal, cleanup } = createBoundedFetchSignal(caller.signal, 50);
  cleanup();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(signal!.aborted, false);
  assert.equal(caller.signal.aborted, false);
});

test("H2: timeout fires within expected window", async () => {
  const { signal, cleanup } = createBoundedFetchSignal(undefined, 50);
  const start = Date.now();
  await new Promise<void>((resolve, reject) => {
    signal!.addEventListener("abort", () => {
      const elapsed = Date.now() - start;
      if (elapsed >= 40 && elapsed < 500) resolve();
      else reject(new Error(`Timeout fired at ${elapsed}ms, expected ~50ms`));
    });
  });
  cleanup();
});

test("H2: zero or negative timeoutMs treated as no timeout", () => {
  const caller = new AbortController();
  const r1 = createBoundedFetchSignal(caller.signal, 0);
  assert.equal(r1.signal, caller.signal);
  r1.cleanup();
  const r2 = createBoundedFetchSignal(caller.signal, -100);
  assert.equal(r2.signal, caller.signal);
  r2.cleanup();
  assert.equal(caller.signal.aborted, false);
});

test("H2: each call creates exactly one signal (no duplicates)", async () => {
  const { signal, cleanup } = createBoundedFetchSignal(undefined, 1000);
  assert.ok(signal instanceof AbortSignal);
  assert.equal(signal.aborted, false);
  cleanup();
  assert.equal(signal.aborted, false);
});

test("H2: PlaybackTimeoutError has correct code", () => {
  const error = new PlaybackTimeoutError();
  assert.equal(error.code, "playback_timeout");
  assert.equal(error.name, "PlaybackTimeoutError");
  assert.ok(error instanceof Error);
});

test("H2: retry creates fresh bounded signal with independent timeout", async () => {
  // Simulate first request timing out.
  const first = createBoundedFetchSignal(undefined, 50);
  await new Promise<void>((resolve) => {
    first.signal!.addEventListener("abort", () => resolve(), { once: true });
  });
  assert.equal(first.signal!.aborted, true, "first request timed out");
  first.cleanup();

  // Simulate retry creating a fresh request.
  const second = createBoundedFetchSignal(undefined, 1000);
  assert.ok(second.signal instanceof AbortSignal);
  assert.equal(second.signal!.aborted, false, "retry signal starts fresh");
  second.cleanup();
});

test("H2: multiple calls create independent signals (no shared state)", async () => {
  const a = createBoundedFetchSignal(undefined, 50);
  const b = createBoundedFetchSignal(undefined, 1000);

  await new Promise<void>((resolve) => {
    a.signal!.addEventListener("abort", () => resolve(), { once: true });
  });

  assert.equal(a.signal!.aborted, true, "a timed out at 50ms");
  assert.equal(b.signal!.aborted, false, "b unaffected by a's timeout");

  a.cleanup();
  b.cleanup();
});

test("H2: timeout is scoped per-call (no global timeout leak)", () => {
  // A short timeout on one call must not affect a subsequent call with no timeout.
  const caller = new AbortController();
  const withTimeout = createBoundedFetchSignal(caller.signal, 50);
  const withoutTimeout = createBoundedFetchSignal(caller.signal, undefined);

  // The no-timeout call should pass through the caller signal directly.
  assert.equal(withoutTimeout.signal, caller.signal);
  withTimeout.cleanup();
  withoutTimeout.cleanup();
});