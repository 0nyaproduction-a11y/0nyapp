// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error node:assert/strict resolves at runtime via tsx.
import assert from "node:assert/strict";
import type { WatchProgressItem } from "../types/api";
import { getPlaybackResumeOwner, loadTargetPlaybackHistory, resolveInitialPlaybackSeek, type TargetHistoryState } from "./targetResume";

const episodeA = { type: "SERIES_EPISODE" as const, seriesSlug: "series-a", episodeNumber: 1 };
const episodeB = { ...episodeA, episodeNumber: 2 };
function progress(episodeNumber: number, positionSeconds: number): WatchProgressItem {
  return { contentType: "series_episode", seriesSlug: "series-a", episodeNumber, positionSeconds, durationSeconds: 200, completed: false } as WatchProgressItem;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function seek(state: TargetHistoryState, explicit?: number | null, appliedOwner: string | null = null, sourceLoadCount = 1) {
  return resolveInitialPlaybackSeek({ owner: state.owner, appliedOwner, isProgressResolved: state.status === "resolved", sourceLoadCount, initialSeekSeconds: explicit, savedProgress: state.progress, durationSeconds: 200 });
}

test("delayed guest history cannot consume initial seek before resolution", async () => {
  const pending = deferred<WatchProgressItem[]>();
  let state!: TargetHistoryState;
  const request = loadTargetPlaybackHistory({ owner: getPlaybackResumeOwner(episodeA), target: episodeA, load: () => pending.promise, publish: (next) => { state = next; } });
  assert.equal(state.status, "loading");
  assert.equal(seek(state), null);
  assert.equal(seek(state, 90), null);
  pending.resolve([progress(1, 45)]);
  await request.done;
  assert.deepEqual(seek(state), { positionSeconds: 45 });
  assert.equal(seek(state, undefined, null, 0), null);
  assert.equal(seek(state, undefined, state.owner), null);
});

test("manual and auto-next targets use their own history, including A to B to A", async () => {
  for (const userId of [null, "account-a"]) {
    for (const target of [episodeA, episodeB, episodeA]) {
      let state!: TargetHistoryState;
      const request = loadTargetPlaybackHistory({ owner: getPlaybackResumeOwner(target, userId), target, load: async () => [progress(1, 45), progress(2, 80)], publish: (next) => { state = next; } });
      assert.equal(seek(state), null);
      await request.done;
      assert.deepEqual(seek(state), { positionSeconds: target.episodeNumber === 1 ? 45 : 80 });
    }
  }
});

test("stale success and failure cannot publish after target/identity ownership ends", async () => {
  for (const rejects of [false, true]) {
    const old = deferred<WatchProgressItem[]>();
    let state!: TargetHistoryState;
    const oldRequest = loadTargetPlaybackHistory({ owner: getPlaybackResumeOwner(episodeA, "account-a"), target: episodeA, load: () => old.promise, publish: (next) => { state = next; } });
    oldRequest.cancel();
    const current = loadTargetPlaybackHistory({ owner: getPlaybackResumeOwner(episodeB, "account-b"), target: episodeB, load: async () => [progress(2, 80)], publish: (next) => { state = next; } });
    await current.done;
    if (rejects) old.reject(new Error("old account failed")); else old.resolve([progress(1, 45)]);
    await oldRequest.done;
    assert.equal(state.owner, getPlaybackResumeOwner(episodeB, "account-b"));
    assert.deepEqual(seek(state), { positionSeconds: 80 });
  }
});

test("no history, explicit route resume, and replay from zero remain deterministic", async () => {
  let state!: TargetHistoryState;
  await loadTargetPlaybackHistory({ owner: getPlaybackResumeOwner(episodeB), target: episodeB, load: async () => [progress(1, 45)], publish: (next) => { state = next; } }).done;
  assert.deepEqual(seek(state), { positionSeconds: 0 });
  state = { ...state, progress: progress(2, 80) };
  assert.deepEqual(seek(state, 48), { positionSeconds: 48 });
  assert.deepEqual(seek(state, 0), { positionSeconds: 0 });
  assert.deepEqual(seek(state, Number.NaN), { positionSeconds: 80 });
  assert.deepEqual(seek(state, 500), { positionSeconds: 200 });
  assert.notEqual(getPlaybackResumeOwner(episodeA), getPlaybackResumeOwner(episodeA, "account-a"));
});

test("history errors remain errors and a successful retry supplies the real position", async () => {
  let state!: TargetHistoryState;
  const options = { owner: getPlaybackResumeOwner(episodeA), target: episodeA, publish: (next: TargetHistoryState) => { state = next; } };
  await loadTargetPlaybackHistory({ ...options, load: async () => { throw new Error("offline"); } }).done;
  assert.equal(state.status, "error");
  assert.equal(seek(state), null);
  await loadTargetPlaybackHistory({ ...options, load: async () => [progress(1, 48)] }).done;
  assert.deepEqual(seek(state), { positionSeconds: 48 });
});

test("canonical completion rule clears near-complete resume at either threshold", () => {
  const state = { owner: getPlaybackResumeOwner(episodeA), status: "resolved" as const, progress: progress(1, 190) };
  assert.deepEqual(seek(state), { positionSeconds: 0 });
  assert.deepEqual(resolveInitialPlaybackSeek({ owner: state.owner, appliedOwner: null, isProgressResolved: true, sourceLoadCount: 1, savedProgress: { ...state.progress, positionSeconds: 55, durationSeconds: 60 }, durationSeconds: 60 }), { positionSeconds: 0 });
});
