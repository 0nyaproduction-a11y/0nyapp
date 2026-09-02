// @ts-expect-error node:test resolves at runtime via tsx; the project tsconfig uses
// bundler resolution without a node lib/types condition, so the `node:` specifier
// is not statically resolvable by tsc here.
import { test } from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";
import type { Session } from "@supabase/supabase-js";
import {
  getHistoryMergeUiState,
  getHistoryMergeUiStateFromEntry,
  retryPendingGuestHistoryMerge,
  type HistoryMergeStateEntry,
} from "./historySyncState";

function makeSession(): Session {
  return {
    access_token: "session-token",
    user: {
      app_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00.000Z",
      email: "guest@example.com",
      id: "user-1",
      user_metadata: {},
    },
  } as Session;
}

test("pending merge state becomes visible to the consumer-facing UI seam", () => {
  const entry: HistoryMergeStateEntry = {
    guestCredential: "guest-1",
    lastErrorMessage: "Watch history couldn't fully sync.",
    mergedAt: "2026-01-01T00:00:00.000Z",
    status: "pending",
  };

  assert.deepEqual(getHistoryMergeUiStateFromEntry(entry), {
    errorMessage: "Watch history couldn't fully sync.",
    status: "pending",
  });

  assert.deepEqual(
    getHistoryMergeUiState(makeSession(), { "user-1": entry }),
    {
      errorMessage: "Watch history couldn't fully sync.",
      status: "pending",
    },
  );
});

test("retryPendingGuestHistoryMerge reuses the existing merge authority and keeps pending state on failure", async () => {
  let callCount = 0;
  const session = makeSession();

  const result = await retryPendingGuestHistoryMerge(session, async (currentSession) => {
    callCount += 1;
    assert.equal(currentSession, session);
    return { pending: true };
  });

  assert.equal(callCount, 1);
  assert.deepEqual(result, {
    pending: true,
    retried: true,
    status: "pending",
  });
});

test("successful retry clears the visible warning state", async () => {
  const session = makeSession();

  const result = await retryPendingGuestHistoryMerge(session, async () => ({ pending: false }));

  assert.deepEqual(result, {
    pending: false,
    retried: true,
    status: "idle",
  });
});

test("retry without an authenticated session does not call the merge authority", async () => {
  let callCount = 0;

  const result = await retryPendingGuestHistoryMerge(null, async () => {
    callCount += 1;
    return { pending: true };
  });

  assert.equal(callCount, 0);
  assert.deepEqual(result, {
    pending: false,
    retried: false,
    status: "idle",
  });
});
