import "server-only";

import {
  normalizeContentDescriptors,
  normalizeContentRating,
} from "@/lib/classification";
import type { EpisodeInput } from "@/lib/cms/episodes";
import {
  EPISODE_ACCESS_MODES,
  mapAccessModeToFields,
  type EpisodeAccessFields,
  type EpisodeAccessMode,
} from "@/lib/cms/episode-access";

export type EpisodeFormState = {
  errors: Record<string, string>;
  submittedAt?: number;
  submitMode?: string;
};

export const initialEpisodeFormState: EpisodeFormState = { errors: {} };

function nullableString(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length > 0 ? str : null;
}

function parseIntField(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

/**
 * Shared FormData -> EpisodeInput parsing used by both create and update
 * actions. thumbnail_url is left out of general form parsing — it is
 * persisted separately by ArtworkUploadField's own action, mirroring the
 * series poster/hero pattern, so a metadata save never wipes an existing
 * thumbnail.
 */
export function parseEpisodeFormData(formData: FormData, currentThumbnailUrl: string | null): EpisodeInput {
  const rawAccessMode = formData.get("accessMode");
  const accessMode =
    typeof rawAccessMode === "string" && (EPISODE_ACCESS_MODES as readonly string[]).includes(rawAccessMode)
      ? (rawAccessMode as EpisodeAccessMode)
      : null;

  const rawCoinPrice = parseIntField(formData.get("coinPrice"), 0);
  const rawRequiredRewardedCompletions = (() => {
    const raw = parseIntField(formData.get("requiredRewardedCompletions"), 1);
    return Math.min(2, Math.max(1, Number.isFinite(raw) ? Math.trunc(raw) : 1));
  })();

  let accessFields: EpisodeAccessFields;

  if (accessMode) {
    accessFields = mapAccessModeToFields(accessMode, {
      coinPrice: rawCoinPrice,
      requiredRewardedCompletions: rawRequiredRewardedCompletions,
    });
  } else {
    // Fallback for direct or compatibility calls without accessMode parameter
    accessFields = {
      isFree: formData.get("isFree") === "on",
      coinUnlockEnabled: formData.get("coinUnlockEnabled") === "on",
      coinPrice: rawCoinPrice,
      rewardedUnlockEnabled: formData.get("rewardedUnlockEnabled") === "on",
      requiredRewardedCompletions: rawRequiredRewardedCompletions,
      plusAccess: formData.get("plusAccess") === "on",
    };
  }

  return {
    episodeNumber: parseIntField(formData.get("episodeNumber"), 0),
    title: nullableString(formData.get("title")),
    synopsis: nullableString(formData.get("synopsis")),
    durationSeconds: parseIntField(formData.get("durationSeconds"), 0),
    thumbnailUrl: currentThumbnailUrl,
    isFree: accessFields.isFree,
    coinPrice: accessFields.coinPrice,
    coinUnlockEnabled: accessFields.coinUnlockEnabled,
    rewardedUnlockEnabled: accessFields.rewardedUnlockEnabled,
    rewardedAccessMode: "permanent",
    requiredRewardedCompletions: accessFields.requiredRewardedCompletions,
    plusAccess: accessFields.plusAccess,
    lockedPreviewSeconds: parseIntField(formData.get("lockedPreviewSeconds"), 0),
    contentRatingOverride: normalizeContentRating(nullableString(formData.get("contentRatingOverride"))),
    contentDescriptorsOverride: normalizeContentDescriptors(
      formData.getAll("contentDescriptorsOverride").map(String),
    ),
  };
}

export function errorsToRecord(errors: { field: string; message: string }[]) {
  const record: Record<string, string> = {};

  for (const error of errors) {
    if (!record[error.field]) {
      record[error.field] = error.message;
    }
  }

  return record;
}
