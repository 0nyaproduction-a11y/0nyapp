import assert from "node:assert/strict";
import { test } from "node:test";
import { startBoundedPolling } from "./boundedPolling";
import { createOperationLifetime } from "./operationLifetime";

const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };

test("hard polling deadline aborts hung request and ignores its eventual reward response", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let complete!: (value: number) => void;
  let signal!: AbortSignal;
  let timeouts = 0;
  let publications = 0;
  startBoundedPolling({
    read: (requestSignal) => { signal = requestSignal; return new Promise<number>((done) => { complete = done; }); },
    onValue: () => { publications += 1; return true; },
    onError: () => false,
    onTimeout: () => { timeouts += 1; }, timeoutMs: 60000, intervalMs: 3500,
  });
  t.mock.timers.tick(60000);
  assert.equal(signal.aborted, true);
  assert.equal(timeouts, 1);
  complete(1);
  await flush();
  assert.equal(publications, 0);
});

test("blur/unmount cleanup prevents obsolete response and further polling", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let complete!: (value: number) => void;
  let publications = 0;
  const cancel = startBoundedPolling({
    read: () => new Promise<number>((done) => { complete = done; }),
    onValue: () => { publications += 1; return false; },
    onError: () => false, onTimeout: () => assert.fail("cancelled timeout"), timeoutMs: 60000, intervalMs: 3500,
  });
  cancel();
  complete(1);
  await flush();
  t.mock.timers.tick(70000);
  assert.equal(publications, 0);
});

test("polling is serial, retries pending state, and stops on a verified terminal result", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  startBoundedPolling({
    read: async () => ++calls,
    onValue: (value) => value === 2,
    onError: () => false, onTimeout: () => assert.fail("completed timeout"), timeoutMs: 60000, intervalMs: 3500,
  });
  await flush();
  t.mock.timers.tick(3500);
  await flush();
  t.mock.timers.tick(70000);
  assert.equal(calls, 2);
});

test("deadline invalidates asynchronous navigation refresh too; a new focus cannot revive old ownership", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finish!: () => void;
  let navigations = 0;
  startBoundedPolling({
    read: async () => "verified",
    onValue: async (_value, isActive) => {
      await new Promise<void>((done) => { finish = done; });
      if (isActive()) navigations += 1;
      return true;
    },
    onError: () => false, onTimeout: () => undefined, timeoutMs: 60000, intervalMs: 3500,
  });
  await flush();
  t.mock.timers.tick(60000);
  finish();
  await flush();
  assert.equal(navigations, 0);
  const oldFocus = createOperationLifetime(true);
  oldFocus.cancel();
  const newFocus = createOperationLifetime(true);
  assert.equal(oldFocus.isActive(), false);
  assert.equal(newFocus.isActive(), true);
});
