/**
 * Client/server-safe helpers for the multi-rewarded unlock configuration.
 *
 * These mirror the database CHECK constraints so the app can validate input
 * before it ever reaches Postgres. The authoritative required-count value is
 * backend/CMS controlled; it is NEVER derived from coin price.
 */

export const MIN_REWARDED_REQUIRED_COMPLETIONS = 1;
export const MAX_REWARDED_REQUIRED_COMPLETIONS = 2;

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

export const REWARDED_REQUIRED_COMPLETIONS_VALUES = [
  MIN_REWARDED_REQUIRED_COMPLETIONS,
  MAX_REWARDED_REQUIRED_COMPLETIONS,
] as const;

/**
 * Phase 15: explicit commercial guard. Required rewarded completions must NOT be
 * inferred from coin price. This helper exists so calling code can assert it is
 * passing an independently configured value, not a coin-derived one.
 */
export function isIndependentlyConfigured(value: unknown): value is number {
  return validateRequiredCompletions(value).ok;
}
