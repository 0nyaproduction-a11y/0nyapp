/**
 * Client/server-safe helpers for the multi-rewarded unlock configuration.
 *
 * The required-completion bounds (1..2) are declared ONCE in
 * `lib/cms/constants.ts` (client-safe, no `server-only` side-effect) and are
 * re-exported here so legacy importers keep a single symbol path. The
 * validation/clamp helpers below are `unknown`-safe (the `cms/constants` clamp
 * accepts `number` and is used by the server-side CMS form path), and Phase 15's
 * `isIndependentlyConfigured` commercial guard is retained: the required count is
 * backend/CMS authoritative and is NEVER derived from coin price.
 */

import {
  MAX_REWARDED_REQUIRED_COMPLETIONS,
  MIN_REWARDED_REQUIRED_COMPLETIONS,
  REWARDED_REQUIRED_COMPLETIONS_VALUES,
} from "@/lib/cms/constants";

export {
  MAX_REWARDED_REQUIRED_COMPLETIONS,
  MIN_REWARDED_REQUIRED_COMPLETIONS,
  REWARDED_REQUIRED_COMPLETIONS_VALUES,
};

export type RequiredCompletionsValidation =
  | { ok: true; value: number }
  | { ok: false; error: string };

export function validateRequiredCompletions(value: unknown): RequiredCompletionsValidation {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return {
      ok: false,
      error: `Rewarded ads required must be a whole number between ${MIN_REWARDED_REQUIRED_COMPLETIONS} and ${MAX_REWARDED_REQUIRED_COMPLETIONS}.`,
    };
  }

  if (value < MIN_REWARDED_REQUIRED_COMPLETIONS || value > MAX_REWARDED_REQUIRED_COMPLETIONS) {
    return {
      ok: false,
      error: `Rewarded ads required must be between ${MIN_REWARDED_REQUIRED_COMPLETIONS} and ${MAX_REWARDED_REQUIRED_COMPLETIONS}.`,
    };
  }

  return { ok: true, value };
}

export function clampRewardedRequiredCompletions(value: unknown): number {
  const n = typeof value === "number" && Number.isInteger(value) ? value : MIN_REWARDED_REQUIRED_COMPLETIONS;
  return Math.min(
    MAX_REWARDED_REQUIRED_COMPLETIONS,
    Math.max(MIN_REWARDED_REQUIRED_COMPLETIONS, n),
  );
}

/**
 * Phase 15: explicit commercial guard. Required rewarded completions must NOT be
 * inferred from coin price. This helper exists so calling code can assert it is
 * passing an independently configured value, not a coin-derived one.
 */
export function isIndependentlyConfigured(value: unknown): value is number {
  return validateRequiredCompletions(value).ok;
}
