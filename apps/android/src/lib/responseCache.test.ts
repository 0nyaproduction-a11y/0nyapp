import assert from "node:assert/strict";
import { test } from "node:test";
import { createResponseCache } from "./responseCache";

test("production response cache retains TTL reuse and request deduplication", async () => {
  const cache = createResponseCache<number>(15000);
  let calls = 0;
  let resolve!: (value: number) => void;
  const read = () => { calls += 1; return new Promise<number>((done) => { resolve = done; }); };
  const first = cache.get("A:series", read);
  assert.equal(cache.get("A:series", read), first);
  resolve(1);
  assert.equal(await first, 1);
  assert.equal(await cache.get("A:series", read), 1);
  assert.equal(calls, 1);
});

test("entitlement invalidation starts fresh access read; late pre-reward result cannot publish or remove replacement request", async () => {
  const cache = createResponseCache<number>(15000);
  let finishOld!: (value: number) => void;
  let finishFresh!: (value: number) => void;
  const published: number[] = [];
  const old = cache.get("A:series", () => new Promise<number>((done) => { finishOld = done; }), (value) => published.push(value));
  const oldRejected = assert.rejects(old, /obsolete/);
  cache.clear();
  const fresh = cache.get("A:series", () => new Promise<number>((done) => { finishFresh = done; }), (value) => published.push(value));
  finishOld(0);
  await oldRejected;
  assert.equal(cache.get("A:series", async () => 2), fresh);
  finishFresh(1);
  assert.equal(await fresh, 1);
  assert.deepEqual(published, [1]);
  assert.equal(await cache.get("A:series", async () => 2), 1);
});

test("failed reads remain retryable and expired TTL entries fetch again", async () => {
  const cache = createResponseCache<number>(0);
  await assert.rejects(cache.get("guest", async () => { throw new Error("offline"); }));
  assert.equal(await cache.get("guest", async () => 1), 1);
  assert.equal(await cache.get("guest", async () => 2), 2);
});
