import "server-only";

import {
  normalizeContentDescriptors,
  normalizeContentRating,
} from "@/lib/classification";
import type { EpisodeInput } from "@/lib/cms/episodes";

export type EpisodeFormState = {
  errors: Record<string, string>;
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
  return {
    episodeNumber: parseIntField(formData.get("episodeNumber"), 0),
    title: nullableString(formData.get("title")),
    synopsis: nullableString(formData.get("synopsis")),
    durationSeconds: parseIntField(formData.get("durationSeconds"), 0),
    thumbnailUrl: currentThumbnailUrl,
    isFree: formData.get("isFree") === "on",
    coinPrice: parseIntField(formData.get("coinPrice"), 0),
    coinUnlockEnabled: formData.get("coinUnlockEnabled") === "on",
    rewardedUnlockEnabled: formData.get("rewardedUnlockEnabled") === "on",
    rewardedAccessMode:
      formData.get("rewardedAccessMode") === "session" ? "session" : "permanent",
    plusAccess: formData.get("plusAccess") === "on",
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
