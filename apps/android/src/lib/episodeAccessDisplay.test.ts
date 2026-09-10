import assert from "node:assert/strict";
import test from "node:test";
import {
  getEpisodeAccessDisplay,
  resolveEpisodeAccess,
} from "./episodeAccessDisplay";
import type { ApiEpisode, EpisodeAccess } from "../types/api";

function createMockEpisode(overrides: Partial<ApiEpisode> = {}): ApiEpisode {
  return {
    ageVerificationRequired: false,
    coinPrice: 10,
    coinUnlockEnabled: true,
    contentDescriptors: [],
    contentDescriptorsOverride: [],
    contentRating: null,
    contentRatingOverride: null,
    description: "Episode description",
    id: "ep-1",
    isFree: false,
    lockedPreviewSeconds: 5,
    number: 1,
    parentalLockRequired: false,
    plusAccess: false,
    requiredRewardedCompletions: 1,
    rewardedAccessMode: "permanent",
    rewardedUnlockEnabled: false,
    runtime: "2:00",
    title: "Episode 1",
    ...overrides,
  };
}

test("resolveEpisodeAccess: CMS Free episode resolves to free for Guest, Free user, and Plus user", () => {
  const freeEpisode = createMockEpisode({ isFree: true, number: 12 });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  // Guest
  const guestResult = resolveEpisodeAccess(freeEpisode, lockedAccess, { isGuest: true });
  assert.equal(guestResult, "free");
  const guestDisplay = getEpisodeAccessDisplay(freeEpisode, lockedAccess, { isGuest: true });
  assert.equal(guestDisplay.label, "Free");
  assert.equal(guestDisplay.isLocked, false);
  assert.equal(guestDisplay.canPreview, false);
  assert.equal(guestDisplay.stateKind, "free");
  assert.equal(guestDisplay.markers[0]?.icon, "free");
  assert.equal(guestDisplay.markers[0]?.label, undefined);
  assert.equal(guestDisplay.markers[0]?.accessibilityLabel, "Free");

  // Free signed-in user
  const freeUserResult = resolveEpisodeAccess(freeEpisode, lockedAccess, { isGuest: false });
  assert.equal(freeUserResult, "free");

  // Plus user
  const plusUserResult = resolveEpisodeAccess(freeEpisode, lockedAccess, { isGuest: false });
  assert.equal(plusUserResult, "free");
});

test("resolveEpisodeAccess: Guest on non-free released coin episode resolves to coin_required with canPreview: true", () => {
  const paidEpisode = createMockEpisode({ isFree: false, number: 5, coinPrice: 15 });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  const result = resolveEpisodeAccess(paidEpisode, lockedAccess, { isGuest: true });
  assert.equal(result, "coin_required");

  const display = getEpisodeAccessDisplay(paidEpisode, lockedAccess, { isGuest: true });
  assert.equal(display.label, "15 Coins");
  assert.equal(display.coinPrice, 15);
  assert.equal(display.isLocked, true);
  assert.equal(display.canPreview, true);
  assert.equal(display.stateKind, "coin_required");
  assert.equal(display.markers[0]?.icon, "coin");
  assert.equal(display.markers[0]?.label, "15");
  assert.equal(display.markers[0]?.tone, "coin");
  assert.equal(display.accessibilityLabel, "15 Coins, preview available");
});

test("resolveEpisodeAccess: Signed-in user with Coin unlock resolves to unlocked", () => {
  const paidEpisode = createMockEpisode({ isFree: false, number: 4 });
  const ownedAccess: EpisodeAccess = { canWatch: true, kind: "owned", label: "Owned" };

  const result = resolveEpisodeAccess(paidEpisode, ownedAccess, { isGuest: false });
  assert.equal(result, "unlocked");

  const display = getEpisodeAccessDisplay(paidEpisode, ownedAccess, { isGuest: false });
  assert.equal(display.label, "Unlocked");
  assert.equal(display.isLocked, false);
  assert.equal(display.canPreview, false);
  assert.equal(display.stateKind, "unlocked");
  assert.equal(display.markers[0]?.icon, "unlocked");
  assert.equal(display.markers[0]?.label, undefined);
  assert.equal(display.markers[0]?.accessibilityLabel, "Unlocked");
  assert.equal(display.markers[0]?.tone, "unlocked");
});

test("resolveEpisodeAccess: Signed-in Plus user with Plus inclusion resolves to included", () => {
  const plusEpisode = createMockEpisode({ isFree: false, number: 8, plusAccess: true });
  const includedAccess: EpisodeAccess = { canWatch: true, kind: "included", label: "Included" };

  const result = resolveEpisodeAccess(plusEpisode, includedAccess, { isGuest: false });
  assert.equal(result, "included");

  const display = getEpisodeAccessDisplay(plusEpisode, includedAccess, { isGuest: false });
  assert.equal(display.label, "Included with Plus");
  assert.equal(display.isLocked, false);
  assert.equal(display.canPreview, false);
  assert.equal(display.stateKind, "included");
  assert.equal(display.markers.length, 0);
});

test("resolveEpisodeAccess: Guest / Free user on Plus-exclusive episode resolves to included with isLocked: true", () => {
  const plusOnlyEpisode = createMockEpisode({
    coinPrice: 0,
    coinUnlockEnabled: false,
    isFree: false,
    number: 9,
    plusAccess: true,
  });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  const guestResult = resolveEpisodeAccess(plusOnlyEpisode, lockedAccess, { isGuest: true });
  assert.equal(guestResult, "included");

  const guestDisplay = getEpisodeAccessDisplay(plusOnlyEpisode, lockedAccess, { isGuest: true });
  assert.equal(guestDisplay.isLocked, true);
  assert.equal(guestDisplay.canPreview, true);
  assert.equal(guestDisplay.stateKind, "included");
  assert.equal(guestDisplay.markers[0]?.icon, "included");
  assert.equal(guestDisplay.markers[0]?.label, undefined);
  assert.equal(guestDisplay.accessibilityLabel, "Included with Plus, preview available");

  const freeUserResult = resolveEpisodeAccess(plusOnlyEpisode, lockedAccess, { isGuest: false });
  assert.equal(freeUserResult, "included");
});

test("resolveEpisodeAccess: Signed-in user on locked episode resolves to coin_required with real coin price", () => {
  const paidEpisode = createMockEpisode({ isFree: false, number: 1, coinPrice: 20 });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  const result = resolveEpisodeAccess(paidEpisode, lockedAccess, { isGuest: false });
  assert.equal(result, "coin_required");

  const display = getEpisodeAccessDisplay(paidEpisode, lockedAccess, { isGuest: false });
  assert.equal(display.label, "20 Coins");
  assert.equal(display.coinPrice, 20);
  assert.equal(display.isLocked, true);
  assert.equal(display.canPreview, true);
  assert.equal(display.stateKind, "coin_required");
  assert.equal(display.markers[0]?.tone, "coin");
  assert.equal(display.markers[0]?.icon, "coin");
  assert.equal(display.markers[0]?.label, "20");
  assert.equal(display.accessibilityLabel, "20 Coins, preview available");
});

test("resolveEpisodeAccess: Genuinely unavailable episode resolves to unavailable", () => {
  const unavailableEpisode = createMockEpisode({ isFree: false, number: 99 });
  const unavailableAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Unavailable" };

  const result = resolveEpisodeAccess(unavailableEpisode, unavailableAccess, { isGuest: false });
  assert.equal(result, "unavailable");

  const display = getEpisodeAccessDisplay(unavailableEpisode, unavailableAccess, { isGuest: false });
  assert.equal(display.label, "Unavailable");
  assert.equal(display.isLocked, true);
  assert.equal(display.canPreview, false);
  assert.equal(display.stateKind, "unavailable");
  assert.equal(display.markers[0]?.icon, "unavailable");
  assert.equal(display.markers[0]?.label, undefined);
  assert.equal(display.markers[0]?.accessibilityLabel, "Unavailable");
  assert.equal(display.markers[0]?.tone, "unavailable");
});

test("resolveEpisodeAccess: Episode number NEVER determines access authority", () => {
  // Episode 1 is paid; episode 20 is free
  const ep1 = createMockEpisode({ isFree: false, number: 1, coinPrice: 10 });
  const ep20 = createMockEpisode({ isFree: true, number: 20 });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  // Episode 1 must NOT be free just because number is 1
  assert.equal(resolveEpisodeAccess(ep1, lockedAccess, { isGuest: false }), "coin_required");
  assert.equal(resolveEpisodeAccess(ep1, lockedAccess, { isGuest: true }), "coin_required");

  // Episode 20 must be free because CMS isFree is true
  assert.equal(resolveEpisodeAccess(ep20, lockedAccess, { isGuest: false }), "free");
  assert.equal(resolveEpisodeAccess(ep20, lockedAccess, { isGuest: true }), "free");
});

test("resolveEpisodeAccess: Doosri Rasoi EP1, EP2, EP3 all resolve to free for Guest, Free user, and Plus user", () => {
  const ep1 = createMockEpisode({ isFree: true, number: 1 });
  const ep2 = createMockEpisode({ isFree: true, number: 2 });
  const ep3 = createMockEpisode({ isFree: true, number: 3 });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  for (const ep of [ep1, ep2, ep3]) {
    for (const isGuest of [true, false]) {
      const state = resolveEpisodeAccess(ep, lockedAccess, { isGuest });
      assert.equal(state, "free", `Episode ${ep.number} must be free`);
      const display = getEpisodeAccessDisplay(ep, lockedAccess, { isGuest });
      assert.equal(display.isLocked, false);
      assert.equal(display.stateKind, "free");
      assert.equal(display.markers[0]?.icon, "free");
      assert.equal(display.markers[0]?.label, undefined);
    }
  }
});

test("getEpisodeAccessDisplay: COINS_OR_PLUS emits coin price marker and compact 0nya Plus cue", () => {
  const coinsOrPlusEp = createMockEpisode({
    coinPrice: 10,
    coinUnlockEnabled: true,
    isFree: false,
    plusAccess: true,
  });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  const display = getEpisodeAccessDisplay(coinsOrPlusEp, lockedAccess, { isGuest: true });
  assert.equal(display.stateKind, "coin_required");
  assert.equal(display.markers.length, 2);
  // Marker 1: coin icon + numeric value
  assert.equal(display.markers[0]?.icon, "coin");
  assert.equal(display.markers[0]?.label, "10");
  assert.equal(display.markers[0]?.tone, "coin");
  // Marker 2: compact 0nya Plus cue
  assert.equal(display.markers[1]?.icon, "included");
  assert.equal(display.markers[1]?.variant, "plus");
  assert.equal(display.markers[1]?.tone, "locked");
});

test("getEpisodeAccessDisplay: REWARDED_OR_PLUS emits rewarded icon and compact 0nya Plus cue", () => {
  const rewardedOrPlusEp = createMockEpisode({
    coinPrice: 0,
    coinUnlockEnabled: false,
    isFree: false,
    plusAccess: true,
    rewardedUnlockEnabled: true,
  });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  const display = getEpisodeAccessDisplay(rewardedOrPlusEp, lockedAccess, { isGuest: false });
  assert.equal(display.stateKind, "included");
  assert.equal(display.markers.length, 2);
  // Marker 1: restrained rewarded/play icon
  assert.equal(display.markers[0]?.icon, "rewarded");
  assert.equal(display.markers[0]?.variant, "ad");
  assert.equal(display.markers[0]?.tone, "muted");
  // Marker 2: compact 0nya Plus cue
  assert.equal(display.markers[1]?.icon, "included");
  assert.equal(display.markers[1]?.variant, "plus");
  assert.equal(display.markers[1]?.tone, "locked");
});

test("getEpisodeAccessDisplay: PLUS SUBSCRIBER on COINS_OR_PLUS episode has marker NONE", () => {
  const coinsOrPlusEp = createMockEpisode({
    coinPrice: 20,
    coinUnlockEnabled: true,
    isFree: false,
    plusAccess: true,
  });
  // Active Plus subscriber
  const plusAccess: EpisodeAccess = { canWatch: true, kind: "included", label: "Included" };

  const display = getEpisodeAccessDisplay(coinsOrPlusEp, plusAccess, { isGuest: false });
  assert.equal(display.stateKind, "included");
  assert.equal(display.isLocked, false);
  // Episode number only - no acquisition markers
  assert.equal(display.markers.length, 0);
});

test("getEpisodeAccessDisplay: Plus + FREE → marker NONE", () => {
  const freeEp = createMockEpisode({ isFree: true, number: 1 });
  const freeAccess: EpisodeAccess = { canWatch: true, kind: "free", label: "Free" };

  const display = getEpisodeAccessDisplay(freeEp, freeAccess, { isGuest: false, isPlus: true });
  assert.equal(display.stateKind, "free");
  assert.equal(display.isLocked, false);
  assert.equal(display.markers.length, 0);
});

test("getEpisodeAccessDisplay: Plus + PLUS_INCLUDED → marker NONE", () => {
  const plusEp = createMockEpisode({ isFree: false, number: 5, plusAccess: true });
  const subAccess: EpisodeAccess = { canWatch: true, kind: "subscription", label: "Included" };

  const display = getEpisodeAccessDisplay(plusEp, subAccess, { isGuest: false, isPlus: true });
  assert.equal(display.stateKind, "included");
  assert.equal(display.isLocked, false);
  assert.equal(display.markers.length, 0);
});

test("getEpisodeAccessDisplay: Plus + REWARDED_OR_PLUS + canWatch → marker NONE", () => {
  const rewardedPlusEp = createMockEpisode({
    isFree: false,
    number: 7,
    plusAccess: true,
    rewardedUnlockEnabled: true,
  });
  const subAccess: EpisodeAccess = { canWatch: true, kind: "subscription", label: "Included" };

  const display = getEpisodeAccessDisplay(rewardedPlusEp, subAccess, { isGuest: false, isPlus: true });
  assert.equal(display.stateKind, "included");
  assert.equal(display.isLocked, false);
  assert.equal(display.markers.length, 0);
});

test("getEpisodeAccessDisplay: Plus + OWNED → marker NONE", () => {
  const ownedEp = createMockEpisode({ isFree: false, number: 3, coinPrice: 10 });
  const ownedAccess: EpisodeAccess = { canWatch: true, kind: "owned", label: "Owned" };

  const display = getEpisodeAccessDisplay(ownedEp, ownedAccess, { isGuest: false, isPlus: true });
  assert.equal(display.stateKind, "unlocked");
  assert.equal(display.isLocked, false);
  assert.equal(display.markers.length, 0);
});

test("getEpisodeAccessDisplay: Plus + COINS-ONLY (plusAccess=false) → marker NONE (EPISODE NUMBER ONLY)", () => {
  const coinOnlyEp = createMockEpisode({
    coinPrice: 15,
    coinUnlockEnabled: true,
    isFree: false,
    number: 9,
    plusAccess: false,
  });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  const display = getEpisodeAccessDisplay(coinOnlyEp, lockedAccess, { isGuest: false, isPlus: true });
  assert.equal(display.stateKind, "included");
  assert.equal(display.isLocked, false);
  assert.equal(display.markers.length, 0);
});

test("getEpisodeAccessDisplay: Non-Plus + COINS-ONLY → Coin marker preserved", () => {
  const coinOnlyEp = createMockEpisode({
    coinPrice: 15,
    coinUnlockEnabled: true,
    isFree: false,
    number: 9,
    plusAccess: false,
  });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  const display = getEpisodeAccessDisplay(coinOnlyEp, lockedAccess, { isGuest: false, isPlus: false });
  assert.equal(display.stateKind, "coin_required");
  assert.equal(display.isLocked, true);
  assert.equal(display.markers.length, 1);
  assert.equal(display.markers[0]?.icon, "coin");
  assert.equal(display.markers[0]?.label, "15");
  assert.equal(display.markers[0]?.tone, "coin");
});

test("getEpisodeAccessDisplay: Plus + UNAVAILABLE → unavailable marker preserved", () => {
  const unavailEp = createMockEpisode({ isFree: false, number: 99 });
  const unavailAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Unavailable" };

  const display = getEpisodeAccessDisplay(unavailEp, unavailAccess, { isGuest: false, isPlus: true });
  assert.equal(display.stateKind, "unavailable");
  assert.equal(display.isLocked, true);
  assert.equal(display.markers.length, 1);
  assert.equal(display.markers[0]?.icon, "unavailable");
  assert.equal(display.markers[0]?.tone, "unavailable");
});

test("getEpisodeAccessDisplay: Guest/Free outputs unchanged", () => {
  // 1. Guest on CMS Free
  const freeEp = createMockEpisode({ isFree: true, number: 1 });
  const freeAccess: EpisodeAccess = { canWatch: true, kind: "free", label: "Free" };
  const guestFreeDisplay = getEpisodeAccessDisplay(freeEp, freeAccess, { isGuest: true, isPlus: false });
  assert.equal(guestFreeDisplay.markers.length, 1);
  assert.equal(guestFreeDisplay.markers[0]?.icon, "free");

  // 2. Free user on CMS Free
  const userFreeDisplay = getEpisodeAccessDisplay(freeEp, freeAccess, { isGuest: false, isPlus: false });
  assert.equal(userFreeDisplay.markers.length, 1);
  assert.equal(userFreeDisplay.markers[0]?.icon, "free");

  // 3. Free user on Owned episode
  const ownedEp = createMockEpisode({ isFree: false, number: 2 });
  const ownedAccess: EpisodeAccess = { canWatch: true, kind: "owned", label: "Owned" };
  const userOwnedDisplay = getEpisodeAccessDisplay(ownedEp, ownedAccess, { isGuest: false, isPlus: false });
  assert.equal(userOwnedDisplay.markers.length, 1);
  assert.equal(userOwnedDisplay.markers[0]?.icon, "unlocked");

  // 4. Guest on Coins-only
  const coinEp = createMockEpisode({ coinPrice: 10, isFree: false, number: 3 });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };
  const guestCoinDisplay = getEpisodeAccessDisplay(coinEp, lockedAccess, { isGuest: true, isPlus: false });
  assert.equal(guestCoinDisplay.markers.length, 1);
  assert.equal(guestCoinDisplay.markers[0]?.icon, "coin");
  assert.equal(guestCoinDisplay.markers[0]?.label, "10");

  // 5. Guest on Coins or Plus
  const coinsOrPlusEp = createMockEpisode({ coinPrice: 10, isFree: false, number: 4, plusAccess: true });
  const guestCoinsOrPlus = getEpisodeAccessDisplay(coinsOrPlusEp, lockedAccess, { isGuest: true, isPlus: false });
  assert.equal(guestCoinsOrPlus.markers.length, 2);
  assert.equal(guestCoinsOrPlus.markers[0]?.icon, "coin");
  assert.equal(guestCoinsOrPlus.markers[1]?.icon, "included");

  // 6. Free user on Rewarded or Plus
  const rewardedPlusEp = createMockEpisode({
    coinPrice: 0,
    coinUnlockEnabled: false,
    isFree: false,
    number: 5,
    plusAccess: true,
    rewardedUnlockEnabled: true,
  });
  const freeRewardedPlus = getEpisodeAccessDisplay(rewardedPlusEp, lockedAccess, { isGuest: false, isPlus: false });
  assert.equal(freeRewardedPlus.markers.length, 2);
  assert.equal(freeRewardedPlus.markers[0]?.icon, "rewarded");
  assert.equal(freeRewardedPlus.markers[1]?.icon, "included");
});

test("getEpisodeAccessDisplay: Plus user on COINS_OR_PLUS with undefined or locked access renders marker NONE", () => {
  const coinsOrPlusEp = createMockEpisode({
    coinPrice: 10,
    coinUnlockEnabled: true,
    isFree: false,
    number: 6,
    plusAccess: true,
  });

  // access is undefined (e.g. initial render or unloaded access map)
  const displayUndefinedAccess = getEpisodeAccessDisplay(coinsOrPlusEp, undefined, { isGuest: false, isPlus: true });
  assert.equal(displayUndefinedAccess.stateKind, "included");
  assert.equal(displayUndefinedAccess.isLocked, false);
  assert.equal(displayUndefinedAccess.canPreview, false);
  assert.equal(displayUndefinedAccess.markers.length, 0);

  // access is locked (e.g. server default before token sync)
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };
  const displayLockedAccess = getEpisodeAccessDisplay(coinsOrPlusEp, lockedAccess, { isGuest: false, isPlus: true });
  assert.equal(displayLockedAccess.stateKind, "included");
  assert.equal(displayLockedAccess.isLocked, false);
  assert.equal(displayLockedAccess.canPreview, false);
  assert.equal(displayLockedAccess.markers.length, 0);
});

test("getEpisodeAccessDisplay: Plus user on REWARDED_OR_PLUS with undefined or locked access renders marker NONE", () => {
  const rewardedPlusEp = createMockEpisode({
    coinPrice: 0,
    coinUnlockEnabled: false,
    isFree: false,
    number: 7,
    plusAccess: true,
    rewardedUnlockEnabled: true,
  });

  // access is undefined
  const displayUndefinedAccess = getEpisodeAccessDisplay(rewardedPlusEp, undefined, { isGuest: false, isPlus: true });
  assert.equal(displayUndefinedAccess.stateKind, "included");
  assert.equal(displayUndefinedAccess.isLocked, false);
  assert.equal(displayUndefinedAccess.canPreview, false);
  assert.equal(displayUndefinedAccess.markers.length, 0);

  // access is locked
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };
  const displayLockedAccess = getEpisodeAccessDisplay(rewardedPlusEp, lockedAccess, { isGuest: false, isPlus: true });
  assert.equal(displayLockedAccess.stateKind, "included");
  assert.equal(displayLockedAccess.isLocked, false);
  assert.equal(displayLockedAccess.canPreview, false);
  assert.equal(displayLockedAccess.markers.length, 0);
});
