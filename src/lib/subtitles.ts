import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const SUBTITLE_BUCKET_ID = "content-subtitles" as const;

export const SUBTITLE_SOURCE_FORMATS = ["srt", "vtt"] as const;
export const SUBTITLE_STATUS_VALUES = [
  "pending",
  "processing",
  "ready",
  "failed",
  "deleted",
] as const;

export const SUBTITLE_MIME_TYPES = [
  "application/x-subrip",
  "text/plain",
  "text/vtt",
] as const;

export type SubtitleSourceFormat = (typeof SUBTITLE_SOURCE_FORMATS)[number];
export type SubtitleStatus = (typeof SUBTITLE_STATUS_VALUES)[number];
export type SubtitleMimeType = (typeof SUBTITLE_MIME_TYPES)[number];

export type SubtitleTarget =
  | {
      type: "SERIES_EPISODE";
      episodeNumber: number;
      seriesSlug: string;
    }
  | {
      type: "SHORT_FILM";
      slug: string;
    };

type SubtitleContentTarget = {
  contentId: string;
  mediaAssetId: string | null;
  targetType: SubtitleTarget["type"];
};

function getSubtitleMimeType(sourceFormat: SubtitleSourceFormat, mimeType: string): SubtitleMimeType {
  const normalizedMimeType = mimeType.trim().toLowerCase().split(";", 1)[0];

  if (!normalizedMimeType) {
    throw new Error("Missing subtitle MIME type.");
  }

  if (sourceFormat === "vtt") {
    if (normalizedMimeType === "text/vtt") {
      return normalizedMimeType;
    }

    throw new Error("Unsupported subtitle MIME type for WebVTT.");
  }

  if (normalizedMimeType === "application/x-subrip" || normalizedMimeType === "text/plain") {
    return normalizedMimeType;
  }

  throw new Error("Unsupported subtitle MIME type for SRT.");
}

function getSubtitleLanguageCode(languageCode: string) {
  const trimmed = languageCode.trim();

  if (!trimmed) {
    throw new Error("Missing subtitle language code.");
  }

  const [normalized] = Intl.getCanonicalLocales(trimmed);

  if (!normalized) {
    throw new Error("Invalid subtitle language code.");
  }

  return normalized;
}

function normalizeSubtitleLabel(label: string) {
  const trimmed = label.trim();

  if (!trimmed) {
    throw new Error("Missing subtitle label.");
  }

  return trimmed;
}

async function resolveSubtitleTarget(target: SubtitleTarget) {
  const supabase = createAdminClient();

  if (target.type === "SERIES_EPISODE") {
    const { data: series, error: seriesError } = await supabase
      .from("series")
      .select("id")
      .eq("slug", target.seriesSlug)
      .maybeSingle();

    if (seriesError || !series) {
      throw new Error("Series not found.");
    }

    const { data: episode, error: episodeError } = await supabase
      .from("episodes")
      .select("id,media_asset_id")
      .eq("series_id", series.id)
      .eq("episode_number", target.episodeNumber)
      .maybeSingle();

    if (episodeError || !episode) {
      throw new Error("Episode not found.");
    }

    return {
      contentId: episode.id,
      mediaAssetId: episode.media_asset_id,
      targetType: target.type,
    } satisfies SubtitleContentTarget;
  }

  const { data: shortFilm, error: shortFilmError } = await supabase
    .from("short_films")
    .select("id,media_asset_id")
    .eq("slug", target.slug)
    .maybeSingle();

  if (shortFilmError || !shortFilm) {
    throw new Error("Short film not found.");
  }

  return {
    contentId: shortFilm.id,
    mediaAssetId: shortFilm.media_asset_id,
    targetType: target.type,
  } satisfies SubtitleContentTarget;
}

function buildSubtitleObjectPath(
  target: SubtitleContentTarget,
  sourceFormat: SubtitleSourceFormat,
) {
  const randomName = randomUUID().replace(/-/g, "");
  const extension = sourceFormat === "vtt" ? "vtt" : "srt";
  const folder = target.targetType === "SERIES_EPISODE" ? "episodes" : "short-films";

  return `${folder}/${target.contentId}/${randomName}.${extension}`;
}

function assertSubtitleObjectPath(objectPath: string) {
  const normalized = objectPath.trim().replace(/^\/+/, "");

  if (!normalized || normalized.includes("..") || normalized.includes("\\") || normalized.startsWith("/")) {
    throw new Error("Invalid subtitle object path.");
  }

  if (!/^(episodes|short-films)\/[^/]+\/[A-Za-z0-9]+?\.(srt|vtt)$/i.test(normalized)) {
    throw new Error("Unsupported subtitle object path.");
  }

  return normalized;
}

export async function createSubtitleUploadIntent(input: {
  label: string;
  languageCode: string;
  mimeType: string;
  sourceFormat: SubtitleSourceFormat;
  target: SubtitleTarget;
  closedCaptions?: boolean;
  isDefault?: boolean;
}) {
  const target = await resolveSubtitleTarget(input.target);
  const sourceFormat = input.sourceFormat;
  const mimeType = getSubtitleMimeType(sourceFormat, input.mimeType);
  const languageCode = getSubtitleLanguageCode(input.languageCode);
  const label = normalizeSubtitleLabel(input.label);
  const supabase = createAdminClient();
  const objectPath = buildSubtitleObjectPath(target, sourceFormat);
  const { data, error } = await supabase.storage.from(SUBTITLE_BUCKET_ID).createSignedUploadUrl(objectPath);

  if (error || !data) {
    throw new Error("Unable to create subtitle upload intent.");
  }

  return {
    bucket: SUBTITLE_BUCKET_ID,
    closedCaptions: Boolean(input.closedCaptions),
    isDefault: Boolean(input.isDefault),
    label,
    languageCode,
    mediaAssetId: target.mediaAssetId,
    mimeType,
    objectPath,
    signedUploadUrl: data.signedUrl,
    sourceFormat,
    targetType: target.targetType,
    token: data.token,
  };
}

export async function createSubtitleSourceReadUrl(objectPath: string) {
  const supabase = createAdminClient();
  const normalizedObjectPath = assertSubtitleObjectPath(objectPath);
  const { data, error } = await supabase.storage
    .from(SUBTITLE_BUCKET_ID)
    .createSignedUrl(normalizedObjectPath, 900);

  if (error || !data) {
    throw new Error("Unable to create subtitle read URL.");
  }

  return data.signedUrl;
}

export async function deleteSubtitleSourceObject(objectPath: string) {
  const supabase = createAdminClient();
  const normalizedObjectPath = assertSubtitleObjectPath(objectPath);
  const { error } = await supabase.storage.from(SUBTITLE_BUCKET_ID).remove([normalizedObjectPath]);

  if (error) {
    throw new Error("Unable to delete subtitle source object.");
  }
}
