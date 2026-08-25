import "server-only";

import { normalizeContentDescriptors, normalizeContentRating } from "@/lib/classification";
import type { ShortFilmInput } from "@/lib/cms/short-films";

export type ShortFilmFormState = {
  errors: Record<string, string>;
  message?: string;
};

export const initialShortFilmFormState: ShortFilmFormState = { errors: {} };

function nullableString(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length > 0 ? str : null;
}

function parseIntField(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function parsePublishAt(value: FormDataEntryValue | null) {
  const input = nullableString(value);

  if (!input) {
    return null;
  }

  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? input : new Date(parsed).toISOString();
}

function parseMidrollTimecodes(value: FormDataEntryValue | null) {
  const input = nullableString(value);

  if (!input) {
    return [];
  }

  return input
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.trunc(item));
}

export function parseShortFilmFormData(formData: FormData): ShortFilmInput {
  return {
    title: String(formData.get("title") ?? "").trim(),
    slug: String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase(),
    synopsis: nullableString(formData.get("synopsis")),
    posterUrl: null,
    heroImageUrl: null,
    creatorReference: nullableString(formData.get("creatorReference")),
    durationSeconds: parseIntField(formData.get("durationSeconds"), 0),
    language: nullableString(formData.get("language")),
    contentRating: normalizeContentRating(nullableString(formData.get("contentRating"))),
    contentDescriptors: normalizeContentDescriptors(formData.getAll("contentDescriptors").map(String)),
    status: String(formData.get("status") ?? "draft") === "published"
      ? "published"
      : String(formData.get("status") ?? "draft") === "archived"
        ? "archived"
        : "draft",
    publishAt: parsePublishAt(formData.get("publishAt")),
    midrollEnabled: formData.get("midrollEnabled") === "on",
    midrollTimecodes: parseMidrollTimecodes(formData.get("midrollTimecodes")),
    postrollEnabled: formData.get("postrollEnabled") === "on",
    chaiEnabled: formData.get("chaiEnabled") === "on",
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
