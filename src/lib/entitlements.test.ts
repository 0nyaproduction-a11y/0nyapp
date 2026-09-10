import { test } from "node:test";
import assert from "node:assert/strict";
import { canUserWatchEpisode, getEpisodeAccessStates } from "./entitlements";
import type { Episode } from "@/data/content";

function createMockEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: "ep_test",
    number: 1,
    title: "Test Episode",
    description: "Synopsis",
    runtime: "10:00",
    isFree: false,
    coinPrice: 10,
    coinUnlockEnabled: true,
    rewardedUnlockEnabled: false,
    rewardedAccessMode: "permanent",
    requiredRewardedCompletions: 1,
    plusAccess: false,
    lockedPreviewSeconds: 0,
    contentRatingOverride: null,
    contentDescriptorsOverride: [],
    contentRating: "U",
    contentDescriptors: [],
    parentalLockRequired: false,
    ageVerificationRequired: false,
    ...overrides,
  };
}

function createMockSupabase({
  hasSubscription = false,
  entitledEpisodeIds = new Set<string>(),
}: {
  hasSubscription?: boolean;
  entitledEpisodeIds?: Set<string>;
} = {}) {
  return {
    from: (table: string) => {
      if (table === "subscriptions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: hasSubscription
                        ? [
                            {
                              id: "sub_1",
                              status: "active",
                              starts_at: new Date(Date.now() - 10000).toISOString(),
                              ends_at: new Date(Date.now() + 1000000).toISOString(),
                            },
                          ]
                        : [],
                      error: null,
                    }),
                }),
              }),
              order: () => ({
                limit: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: null,
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === "episode_entitlements") {
        return {
          select: () => ({
            eq: (_field: string, _userId: string) => ({
              eq: (_epField: string, epId: string) => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: entitledEpisodeIds.has(epId)
                      ? {
                          episode_id: epId,
                          expires_at: new Date(Date.now() + 1000000).toISOString(),
                        }
                      : null,
                    error: null,
                  }),
              }),
              in: (_epField: string, ids: string[]) =>
                Promise.resolve({
                  data: ids
                    .filter((id) => entitledEpisodeIds.has(id))
                    .map((id) => ({
                      episode_id: id,
                      expires_at: new Date(Date.now() + 1000000).toISOString(),
                    })),
                  error: null,
                }),
            }),
          }),
        };
      }

      return {};
    },
  } as any;
}

test("ACTIVE PLUS: FREE episode canWatch is true", async () => {
  const episode = createMockEpisode({ isFree: true, plusAccess: false });
  const supabase = createMockSupabase({ hasSubscription: true });
  const canWatch = await canUserWatchEpisode({
    userId: "user_plus",
    episode,
    supabase,
  });
  assert.equal(canWatch, true);
});

test("ACTIVE PLUS: COINS-only episode (plusAccess=false) canWatch is true", async () => {
  const episode = createMockEpisode({
    coinPrice: 10,
    coinUnlockEnabled: true,
    isFree: false,
    plusAccess: false,
    rewardedUnlockEnabled: false,
  });
  const supabase = createMockSupabase({ hasSubscription: true });
  const canWatch = await canUserWatchEpisode({
    userId: "user_plus",
    episode,
    supabase,
  });
  assert.equal(canWatch, true);
});

test("ACTIVE PLUS: PLUS episode canWatch is true", async () => {
  const episode = createMockEpisode({
    coinPrice: 0,
    coinUnlockEnabled: false,
    isFree: false,
    plusAccess: true,
    rewardedUnlockEnabled: false,
  });
  const supabase = createMockSupabase({ hasSubscription: true });
  const canWatch = await canUserWatchEpisode({
    userId: "user_plus",
    episode,
    supabase,
  });
  assert.equal(canWatch, true);
});

test("ACTIVE PLUS: COINS_OR_PLUS episode canWatch is true", async () => {
  const episode = createMockEpisode({
    coinPrice: 10,
    coinUnlockEnabled: true,
    isFree: false,
    plusAccess: true,
    rewardedUnlockEnabled: false,
  });
  const supabase = createMockSupabase({ hasSubscription: true });
  const canWatch = await canUserWatchEpisode({
    userId: "user_plus",
    episode,
    supabase,
  });
  assert.equal(canWatch, true);
});

test("ACTIVE PLUS: REWARDED_OR_PLUS episode canWatch is true", async () => {
  const episode = createMockEpisode({
    coinPrice: 0,
    coinUnlockEnabled: false,
    isFree: false,
    plusAccess: true,
    rewardedUnlockEnabled: true,
  });
  const supabase = createMockSupabase({ hasSubscription: true });
  const canWatch = await canUserWatchEpisode({
    userId: "user_plus",
    episode,
    supabase,
  });
  assert.equal(canWatch, true);
});

test("ACTIVE PLUS: OWNED episode canWatch is true", async () => {
  const episode = createMockEpisode({ id: "ep_owned", isFree: false });
  const supabase = createMockSupabase({
    hasSubscription: true,
    entitledEpisodeIds: new Set(["ep_owned"]),
  });
  const canWatch = await canUserWatchEpisode({
    userId: "user_plus",
    episode,
    supabase,
  });
  assert.equal(canWatch, true);
});

test("GUEST / NON-SUBSCRIBED USER: cannot watch non-free episodes", async () => {
  const episode = createMockEpisode({
    coinPrice: 10,
    coinUnlockEnabled: true,
    isFree: false,
    plusAccess: false,
  });
  const supabase = createMockSupabase({ hasSubscription: false });

  // Guest (no userId)
  const guestCanWatch = await canUserWatchEpisode({
    userId: null,
    episode,
    supabase,
  });
  assert.equal(guestCanWatch, false);

  // Free signed-in user without Plus or Coin unlock
  const userCanWatch = await canUserWatchEpisode({
    userId: "user_free",
    episode,
    supabase,
  });
  assert.equal(userCanWatch, false);
});

test("getEpisodeAccessStates: active Plus subscriber receives Included status for all catalog episodes", async () => {
  const episodes: Episode[] = [
    createMockEpisode({ number: 1, isFree: true, plusAccess: false }),
    createMockEpisode({ number: 2, isFree: false, coinPrice: 10, plusAccess: false }),
    createMockEpisode({ number: 3, isFree: false, plusAccess: true }),
    createMockEpisode({ number: 4, isFree: false, coinPrice: 10, plusAccess: true }),
    createMockEpisode({ number: 5, isFree: false, rewardedUnlockEnabled: true, plusAccess: true }),
  ];
  const supabase = createMockSupabase({ hasSubscription: true });
  const accessStates = await getEpisodeAccessStates("user_plus", episodes, supabase);

  // Ep 1 (Free)
  assert.deepEqual(accessStates.get(1), {
    canWatch: true,
    kind: "free",
    label: "Free",
  });

  // Ep 2 (Coins-only, plusAccess=false) -> Included under global Plus access
  assert.deepEqual(accessStates.get(2), {
    canWatch: true,
    kind: "subscription",
    label: "Included",
  });

  // Ep 3 (Plus) -> Included
  assert.deepEqual(accessStates.get(3), {
    canWatch: true,
    kind: "subscription",
    label: "Included",
  });

  // Ep 4 (Coins or Plus) -> Included
  assert.deepEqual(accessStates.get(4), {
    canWatch: true,
    kind: "subscription",
    label: "Included",
  });

  // Ep 5 (Rewarded or Plus) -> Included
  assert.deepEqual(accessStates.get(5), {
    canWatch: true,
    kind: "subscription",
    label: "Included",
  });
});

test("getEpisodeAccessStates: non-subscribed user has locked status for non-free episodes", async () => {
  const episodes: Episode[] = [
    createMockEpisode({ number: 1, isFree: true, plusAccess: false }),
    createMockEpisode({ number: 2, isFree: false, coinPrice: 10, plusAccess: false }),
    createMockEpisode({ number: 3, isFree: false, plusAccess: true }),
  ];
  const supabase = createMockSupabase({ hasSubscription: false });
  const accessStates = await getEpisodeAccessStates("user_free", episodes, supabase);

  assert.deepEqual(accessStates.get(1), {
    canWatch: true,
    kind: "free",
    label: "Free",
  });

  assert.deepEqual(accessStates.get(2), {
    canWatch: false,
    kind: "locked",
    label: "Locked",
  });

  assert.deepEqual(accessStates.get(3), {
    canWatch: false,
    kind: "locked",
    label: "Locked",
  });
});
