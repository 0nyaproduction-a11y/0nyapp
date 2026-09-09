// @ts-expect-error node:test resolves at runtime via tsx.
import test from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";
import type { Session } from "@supabase/supabase-js";
import type { WatchProgressItem } from "../types/api";
import {
  runGuestHistoryMerge,
  type HistoryMergeDependencies,
} from "./guestHistoryMerge";

type MergeFixture = {
  deps: HistoryMergeDependencies;
  saved: WatchProgressItem[];
  state: Record<string, { guestCredential: string | null; mergedAt: string; status?: "completed" | "pending" }>;
};

const session = (id = "A") => ({
  access_token: `token-${id}`,
  user: { id },
}) as Session;

const progress = (number = 1): WatchProgressItem => ({
  contentType: "series_episode",
  seriesSlug: "series",
  episodeNumber: number,
  shortFilmSlug: null,
  positionSeconds: 45,
  durationSeconds: 200,
  completed: false,
  lastWatchedAt: "2026-09-05T10:00:00Z",
  adBreakState: {
    handledBreakSeconds: [],
    pendingBreakSeconds: null,
    waivedBreakSeconds: [],
  },
});

function fixture(overrides: Partial<HistoryMergeDependencies> = {}): MergeFixture {
  const state: MergeFixture["state"] = {};
  const saved: WatchProgressItem[] = [];
  const deps: HistoryMergeDependencies = {
    loadGuest: async () => [progress()],
    loadAccount: async () => [],
    guestCredential: async () => "guest-device",
    readEntry: async (id) => state[id],
    writeEntry: async (id, entry) => {
      state[id] = entry;
    },
    save: async (_, item) => {
      saved.push(item);
    },
    prune: async () => undefined,
    isStale: () => false,
    isSystemic: () => true,
    ...overrides,
  };
  return { deps, saved, state };
}

test("first account-history failure persists pending; a later run retries the same production merge", async () => {
  let fail = true;
  const f = fixture({
    loadAccount: async () => {
      if (fail) throw new Error("offline");
      return [];
    },
  });

  const first = await runGuestHistoryMerge(session(), f.deps);
  assert.equal(first.pending, true);
  assert.equal(f.state.A.status, "pending");

  fail = false;
  const retry = await runGuestHistoryMerge(session(), f.deps);
  assert.equal(retry.pending, false);
  assert.equal(retry.merged, 1);
  assert.equal(f.saved.length, 1);
  assert.equal(f.state.A.status, "completed");
});

test("item-specific failures stay pending only for the failed item while another succeeds", async () => {
  const f = fixture({
    loadGuest: async () => [progress(1), progress(2)],
    isSystemic: () => false,
    save: async (_, item) => {
      if (item.episodeNumber === 1) throw new Error("invalid entry");
      f.saved.push(item);
    },
  });

  const result = await runGuestHistoryMerge(session(), f.deps);
  assert.equal(result.merged, 1);
  assert.equal(result.pending, true);
  assert.equal(result.failed, 1);
  assert.equal(f.state.A.status, "pending");
});

test("completed remote progress is preserved and stale missing entries can be pruned", async () => {
  const pruned: WatchProgressItem[] = [];
  const f = fixture({
    loadGuest: async () => [progress(1), progress(2)],
    loadAccount: async () => [{
      ...progress(1),
      positionSeconds: 190,
      lastWatchedAt: "2026-09-01T10:00:00Z",
    }],
    save: async () => {
      throw new Error("missing");
    },
    isStale: () => true,
    prune: async (items) => {
      pruned.push(...items);
    },
  });

  const result = await runGuestHistoryMerge(session(), f.deps);
  assert.equal(result.stale, 1);
  assert.equal(pruned[0].episodeNumber, 2);
  assert.equal(result.pending, false);
});

test("session ownership prevents a stale merge from continuing writes after logout", async () => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let active = true;
  const f = fixture({
    loadAccount: async () => {
      await delayed;
      return [];
    },
  });

  const oldMerge = runGuestHistoryMerge(session(), f.deps, () => active);
  active = false;
  release();
  const result = await oldMerge;

  assert.equal(result.merged, 0);
  assert.equal(f.saved.length, 0);
  assert.equal(f.state.A, undefined);
});

test("an unauthenticated merge is skipped without invoking production dependencies", async () => {
  let loadGuestCalls = 0;
  const f = fixture({
    loadGuest: async () => {
      loadGuestCalls += 1;
      return [progress()];
    },
  });

  const result = await runGuestHistoryMerge(null, f.deps);
  assert.deepEqual(result, {
    failed: 0,
    merged: 0,
    pending: false,
    skipped: true,
    stale: 0,
  });
  assert.equal(loadGuestCalls, 0);
});

test("empty guest history clears a previous pending merge marker", async () => {
  const f = fixture({
    loadGuest: async () => [],
    readEntry: async () => ({
      guestCredential: "guest-device",
      mergedAt: "2026-09-01T10:00:00Z",
      status: "pending",
    }),
  });

  const result = await runGuestHistoryMerge(session(), f.deps);
  assert.equal(result.pending, false);
  assert.equal(f.state.A.status, "completed");
});

// The removed createHistorySyncController tests were obsolete assertions: the
// current production helper has no standalone controller or controller-level
// in-flight deduplication API. Retry is represented by a later merge call.
