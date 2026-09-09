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
  assert.equal(guestDisplay.stateKind, "free");
  assert.equal(guestDisplay.markers[0]?.icon, "free");
  assert.equal(guestDisplay.markers[0]?.accessibilityLabel, "Free");

  // Free signed-in user
  const freeUserResult = resolveEpisodeAccess(freeEpisode, lockedAccess, { isGuest: false });
  assert.equal(freeUserResult, "free");

  // Plus user
  const plusUserResult = resolveEpisodeAccess(freeEpisode, lockedAccess, { isGuest: false });
  assert.equal(plusUserResult, "free");
});

test("resolveEpisodeAccess: Guest on non-free released episode resolves to preview", () => {
  const paidEpisode = createMockEpisode({ isFree: false, number: 5, coinPrice: 15 });
  const lockedAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Locked" };

  const result = resolveEpisodeAccess(paidEpisode, lockedAccess, { isGuest: true });
  assert.equal(result, "preview");

  const display = getEpisodeAccessDisplay(paidEpisode, lockedAccess, { isGuest: true });
  assert.equal(display.label, "Preview");
  assert.equal(display.isLocked, true);
  assert.equal(display.markers[0]?.icon, "preview");
  assert.equal(display.markers[0]?.accessibilityLabel, "Preview");
  assert.equal(display.markers[0]?.tone, "muted");
});

test("resolveEpisodeAccess: Signed-in user with Coin unlock resolves to unlocked", () => {
  const paidEpisode = createMockEpisode({ isFree: false, number: 4 });
  const ownedAccess: EpisodeAccess = { canWatch: true, kind: "owned", label: "Owned" };

  const result = resolveEpisodeAccess(paidEpisode, ownedAccess, { isGuest: false });
  assert.equal(result, "unlocked");

  const display = getEpisodeAccessDisplay(paidEpisode, ownedAccess, { isGuest: false });
  assert.equal(display.label, "Unlocked");
  assert.equal(display.isLocked, false);
  assert.equal(display.stateKind, "unlocked");
  assert.equal(display.markers[0]?.icon, "unlocked");
  assert.equal(display.markers[0]?.accessibilityLabel, "Unlocked");
  assert.equal(display.markers[0]?.tone, "unlocked");
});

test("resolveEpisodeAccess: Signed-in Plus user with Plus inclusion resolves to included", () => {
  const plusEpisode = createMockEpisode({ isFree: false, number: 8, plusAccess: true });
  const includedAccess: EpisodeAccess = { canWatch: true, kind: "included", label: "Included" };

  const result = resolveEpisodeAccess(plusEpisode, includedAccess, { isGuest: false });
  assert.equal(result, "included");

  const display = getEpisodeAccessDisplay(plusEpisode, includedAccess, { isGuest: false });
  assert.equal(display.label, "Included");
  assert.equal(display.isLocked, false);
  assert.equal(display.stateKind, "included");
  assert.equal(display.markers[0]?.icon, "included");
  assert.equal(display.markers[0]?.accessibilityLabel, "Included");
  assert.equal(display.markers[0]?.tone, "included");
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
  assert.equal(display.stateKind, "coin_required");
  assert.equal(display.markers[0]?.tone, "coin");
  assert.equal(display.markers[0]?.icon, "coin");
  assert.equal(display.markers[0]?.label, "20");
  assert.equal(display.markers[0]?.accessibilityLabel, "20 Coins");
});

test("resolveEpisodeAccess: Genuinely unavailable episode resolves to unavailable", () => {
  const unavailableEpisode = createMockEpisode({ isFree: false, number: 99 });
  const unavailableAccess: EpisodeAccess = { canWatch: false, kind: "locked", label: "Unavailable" };

  const result = resolveEpisodeAccess(unavailableEpisode, unavailableAccess, { isGuest: false });
  assert.equal(result, "unavailable");

  const display = getEpisodeAccessDisplay(unavailableEpisode, unavailableAccess, { isGuest: false });
  assert.equal(display.label, "Unavailable");
  assert.equal(display.isLocked, true);
  assert.equal(display.stateKind, "unavailable");
  assert.equal(display.markers[0]?.icon, "unavailable");
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
  assert.equal(resolveEpisodeAccess(ep1, lockedAccess, { isGuest: true }), "preview");

  // Episode 20 must be free because CMS isFree is true
  assert.equal(resolveEpisodeAccess(ep20, lockedAccess, { isGuest: false }), "free");
  assert.equal(resolveEpisodeAccess(ep20, lockedAccess, { isGuest: true }), "free");
});
