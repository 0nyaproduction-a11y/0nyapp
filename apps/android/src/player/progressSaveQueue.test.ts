import test from "node:test";
import assert from "node:assert/strict";
import { createProgressSaveQueue, createProgressWriteScheduler, waitForProgressFlush, type ProgressSample } from "./progressSaveQueue";

const sample = (positionSeconds: number): ProgressSample => ({ positionSeconds, durationSeconds: 200 });

test("periodic 45 then explicit pause/Back/background 48 persists the latest sub-threshold sample", async () => {
  for (const mode of ["user", "lifecycle"] as const) {
    const saved: number[] = [];
    const queue = createProgressSaveQueue({ scope: mode, isCurrentIdentity: () => true,
      save: async (value) => { saved.push(value.positionSeconds); } });
    await queue.enqueue(sample(45), "periodic");
    await queue.enqueue(sample(48), "periodic");
    assert.deepEqual(saved, [45]);
    await queue.enqueue(sample(48), mode);
    assert.deepEqual(saved, [45, 48]);
  }
});

test("failed 45 remains unacknowledged and same-position retry succeeds", async () => {
  let calls = 0;
  const queue = createProgressSaveQueue({ scope: "retry", isCurrentIdentity: () => true,
    save: async () => { if (++calls === 1) throw new Error("offline"); } });
  await queue.enqueue(sample(45), "periodic");
  assert.equal(queue.getState().attempted?.positionSeconds, 45);
  assert.equal(queue.getState().persisted, null);
  await queue.enqueue(sample(45), "user");
  assert.equal(calls, 2);
  assert.equal(queue.getState().persisted?.positionSeconds, 45);
});

test("overlapping lifecycle samples coalesce but retain newer progress in order", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const saved: number[] = [];
  const queue = createProgressSaveQueue({ scope: "overlap", isCurrentIdentity: () => true,
    save: async (value) => { saved.push(value.positionSeconds); if (saved.length === 1) await gate; } });
  const first = queue.enqueue(sample(45), "periodic");
  assert.equal(queue.enqueue(sample(45), "lifecycle"), first);
  const second = queue.enqueue(sample(48), "user");
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(saved, [45]);
  release(); await Promise.all([first, second]);
  assert.deepEqual(saved, [45, 48]);
});

test("bounded caller wait preserves serialization across A to B to A player mounts", async () => {
  const schedule = createProgressWriteScheduler();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const saved: string[] = [];
  const a = createProgressSaveQueue({ scope: "user:A", schedule, isCurrentIdentity: () => true,
    save: async () => { await gate; saved.push("old A"); } });
  const old = a.enqueue(sample(45), "user");
  await waitForProgressFlush(old, 1);
  assert.equal(a.getState().persisted, null);
  const b = createProgressSaveQueue({ scope: "user:B", schedule, isCurrentIdentity: () => true,
    save: async () => { saved.push("B"); } });
  await b.enqueue(sample(10), "user");
  const newA = createProgressSaveQueue({ scope: "user:A", schedule, isCurrentIdentity: () => true,
    save: async () => { saved.push("new A"); } });
  const newer = newA.enqueue(sample(48), "user");
  assert.deepEqual(saved, ["B"]);
  release(); await Promise.all([old, newer]);
  assert.deepEqual(saved, ["B", "old A", "new A"]);
});

test("obsolete identity cannot acknowledge or send queued writes", async () => {
  let current = true;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const queue = createProgressSaveQueue({ scope: "account:A", isCurrentIdentity: () => current,
    save: async () => { calls += 1; await gate; } });
  const first = queue.enqueue(sample(45), "periodic");
  const second = queue.enqueue(sample(48), "user");
  await Promise.resolve(); await Promise.resolve();
  current = false;
  release(); await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(queue.getState().persisted, null);
});

test("H1: a slow older write cannot land after (or overwrite) a newer write for the same scope", async () => {
  // FIFO per scope guarantees the older sample persists FIRST, so the newest
  // position always remains the final persisted position — a stale async save
  // can never jump the player's resume position backward.
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const saved: number[] = [];
  const queue = createProgressSaveQueue({ scope: "freshness", isCurrentIdentity: () => true,
    save: async (value) => {
      saved.push(value.positionSeconds);
      if (saved.length === 1) await firstGate;
    } });
  const older = queue.enqueue(sample(45), "periodic");
  const newer = queue.enqueue(sample(48), "user");
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(saved, [45]); // older is mid-flight
  releaseFirst();
  await Promise.all([older, newer]);
  assert.deepEqual(saved, [45, 48]); // ordering preserved, newest last
  assert.equal(queue.getState().persisted?.positionSeconds, 48);
});
