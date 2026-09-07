import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * CMS-C06 — Episode Access Configuration validation.
 *
 * `lib/cms/episode-access` is the framework-free source of truth for episode
 * monetization/access validation. The server-only CMS write path
 * (`lib/cms/episodes` -> `validateEpisodeInput`) delegates here, so the Node
 * test runner locks the exact rules the admin save flows apply:
 *
 *   - coin unlock requires a positive coin price (episodes_coin_unlock_requires_price)
 *   - locked preview seconds are bounded 0..5 (006 migration check)
 *   - rewarded required completions are bounded 1..2 (027 migration check)
 *   - rewarded access mode is launch permanent-only (CMS policy)
 *   - content rating/descriptor overrides must be valid vocabulary
 */

import type { ContentDescriptor, ContentRating } from "@/lib/classification";
import {
  validateEpisodeAccessInput,
  type EpisodeAccessInput,
} from "@/lib/cms/episode-access";

function validInput(overrides: Partial<EpisodeAccessInput> = {}): EpisodeAccessInput {
  return {
    episodeNumber: 1,
    title: "Episode 1",
    synopsis: null,
    durationSeconds: 600,
    thumbnailUrl: null,
    isFree: false,
    coinPrice: 10,
    coinUnlockEnabled: true,
    rewardedUnlockEnabled: false,
    rewardedAccessMode: "permanent",
    requiredRewardedCompletions: 1,
    plusAccess: true,
    lockedPreviewSeconds: 0,
    contentRatingOverride: null,
    contentDescriptorsOverride: [],
    ...overrides,
  };
}

function fields(errors: { field: string }[]) {
  return errors.map((error) => error.field);
}

// ---------------------------------------------------------------------------
// EPISODES — free | coin | rewarded | Plus | locked-state config
// ---------------------------------------------------------------------------

test("a fully valid episode access configuration passes clean", () => {
  const errors = validateEpisodeAccessInput(validInput());
  assert.deepEqual(errors, []);
});

test("free plus interactive access methods remain a valid combination", () => {
  const errors = validateEpisodeAccessInput(
    validInput({
      isFree: true,
      coinUnlockEnabled: true,
      coinPrice: 10,
      rewardedUnlockEnabled: true,
      requiredRewardedCompletions: 2,
      plusAccess: true,
    }),
  );
  // Free is allowed alongside other methods; the purchase/entitlement RPCs
  // short-circuit free episodes to already_accessible, so nothing is invalid.
  assert.deepEqual(errors, []);
});

test("episode number must be a positive whole number", () => {
  assert.ok(fields(validateEpisodeAccessInput(validInput({ episodeNumber: 0 }))).includes("episodeNumber"));
  assert.ok(fields(validateEpisodeAccessInput(validInput({ episodeNumber: -3 }))).includes("episodeNumber"));
  assert.ok(fields(validateEpisodeAccessInput(validInput({ episodeNumber: 1.5 }))).includes("episodeNumber"));
});

test("duration must be zero or a positive whole number", () => {
  assert.ok(fields(validateEpisodeAccessInput(validInput({ durationSeconds: -1 }))).includes("durationSeconds"));
  assert.ok(fields(validateEpisodeAccessInput(validInput({ durationSeconds: 1.5 }))).includes("durationSeconds"));
  assert.deepEqual(validateEpisodeAccessInput(validInput({ durationSeconds: 0 })), []);
});
// ---------------------------------------------------------------------------
// COINS — unlock cost | zero/negative handling
// ---------------------------------------------------------------------------

test("coin price zero or negative is rejected", () => {
  assert.ok(fields(validateEpisodeAccessInput(validInput({ coinPrice: -1 }))).includes("coinPrice"));
  assert.ok(fields(validateEpisodeAccessInput(validInput({ coinPrice: 10.5 }))).includes("coinPrice"));
});

test("coin unlock enabled with a zero priced episode is rejected", () => {
  const errors = validateEpisodeAccessInput(validInput({ coinPrice: 0, coinUnlockEnabled: true }));
  assert.ok(fields(errors).includes("coinPrice"));
  assert.match(
    errors.find((error) => error.field === "coinPrice")!.message,
    /greater than zero when coin unlock is enabled/,
  );
});

test("coin unlock disabled permits a zero coin price", () => {
  assert.deepEqual(
    validateEpisodeAccessInput(validInput({ coinPrice: 0, coinUnlockEnabled: false })),
    [],
  );
});

test("coin unlock enabled with a positive price passes", () => {
  assert.deepEqual(
    validateEpisodeAccessInput(validInput({ coinPrice: 20, coinUnlockEnabled: true })),
    [],
  );
});

// ---------------------------------------------------------------------------
// REWARDED — eligibility | required completions | bounds
// ---------------------------------------------------------------------------

test("rewarded required completions below 1 or above 2 are rejected", () => {
  for (const bad of [0, 3, 4, -1, 1.5]) {
    const errors = validateEpisodeAccessInput(
      validInput({ rewardedUnlockEnabled: true, requiredRewardedCompletions: bad }),
    );
    assert.ok(fields(errors).includes("requiredRewardedCompletions"), `expected ${bad} to be rejected`);
  }
});

test("rewarded required completions 1 and 2 pass", () => {
  for (const good of [1, 2]) {
    assert.deepEqual(
      validateEpisodeAccessInput(validInput({ rewardedUnlockEnabled: true, requiredRewardedCompletions: good })),
      [],
    );
  }
});

test("rewarded access mode is permanent-only at launch (session-mode attempts rejected)", () => {
  const invalidSessionMode = {
    ...validInput({ rewardedUnlockEnabled: true }),
    rewardedAccessMode: "session" as unknown as EpisodeAccessInput["rewardedAccessMode"],
  };
  const errors = validateEpisodeAccessInput(
    invalidSessionMode as unknown as EpisodeAccessInput,
  );
  assert.ok(fields(errors).includes("rewardedAccessMode"));
});

test("rewarded completions are independent of coin price (never derived)", () => {
  // Regardless of coin price, rewarded config stands alone.
  assert.deepEqual(
    validateEpisodeAccessInput(
      validInput({
        coinPrice: 0,
        coinUnlockEnabled: false,
        rewardedUnlockEnabled: true,
        requiredRewardedCompletions: 2,
      }),
    ),
    [],
  );
});

// ---------------------------------------------------------------------------
// PLUS — subscription gate configuration
// ---------------------------------------------------------------------------

test("plusAccess is a boolean flag; disabling it stays valid", () => {
  assert.deepEqual(validateEpisodeAccessInput(validInput({ plusAccess: false })), []);
});

// ---------------------------------------------------------------------------
// LOCKED-STATE config — locked preview seconds
// ---------------------------------------------------------------------------

test("locked preview seconds are bounded 0..5 (mirrors 006 check updated to 5s)", () => {
  for (const bad of [-1, 6, 7, 1.5]) {
    const errors = validateEpisodeAccessInput(validInput({ lockedPreviewSeconds: bad }));
    assert.ok(fields(errors).includes("lockedPreviewSeconds"), `expected ${bad} to be rejected`);
  }
  for (const good of [0, 1, 2, 3, 4, 5]) {
    assert.deepEqual(validateEpisodeAccessInput(validInput({ lockedPreviewSeconds: good })), []);
  }
});

// ---------------------------------------------------------------------------
// SERIES inheritance overrides — content classification vocabulary
// ---------------------------------------------------------------------------

test("content rating override must be valid vocabulary when set", () => {
  const errors = validateEpisodeAccessInput(
    validInput({ contentRatingOverride: "X-Rated" as ContentRating }),
  );
  assert.ok(fields(errors).includes("contentRatingOverride"));
});

test("null content rating override (inherit from series) passes", () => {
  assert.deepEqual(validateEpisodeAccessInput(validInput({ contentRatingOverride: null })), []);
});

test("content descriptor overrides must be valid vocabulary", () => {
  const errors = validateEpisodeAccessInput(
    validInput({ contentDescriptorsOverride: ["language", "made-up" as ContentDescriptor] }),
  );
  assert.ok(fields(errors).includes("contentDescriptorsOverride"));
});

test("empty content descriptor overrides (inherit from series) pass", () => {
  assert.deepEqual(validateEpisodeAccessInput(validInput({ contentDescriptorsOverride: [] })), []);
});

// ---------------------------------------------------------------------------
// Invalid combination guard — every failure path is reported explicitly
// ---------------------------------------------------------------------------

test("invalid combinations surface every field with a message", () => {
  const errors = validateEpisodeAccessInput(
    validInput({
      episodeNumber: -1,
      durationSeconds: -5,
      coinPrice: -1,
      coinUnlockEnabled: true,
      rewardedUnlockEnabled: true,
      requiredRewardedCompletions: 9,
      rewardedAccessMode: "permanent",
      lockedPreviewSeconds: 9,
    }),
  );

  const errorFields = fields(errors);
  for (const expected of [
    "episodeNumber",
    "durationSeconds",
    "coinPrice",
    "requiredRewardedCompletions",
    "lockedPreviewSeconds",
  ]) {
    assert.ok(errorFields.includes(expected), `expected ${expected} in ${errorFields.join(",")}`);
  }

  for (const error of errors) {
    assert.ok(error.message.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Combination guard — non-free episode must expose at least one access method
// (mirrors the CMS-C06 rule; server stays fail-closed regardless)
// ---------------------------------------------------------------------------

test("non-free episode with no unlock method is rejected (combination guard)", () => {
  const errors = validateEpisodeAccessInput(
    validInput({
      isFree: false,
      coinPrice: 0,
      coinUnlockEnabled: false,
      rewardedUnlockEnabled: false,
      plusAccess: false,
    }),
  );
  assert.ok(fields(errors).includes("access"));
  assert.match(
    errors.find((error) => error.field === "access")!.message,
    /at least one access method/,
  );
});

test("non-free episode with exactly one unlock method is accepted", () => {
  const base = {
    isFree: false,
    coinPrice: 0,
    coinUnlockEnabled: false,
    rewardedUnlockEnabled: false,
    plusAccess: false,
  };

  // coin unlock only
  assert.deepEqual(
    validateEpisodeAccessInput(validInput({ ...base, coinUnlockEnabled: true, coinPrice: 10 })),
    [],
  );
  // rewarded unlock only
  assert.deepEqual(
    validateEpisodeAccessInput(validInput({ ...base, rewardedUnlockEnabled: true })),
    [],
  );
  // Plus only
  assert.deepEqual(
    validateEpisodeAccessInput(validInput({ ...base, plusAccess: true })),
    [],
  );
});

test("free episode with no unlock methods is accepted (always accessible)", () => {
  const errors = validateEpisodeAccessInput(
    validInput({
      isFree: true,
      coinPrice: 0,
      coinUnlockEnabled: false,
      rewardedUnlockEnabled: false,
      plusAccess: false,
    }),
  );
  assert.deepEqual(errors, []);
});
