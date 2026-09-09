import assert from "node:assert/strict";
import test from "node:test";
import { createScreenRequestOwner, loadScreenResources } from "./screenResources";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("healthy catalog publishes before delayed history; history failure remains an error", async () => {
  const history = deferred<string[]>();
  const events: string[] = [];
  await loadScreenResources({ owner: createScreenRequestOwner(), loadRequired: async () => "catalog", onRequired: (data) => events.push(data), onRequiredError: () => events.push("catalog-error"), onRequiredSettled: () => events.push("usable"), loadOptional: () => history.promise, onOptional: () => events.push("synced-empty"), onOptionalError: () => events.push("history-error") });
  assert.deepEqual(events, ["catalog", "usable"]);
  history.reject(new Error("offline"));
  await tick();
  assert.deepEqual(events, ["catalog", "usable", "history-error"]);
});

test("retry supersedes old catalog and history responses and their finalizers", async () => {
  const owner = createScreenRequestOwner();
  const old = deferred<string>();
  const history = deferred<string>();
  const events: string[] = [];
  const callbacks = { owner, onRequired: (data: string) => events.push(data), onRequiredError: () => events.push("error"), onRequiredSettled: () => events.push("settled"), onOptional: (data: string) => events.push(data) };
  const pending = loadScreenResources({ ...callbacks, loadRequired: () => old.promise, loadOptional: () => history.promise });
  await loadScreenResources({ ...callbacks, loadRequired: async () => "new" });
  old.resolve("stale"); history.resolve("stale-history");
  await pending; await tick();
  assert.deepEqual(events, ["new", "settled"]);
});

for (const reason of ["blur", "unmount", "auth change"]) {
  test(`${reason} cancels all publications from obsolete context`, async () => {
    const owner = createScreenRequestOwner(); const old = deferred<string>(); const events: string[] = [];
    const pending = loadScreenResources({ owner, loadRequired: () => old.promise, onRequired: (data) => events.push(data), onRequiredError: () => events.push("error"), onRequiredSettled: () => events.push("settled") });
    owner.invalidate(); old.resolve("old account"); await pending;
    assert.deepEqual(events, []);
  });
}
