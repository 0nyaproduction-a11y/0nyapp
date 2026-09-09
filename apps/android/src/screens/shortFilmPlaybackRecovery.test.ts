// @ts-expect-error node:test resolves at runtime via tsx; see authReturnIntent.test.ts.
import { test } from "node:test";
// @ts-expect-error see note above for node:assert/strict
import assert from "node:assert/strict";
import {
  getShortFilmPlaybackRecoveryConfig,
  type ShortFilmPlaybackRecoveryConfig,
} from "./shortFilmPlaybackRecovery";

function expectRecovery(
  status: Parameters<typeof getShortFilmPlaybackRecoveryConfig>[0],
  expected: ShortFilmPlaybackRecoveryConfig,
) {
  const actual = getShortFilmPlaybackRecoveryConfig(status);
  assert.deepEqual(actual, expected, `recovery config for "${status}"`);
}

test("parental_required returns a restrained recoverable config with Unlock + Back", () => {
  expectRecovery("parental_required", {
    title: "Parental controls required",
    body: "This short film is locked by parental controls. Unlock it to continue.",
    primaryActionLabel: "Unlock",
    secondaryActionLabel: "Back",
  });
});

test("access_required returns a restrained recoverable config with Retry + Back", () => {
  expectRecovery("access_required", {
    title: "Playback unavailable",
    body: "This short film can't be played right now.",
    primaryActionLabel: "Retry",
    secondaryActionLabel: "Back",
  });
});

test("every recovery config exposes a Back secondary action", () => {
  const statuses = ["parental_required", "access_required"] as const;
  for (const status of statuses) {
    const config = getShortFilmPlaybackRecoveryConfig(status);
    if (config === null) {
      throw new Error(`expected a config for "${status}"`);
    }
    assert.equal(
      config.secondaryActionLabel,
      "Back",
      `"${status}" must provide a Back secondary action`,
    );
  }
});

test("ok status returns null (normal playback is unaffected)", () => {
  assert.equal(getShortFilmPlaybackRecoveryConfig("ok"), null);
});

test("unrelated non-ok statuses return null (not handled here)", () => {
  for (const status of [
    "not_found",
    "age_verification_required",
    "media_not_ready",
    "playback_unavailable",
  ] as const) {
    assert.equal(
      getShortFilmPlaybackRecoveryConfig(status),
      null,
      `"${status}" should not be handled by short-film recovery`,
    );
  }
});
