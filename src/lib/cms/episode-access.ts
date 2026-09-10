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

export const EPISODE_ACCESS_MODES = [
  "FREE",
  "COINS",
  "PLUS",
  "COINS_OR_PLUS",
  "REWARDED_OR_PLUS",
] as const;

export type EpisodeAccessMode = (typeof EPISODE_ACCESS_MODES)[number];

export const EPISODE_ACCESS_MODE_OPTIONS: readonly {
  label: string;
  value: EpisodeAccessMode;
  description: string;
}[] = [
  {
    label: "Free",
    value: "FREE",
    description: "Free for all viewers (guests, free accounts, and Plus subscribers). No coins, ads, or Plus required.",
  },
  {
    label: "Coins",
    value: "COINS",
    description: "Pay-per-view with Coins only. Plus subscribers must also use Coins.",
  },
  {
    label: "Plus",
    value: "PLUS",
    description: "Included with 0nya Plus subscription. Free viewers must subscribe.",
  },
  {
    label: "Coins or Plus",
    value: "COINS_OR_PLUS",
    description: "Free viewers unlock with Coins; 0nya Plus subscribers get included access.",
  },
  {
    label: "Rewarded or Plus",
    value: "REWARDED_OR_PLUS",
    description: "Free viewers unlock by watching rewarded ads; 0nya Plus subscribers get included access.",
  },
];

export type EpisodeAccessFields = {
  isFree: boolean;
  coinUnlockEnabled: boolean;
  coinPrice: number;
  rewardedUnlockEnabled: boolean;
  requiredRewardedCompletions: number;
  plusAccess: boolean;
};

/**
 * Compiles an explicit EpisodeAccessMode down to existing canonical database fields.
 *
 * Enforces the Hard Exclusivity Rule and canonical field combinations:
 * - FREE: is_free=true, coin=false, price=0, rewarded=false, plus=false
 * - COINS: is_free=false, coin=true, price>0, rewarded=false, plus=false
 * - PLUS: is_free=false, coin=false, price=0, rewarded=false, plus=true
 * - COINS_OR_PLUS: is_free=false, coin=true, price>0, rewarded=false, plus=true
 * - REWARDED_OR_PLUS: is_free=false, coin=false, price=0, rewarded=true, completions>=1, plus=true
 */
export function mapAccessModeToFields(
  mode: EpisodeAccessMode,
  options: {
    coinPrice?: number;
    requiredRewardedCompletions?: number;
  } = {},
): EpisodeAccessFields {
  switch (mode) {
    case "FREE":
      return {
        isFree: true,
        coinUnlockEnabled: false,
        coinPrice: 0,
        rewardedUnlockEnabled: false,
        requiredRewardedCompletions: 1,
        plusAccess: false,
      };
    case "COINS":
      return {
        isFree: false,
        coinUnlockEnabled: true,
        coinPrice: Math.max(0, options.coinPrice ?? 0),
        rewardedUnlockEnabled: false,
        requiredRewardedCompletions: 1,
        plusAccess: false,
      };
    case "PLUS":
      return {
        isFree: false,
        coinUnlockEnabled: false,
        coinPrice: 0,
        rewardedUnlockEnabled: false,
        requiredRewardedCompletions: 1,
        plusAccess: true,
      };
    case "COINS_OR_PLUS":
      return {
        isFree: false,
        coinUnlockEnabled: true,
        coinPrice: Math.max(0, options.coinPrice ?? 0),
        rewardedUnlockEnabled: false,
        requiredRewardedCompletions: 1,
        plusAccess: true,
      };
    case "REWARDED_OR_PLUS":
      return {
        isFree: false,
        coinUnlockEnabled: false,
        coinPrice: 0,
        rewardedUnlockEnabled: true,
        requiredRewardedCompletions: Math.min(2, Math.max(1, options.requiredRewardedCompletions ?? 1)),
        plusAccess: true,
      };
  }
}

/**
 * Classifies raw episode access fields into one of the 5 locked product modes.
 * Returns null if the combination is ambiguous, invalid, or violates hard exclusivity.
 */
export function inferEpisodeAccessMode(fields: {
  isFree: boolean;
  coinUnlockEnabled: boolean;
  coinPrice?: number;
  rewardedUnlockEnabled: boolean;
  plusAccess: boolean;
}): EpisodeAccessMode | null {
  // FREE: standalone
  if (fields.isFree && !fields.coinUnlockEnabled && !fields.rewardedUnlockEnabled && !fields.plusAccess) {
    return "FREE";
  }

  // Hard exclusivity: is_free cannot be combined with ANY monetized method
  if (fields.isFree) {
    return null;
  }

  // Coins + Rewarded combination is unsupported
  if (fields.coinUnlockEnabled && fields.rewardedUnlockEnabled) {
    return null;
  }

  // COINS: coin unlock enabled without plus access
  if (fields.coinUnlockEnabled && !fields.rewardedUnlockEnabled && !fields.plusAccess) {
    return "COINS";
  }

  // PLUS: plus access enabled without coin or rewarded unlock
  if (!fields.coinUnlockEnabled && !fields.rewardedUnlockEnabled && fields.plusAccess) {
    return "PLUS";
  }

  // COINS_OR_PLUS: coin unlock enabled with plus access
  if (fields.coinUnlockEnabled && !fields.rewardedUnlockEnabled && fields.plusAccess) {
    return "COINS_OR_PLUS";
  }

  // REWARDED_OR_PLUS: rewarded unlock enabled with plus access
  if (!fields.coinUnlockEnabled && fields.rewardedUnlockEnabled && fields.plusAccess) {
    return "REWARDED_OR_PLUS";
  }

  return null;
}

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
 * Mirrors database constraints and enforces the 5 Locked Product Modes and
 * the Hard Exclusivity Rule:
 *
 *   1. FREE: is_free=true, coin=false, price=0, rewarded=false, plus=false
 *   2. COINS: is_free=false, coin=true, price>0, rewarded=false, plus=false
 *   3. PLUS: is_free=false, coin=false, price=0, rewarded=false, plus=true
 *   4. COINS_OR_PLUS: is_free=false, coin=true, price>0, rewarded=false, plus=true
 *   5. REWARDED_OR_PLUS: is_free=false, coin=false, price=0, rewarded=true, completions>=1, plus=true
 *
 * Any other authoring combination is rejected at the save boundary.
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

  // Coin price constraints
  if (input.coinUnlockEnabled && input.coinPrice <= 0) {
    errors.push({ field: "coinPrice", message: "Coin price must be greater than zero when coin unlock is enabled." });
  }

  if (!input.coinUnlockEnabled && input.coinPrice > 0) {
    errors.push({ field: "coinPrice", message: "Coin price must be 0 when coin unlock is disabled." });
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

  // HARD EXCLUSIVITY RULE: FREE is standalone.
  // If any monetized access is active, is_free MUST be false.
  if (input.isFree) {
    if (input.coinUnlockEnabled) {
      errors.push({
        field: "isFree",
        message: "Free episodes cannot enable coin unlock. Free access is standalone.",
      });
    }
    if (input.plusAccess) {
      errors.push({
        field: "isFree",
        message: "Free episodes cannot enable Plus access. Free access is standalone.",
      });
    }
    if (input.rewardedUnlockEnabled) {
      errors.push({
        field: "isFree",
        message: "Free episodes cannot enable rewarded-ad unlock. Free access is standalone.",
      });
    }
  } else {
    // Non-free must enable at least one access method
    if (!input.coinUnlockEnabled && !input.rewardedUnlockEnabled && !input.plusAccess) {
      errors.push({
        field: "access",
        message: "A non-free episode must enable at least one access method (Coins, Plus, Coins or Plus, or Rewarded or Plus).",
      });
    }
  }

  // Unsupported combination: both coin and rewarded unlock enabled
  if (input.coinUnlockEnabled && input.rewardedUnlockEnabled) {
    errors.push({
      field: "access",
      message: "Episodes cannot enable both coin unlock and rewarded unlock. Choose Coins, Plus, Coins or Plus, or Rewarded or Plus.",
    });
  }

  // Unsupported combination: rewarded unlock without Plus access
  if (input.rewardedUnlockEnabled && !input.plusAccess) {
    errors.push({
      field: "plusAccess",
      message: "Rewarded-ad unlock requires Plus access to be enabled (Rewarded or Plus mode).",
    });
  }

  // Validate that the combination maps to one of the 5 locked product modes
  if (errors.length === 0 && inferEpisodeAccessMode(input) === null) {
    errors.push({
      field: "access",
      message: "Unsupported access mode combination. Exactly 5 modes are allowed: Free, Coins, Plus, Coins or Plus, Rewarded or Plus.",
    });
  }

  return errors;
}
