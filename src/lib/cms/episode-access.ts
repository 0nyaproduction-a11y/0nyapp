import {
  CONTENT_DESCRIPTORS,
  CONTENT_RATINGS,
  type ContentDescriptor,
  type ContentRating,
} from "@/lib/classification";
import {
  MAX_REWARDED_REQUIRED_COMPLETIONS,
  MIN_REWARDED_REQUIRED_COMPLETIONS,
  REWARDED_ACCESS_MODES,
  type RewardedAccessMode,
} from "@/lib/cms/constants";

// Matches episodes_preview_seconds check (locked_preview_seconds between 0
// and 5) added in migration 006_episode_access_controls.
const MIN_LOCKED_PREVIEW_SECONDS = 0;
const MAX_LOCKED_PREVIEW_SECONDS = 5;

/**
 * Episode access configuration input — framework-free so it can be shared
 * between the server-only CMS module (lib/cms/episodes) and pure unit tests.
 *
 * Server-only modules (lib/cms/episodes) must not be imported by the Node
 * test runner because of their top-level `import "server-only"` side-effect.
 * This module carries no such side-effect, so the exact validation the CMS
 * write paths apply can be exercised directly in tests.
 */
export type EpisodeAccessInput = {
  episodeNumber: number;
  title: string | null;
  synopsis: string | null;
  durationSeconds: number;
  thumbnailUrl: string | null;
  isFree: boolean;
  coinPrice: number;
  coinUnlockEnabled: boolean;
  rewardedUnlockEnabled: boolean;
  rewardedAccessMode: RewardedAccessMode;
  requiredRewardedCompletions: number;
  plusAccess: boolean;
  lockedPreviewSeconds: number;
  contentRatingOverride: ContentRating | null;
  contentDescriptorsOverride: ContentDescriptor[];
};

export type EpisodeAccessValidationError = { field: string; message: string };

/**
 * Pure validation of episode access configuration.
 *
 * Mirrors the database CHECK constraints so the admin gets an immediate,
 * friendly error instead of a raw DB failure. The authoritative value is
 * backend/CMS controlled; it is NEVER derived from coin price.
 *
 * Rules enforced:
 *   - coin_price must be >= 0
 *   - coin_unlock_enabled requires coin_price > 0 (mirrors episodes_coin_unlock_requires_price)
 *   - rewarded_access_mode must be in the allowed set (launch = permanent-only)
 *   - required_rewarded_completions must be 1 or 2 (launch bounds)
 *   - locked_preview_seconds must be between 0 and 5
 *   - content_rating_override must be a valid rating (if set)
 *   - content_descriptors_override entries must be valid descriptors
 */
export function validateEpisodeAccessInput(
  input: EpisodeAccessInput,
): EpisodeAccessValidationError[] {
  const errors: EpisodeAccessValidationError[] = [];

  if (!Number.isInteger(input.episodeNumber) || input.episodeNumber <= 0) {
    errors.push({ field: "episodeNumber", message: "Episode number must be a positive whole number." });
  }

  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 0) {
    errors.push({ field: "durationSeconds", message: "Duration must be zero or a positive whole number of seconds." });
  }

  if (!Number.isInteger(input.coinPrice) || input.coinPrice < 0) {
    errors.push({ field: "coinPrice", message: "Coin price must be zero or a positive whole number." });
  }

  // Mirrors the DB constraint episodes_coin_unlock_requires_price.
  if (input.coinUnlockEnabled && input.coinPrice <= 0) {
    errors.push({ field: "coinPrice", message: "Coin price must be greater than zero when coin unlock is enabled." });
  }

  if (!(REWARDED_ACCESS_MODES as readonly RewardedAccessMode[]).includes(input.rewardedAccessMode)) {
    errors.push({ field: "rewardedAccessMode", message: "Unsupported rewarded access mode." });
  }

  if (
    !Number.isInteger(input.requiredRewardedCompletions) ||
    input.requiredRewardedCompletions < MIN_REWARDED_REQUIRED_COMPLETIONS ||
    input.requiredRewardedCompletions > MAX_REWARDED_REQUIRED_COMPLETIONS
  ) {
    errors.push({
      field: "requiredRewardedCompletions",
      message: `Rewarded ads required must be between ${MIN_REWARDED_REQUIRED_COMPLETIONS} and ${MAX_REWARDED_REQUIRED_COMPLETIONS}.`,
    });
  }

  if (
    !Number.isInteger(input.lockedPreviewSeconds) ||
    input.lockedPreviewSeconds < MIN_LOCKED_PREVIEW_SECONDS ||
    input.lockedPreviewSeconds > MAX_LOCKED_PREVIEW_SECONDS
  ) {
    errors.push({
      field: "lockedPreviewSeconds",
      message: `Locked preview seconds must be between ${MIN_LOCKED_PREVIEW_SECONDS} and ${MAX_LOCKED_PREVIEW_SECONDS}.`,
    });
  }

  if (input.contentRatingOverride && !CONTENT_RATINGS.includes(input.contentRatingOverride)) {
    errors.push({ field: "contentRatingOverride", message: "Unsupported content rating override." });
  }

  for (const descriptor of input.contentDescriptorsOverride) {
    if (!CONTENT_DESCRIPTORS.includes(descriptor)) {
      errors.push({
        field: "contentDescriptorsOverride",
        message: `Unsupported content descriptor: ${descriptor}.`,
      });
      break;
    }
  }

  // Combination guard (mirrors the product rule): a non-free episode must expose
  // at least one unlock path. The server stays fail-closed (access_required)
  // regardless, but the editor should not silently publish an inaccessible,
  // non-free episode with no configured method. Free episodes are always valid
  // alongside any combination of interactive methods.
  if (
    !input.isFree &&
    !input.coinUnlockEnabled &&
    !input.rewardedUnlockEnabled &&
    !input.plusAccess
  ) {
    errors.push({
      field: "access",
      message:
        "A non-free episode must enable at least one access method (Coin unlock, Rewarded-ad unlock, or Plus).",
    });
  }

  return errors;
}
