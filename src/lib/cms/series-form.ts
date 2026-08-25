import "server-only";

import {
  normalizeContentDescriptors,
  normalizeContentRating,
} from "@/lib/classification";
import type { SeriesInput } from "@/lib/cms/series";

export type SeriesFormState = {
  errors: Record<string, string>;
};

export const initialSeriesFormState: SeriesFormState = { errors: {} };

function nullableString(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length > 0 ? str : null;
}

/**
 * Shared FormData -> SeriesInput parsing used by both create and update
 * actions so the field list only has to be maintained in one place.
 *
 * poster_url/hero_image_url are intentionally left null here — artwork is
 * persisted separately by ArtworkUploadField's own action so a metadata
 * save can never accidentally wipe an existing image.
 */
export function parseSeriesFormData(formData: FormData): SeriesInput {
  const rawEpisodeCount = Number(formData.get("episodeCount"));
  const rawSortOrder = Number(formData.get("sortOrder"));

  return {
    title: String(formData.get("title") ?? "").trim(),
    slug: String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase(),
    synopsis: nullableString(formData.get("synopsis")),
    genre: nullableString(formData.get("genre")),
    language: nullableString(formData.get("language")),
    format: nullableString(formData.get("format")),
    episodeDurationLabel: nullableString(formData.get("episodeDurationLabel")),
    episodeCount: Number.isFinite(rawEpisodeCount) ? Math.trunc(rawEpisodeCount) : 0,
    posterUrl: null,
    heroImageUrl: null,
    contentRating: normalizeContentRating(nullableString(formData.get("contentRating"))),
    contentDescriptors: normalizeContentDescriptors(
      formData.getAll("contentDescriptors").map(String),
    ),
    featured: formData.get("featured") === "on",
    sortOrder: Number.isFinite(rawSortOrder) ? Math.trunc(rawSortOrder) : 0,
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
