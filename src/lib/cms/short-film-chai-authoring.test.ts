import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Short Film & Chai Authoring — pure-logic unit coverage.
 *
 * These tests exercise the framework-independent helpers that back the
 * Short Film and Chai CMS authoring flows: Chai coin-amount duplicate
 * detection, positive-integer validation, and form parsing of Chai-enabled
 * state. The server-only modules (lib/cms/short-films, lib/cms/chai,
 * lib/cms/short-film-form) cannot be imported from this Node test runner
 * because of their top-level `import "server-only"` side-effect, so the
 * validation logic that lives inside server actions is covered here as
 * standalone re-implementations that mirror the exact invariants enforced
 * in src/app/admin/short-films/[id]/page.tsx (updateChaiConfigAction).
 */

/** Mirror of the validation in updateChaiConfigAction. */
function validateChaiConfigForm(formData: {
  chaiEnabled: boolean;
  amounts: Array<{ id: string; coinAmount: number; sortOrder: number; enabled: boolean }>;
}): { ok: true } | { ok: false; error: string } {
  for (const amount of formData.amounts) {
    if (!Number.isInteger(amount.coinAmount) || amount.coinAmount <= 0) {
      return { ok: false, error: "Allowed coin amounts must be positive whole numbers." };
    }
    if (!Number.isInteger(amount.sortOrder)) {
      return { ok: false, error: "Sort order must be a whole number." };
    }
  }

  const seenAmounts = new Set<number>();
  for (const amount of formData.amounts) {
    if (seenAmounts.has(amount.coinAmount)) {
      return { ok: false, error: `Duplicate Chai coin amount: ${amount.coinAmount}. Each allowed amount must be unique.` };
    }
    seenAmounts.add(amount.coinAmount);
  }

  return { ok: true };
}

/** Mirror of the chaiEnabled checkbox parsing in parseShortFilmFormData. */
function parseChaiEnabled(formEnabled: boolean): boolean {
  return Boolean(formEnabled);
}

/** Mirror of the coinAmount integer validation in the chai route. */
function validateChaiTipCoinAmount(coinAmount: unknown): boolean {
  return typeof coinAmount === "number" && Number.isInteger(coinAmount) && coinAmount > 0;
}

test("validateChaiConfigForm accepts non-duplicate positive integers", () => {
  const result = validateChaiConfigForm({
    chaiEnabled: true,
    amounts: [
      { id: "a1", coinAmount: 5, sortOrder: 10, enabled: true },
      { id: "a2", coinAmount: 10, sortOrder: 20, enabled: true },
      { id: "a3", coinAmount: 20, sortOrder: 30, enabled: true },
      { id: "a4", coinAmount: 50, sortOrder: 40, enabled: true },
    ],
  });

  assert.deepEqual(result, { ok: true });
});

test("validateChaiConfigForm rejects duplicate coin amounts", () => {
  const result = validateChaiConfigForm({
    chaiEnabled: true,
    amounts: [
      { id: "a1", coinAmount: 5, sortOrder: 10, enabled: true },
      { id: "a2", coinAmount: 5, sortOrder: 20, enabled: true },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.error,
    "Duplicate Chai coin amount: 5. Each allowed amount must be unique.",
  );
});

test("validateChaiConfigForm rejects zero coin amount", () => {
  const result = validateChaiConfigForm({
    chaiEnabled: true,
    amounts: [{ id: "a1", coinAmount: 0, sortOrder: 10, enabled: true }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "Allowed coin amounts must be positive whole numbers.");
});

test("validateChaiConfigForm rejects negative coin amount", () => {
  const result = validateChaiConfigForm({
    chaiEnabled: true,
    amounts: [{ id: "a1", coinAmount: -10, sortOrder: 10, enabled: true }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "Allowed coin amounts must be positive whole numbers.");
});

test("validateChaiConfigForm rejects non-integer coin amount", () => {
  const result = validateChaiConfigForm({
    chaiEnabled: true,
    amounts: [{ id: "a1", coinAmount: 5.5, sortOrder: 10, enabled: true }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "Allowed coin amounts must be positive whole numbers.");
});

test("validateChaiConfigForm rejects non-integer sort order", () => {
  const result = validateChaiConfigForm({
    chaiEnabled: true,
    amounts: [{ id: "a1", coinAmount: 10, sortOrder: 1.5, enabled: true }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "Sort order must be a whole number.");
});

test("parseChaiEnabled returns true when checkbox is on", () => {
  assert.equal(parseChaiEnabled(true), true);
});

test("parseChaiEnabled returns false when checkbox is off", () => {
  assert.equal(parseChaiEnabled(false), false);
});

test("validateChaiTipCoinAmount accepts valid positive integers", () => {
  assert.equal(validateChaiTipCoinAmount(5), true);
  assert.equal(validateChaiTipCoinAmount(10), true);
  assert.equal(validateChaiTipCoinAmount(50), true);
});

test("validateChaiTipCoinAmount rejects zero and negative", () => {
  assert.equal(validateChaiTipCoinAmount(0), false);
  assert.equal(validateChaiTipCoinAmount(-1), false);
});

test("validateChaiTipCoinAmount rejects non-integers and non-numbers", () => {
  assert.equal(validateChaiTipCoinAmount(5.5), false);
  assert.equal(validateChaiTipCoinAmount("5"), false);
  assert.equal(validateChaiTipCoinAmount(null), false);
  assert.equal(validateChaiTipCoinAmount(undefined), false);
});

test("validateChaiConfigForm accepts empty amounts list with chaiEnabled true", () => {
  const result = validateChaiConfigForm({
    chaiEnabled: true,
    amounts: [],
  });

  assert.deepEqual(result, { ok: true });
});

test("validateChaiConfigForm rejects duplicates across more than two entries", () => {
  const result = validateChaiConfigForm({
    chaiEnabled: true,
    amounts: [
      { id: "a1", coinAmount: 10, sortOrder: 10, enabled: true },
      { id: "a2", coinAmount: 20, sortOrder: 20, enabled: true },
      { id: "a3", coinAmount: 10, sortOrder: 30, enabled: true },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.error,
    "Duplicate Chai coin amount: 10. Each allowed amount must be unique.",
  );
});

/**
 * Mirror of the mid-roll validation branch in validateShortFilmInput
 * (lib/cms/short-films), which is server-only and therefore not importable from
 * the Node test runner. Captures the CMS-C06B rules: midroll_enabled requires
 * >=1 timecode (DB CHECK 009), timecodes must fall strictly inside the runtime,
 * and timecodes must be unique.
 */
function validateShortFilmMidroll(input: {
  midrollEnabled: boolean;
  durationSeconds: number;
  midrollTimecodes: number[];
}): { ok: true } | { ok: false; error: string } {
  for (const timecode of input.midrollTimecodes) {
    if (!Number.isInteger(timecode) || timecode < 0) {
      return { ok: false, error: "Mid-roll timecodes must be zero or positive whole numbers." };
    }
  }

  if (input.midrollEnabled && input.midrollTimecodes.length === 0) {
    return { ok: false, error: "Mid-roll timecodes are required when mid-roll is enabled." };
  }

  if (input.midrollEnabled) {
    if (!input.midrollTimecodes.every((timecode) => timecode > 0 && timecode < input.durationSeconds)) {
      return { ok: false, error: "Mid-roll timecodes must fall within the short film runtime." };
    }

    const unique = new Set(input.midrollTimecodes);
    if (unique.size !== input.midrollTimecodes.length) {
      return { ok: false, error: "Mid-roll timecodes must be unique." };
    }
  }

  return { ok: true };
}

test("mid-roll: disabled with empty timecodes is valid", () => {
  assert.deepEqual(
    validateShortFilmMidroll({
      midrollEnabled: false,
      durationSeconds: 1893,
      midrollTimecodes: [],
    }),
    { ok: true },
  );
});

test("mid-roll: enabled with no timecodes is rejected", () => {
  const result = validateShortFilmMidroll({
    midrollEnabled: true,
    durationSeconds: 1893,
    midrollTimecodes: [],
  });
  assert.equal(result.ok, false);
  assert.match(result.error!, /required when mid-roll is enabled/);
});

test("mid-roll: enabled with timecodes inside runtime and unique is accepted", () => {
  const result = validateShortFilmMidroll({
    midrollEnabled: true,
    durationSeconds: 1893,
    midrollTimecodes: [30, 75, 200],
  });
  assert.deepEqual(result, { ok: true });
});

test("mid-roll: timecode at or after runtime is rejected", () => {
  const result = validateShortFilmMidroll({
    midrollEnabled: true,
    durationSeconds: 100,
    midrollTimecodes: [100],
  });
  assert.equal(result.ok, false);
  assert.match(result.error!, /within the short film runtime/);
});

test("mid-roll: timecode of zero is rejected when enabled", () => {
  const result = validateShortFilmMidroll({
    midrollEnabled: true,
    durationSeconds: 100,
    midrollTimecodes: [0],
  });
  assert.equal(result.ok, false);
  assert.match(result.error!, /within the short film runtime/);
});

test("mid-roll: duplicate timecodes are rejected", () => {
  const result = validateShortFilmMidroll({
    midrollEnabled: true,
    durationSeconds: 1893,
    midrollTimecodes: [30, 30],
  });
  assert.equal(result.ok, false);
  assert.match(result.error!, /must be unique/);
});

test("mid-roll: negative timecode is rejected", () => {
  const result = validateShortFilmMidroll({
    midrollEnabled: true,
    durationSeconds: 1893,
    midrollTimecodes: [-5],
  });
  assert.equal(result.ok, false);
  assert.match(result.error!, /zero or positive/);
});
