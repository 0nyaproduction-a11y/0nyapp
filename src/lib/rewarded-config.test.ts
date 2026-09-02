import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateRequiredCompletions,
  clampRewardedRequiredCompletions,
  isIndependentlyConfigured,
  MAX_REWARDED_REQUIRED_COMPLETIONS,
  MIN_REWARDED_REQUIRED_COMPLETIONS,
} from "./rewarded-config.ts";

test("required completions: 1 and 2 are valid launch values", () => {
  assert.equal(validateRequiredCompletions(1).ok, true);
  assert.equal(validateRequiredCompletions(2).ok, true);
});

test("required completions: 0, 3, 4, negative, null, fractions rejected", () => {
  for (const bad of [0, 3, 4, -1, null, 1.5, "2", undefined]) {
    const result = validateRequiredCompletions(bad);
    assert.equal(result.ok, false, `expected ${JSON.stringify(bad)} to be invalid`);
  }
});

test("required completions: range constants match launch policy", () => {
  assert.equal(MIN_REWARDED_REQUIRED_COMPLETIONS, 1);
  assert.equal(MAX_REWARDED_REQUIRED_COMPLETIONS, 2);
});

test("clamp keeps values inside 1..2", () => {
  assert.equal(clampRewardedRequiredCompletions(0), 1);
  assert.equal(clampRewardedRequiredCompletions(1), 1);
  assert.equal(clampRewardedRequiredCompletions(2), 2);
  assert.equal(clampRewardedRequiredCompletions(3), 2);
  assert.equal(clampRewardedRequiredCompletions("x"), 1);
});

test("isIndependentlyConfigured matches validation", () => {
  assert.equal(isIndependentlyConfigured(2), true);
  assert.equal(isIndependentlyConfigured(5), false);
});
