import "server-only";

import {
  CONTENT_DESCRIPTORS,
  CONTENT_RATINGS,
  type ContentDescriptor,
  type ContentRating,
} from "@/lib/classification";
import {
  cleanupArtworkObjectsAfterContentDeletion,
  extractArtworkObjectPath,
} from "@/lib/cms/artwork";
import {
  SERIES_FORMATS,
  SERIES_STATUSES,
  type SeriesFormat,
  type SeriesRow,
  type SeriesStatus,
} from "@/lib/cms/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { ARTWORK_BUCKET_ID } from "@/lib/supabase/artwork";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type { SeriesFormat, SeriesRow, SeriesStatus };
export { SERIES_FORMATS, SERIES_STATUSES };

export type SeriesInput = {
  title: string;
  slug: string;
  synopsis: string | null;
  genre: string | null;
  language: string | null;
  format: string | null;
  episodeDurationLabel: string | null;
  episodeCount: number;
  posterUrl: string | null;
  heroImageUrl: string | null;
  contentRating: ContentRating | null;
  contentDescriptors: ContentDescriptor[];
  featured: boolean;
  sortOrder: number;
};

export type SeriesValidationError = { field: string; message: string };

export type SeriesActionResult =
  | { success: true; series: SeriesRow }
  | { success: false; errors: SeriesValidationError[]; blockers?: string[]; message?: string };

export type SeriesDeletePreview = {
  blockers: string[];
  series: SeriesRow | null;
};

export type SeriesDeleteResult =
  | { success: true; seriesId: string; slug: string; cleanupWarnings: string[] }
  | { success: false; message: string; blockers?: string[] };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function getAdminClient() {
  return createAdminClient();
}

export function validateSeriesInput(input: SeriesInput): SeriesValidationError[] {
  const errors: SeriesValidationError[] = [];

  if (!input.title.trim()) {
    errors.push({ field: "title", message: "Title is required." });
  }

  if (!SLUG_PATTERN.test(input.slug)) {
    errors.push({
      field: "slug",
      message: "Slug must be lowercase letters, numbers, and hyphens only (e.g. my-series-title).",
    });
  }

  if (input.format && !SERIES_FORMATS.includes(input.format as SeriesFormat)) {
    errors.push({ field: "format", message: `Format must be one of: ${SERIES_FORMATS.join(", ")}.` });
  }

  if (input.contentRating && !CONTENT_RATINGS.includes(input.contentRating)) {
    errors.push({ field: "contentRating", message: "Unsupported content rating." });
  }

  for (const descriptor of input.contentDescriptors) {
    if (!CONTENT_DESCRIPTORS.includes(descriptor)) {
      errors.push({ field: "contentDescriptors", message: `Unsupported content descriptor: ${descriptor}.` });
      break;
    }
  }

  if (!Number.isInteger(input.episodeCount) || input.episodeCount < 0) {
    errors.push({ field: "episodeCount", message: "Episode count must be zero or a positive whole number." });
  }

  if (!Number.isInteger(input.sortOrder)) {
    errors.push({ field: "sortOrder", message: "Sort order must be a whole number." });
  }

  return errors;
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

export type SeriesListResult = {
  rows: SeriesRow[];
  totalCount: number;
  filteredCount: number;
};

export async function listSeriesForAdmin(
  params: { page?: number; pageSize?: number; search?: string; status?: string } = {},
): Promise<SeriesListResult> {
  const supabase = getAdminClient();
  const { page = 1, pageSize = 25, search = "", status = "" } = params;
  const offset = (page - 1) * pageSize;

  let query = supabase.from("series").select("*", { count: "exact" });

  if (search.trim()) {
    query = query.or(`title.ilike.%${search.trim()}%,slug.ilike.%${search.trim()}%`);
  }
  if (status && status !== "all") {
    query = query.eq("status", status as SeriesStatus);
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.warn("Unable to list series for CMS.");
    return { rows: [], totalCount: 0, filteredCount: 0 };
  }

  const totalCount = count ?? data.length;
  const filteredCount = search || status ? data.length : totalCount;

  return { rows: data ?? [], totalCount, filteredCount };
}

export async function getSeriesForAdminById(id: string): Promise<SeriesRow | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("series").select("*").eq("id", id).maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getSeriesForAdminBySlug(slug: string): Promise<SeriesRow | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("series").select("*").eq("slug", slug).maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function createSeries(input: SeriesInput): Promise<SeriesActionResult> {
  const errors = validateSeriesInput(input);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("series")
    .insert({
      title: input.title.trim(),
      slug: input.slug,
      synopsis: input.synopsis,
      genre: input.genre,
      language: input.language,
      format: input.format,
      episode_duration_label: input.episodeDurationLabel,
      episode_count: input.episodeCount,
      poster_url: input.posterUrl,
      hero_image_url: input.heroImageUrl,
      content_rating: input.contentRating,
      content_descriptors: input.contentDescriptors,
      featured: input.featured,
      sort_order: input.sortOrder,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { success: false, errors: [{ field: "slug", message: "That slug is already in use." }] };
    }

    return { success: false, errors: [{ field: "form", message: "Unable to create series." }] };
  }

  return { success: true, series: data };
}

export async function updateSeries(id: string, input: SeriesInput): Promise<SeriesActionResult> {
  const errors = validateSeriesInput(input);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("series")
    .update({
      title: input.title.trim(),
      slug: input.slug,
      synopsis: input.synopsis,
      genre: input.genre,
      language: input.language,
      format: input.format,
      episode_duration_label: input.episodeDurationLabel,
      episode_count: input.episodeCount,
      poster_url: input.posterUrl,
      hero_image_url: input.heroImageUrl,
      content_rating: input.contentRating,
      content_descriptors: input.contentDescriptors,
      featured: input.featured,
      sort_order: input.sortOrder,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { success: false, errors: [{ field: "slug", message: "That slug is already in use." }] };
    }

    return { success: false, errors: [{ field: "form", message: "Unable to update series." }] };
  }

  return { success: true, series: data };
}

export async function updateSeriesStatus(
  id: string,
  status: SeriesStatus,
): Promise<SeriesActionResult> {
  if (!SERIES_STATUSES.includes(status)) {
    return { success: false, errors: [{ field: "status", message: "Unsupported status." }] };
  }

  const supabase = getAdminClient();

  if (status === "published") {
    // NEW: Verify poster before publishing
    const { data: series, error: seriesError } = await supabase.from("series").select("*").eq("id", id).maybeSingle();

    if (seriesError || !series) {
      return { success: false, errors: [{ field: "status", message: "Series not found." }] };
    }

    const posterErrors = await verifySeriesPublishIntegrity(series, supabase);

    if (posterErrors.length > 0) {
      return {
        success: false,
        errors: posterErrors,
        blockers: posterErrors.map((e) => e.message),
        message: "Resolve the blockers before publishing this series.",
      };
    }

    const { data: publishData, error: publishError } = await supabase.rpc("publish_series_with_episodes", {
      p_series_id: id,
    });
    const publishResult = publishData?.[0];

    if (publishError || !publishResult) {
      return { success: false, errors: [{ field: "status", message: "Unable to publish series." }] };
    }

    if (!publishResult.success) {
      return {
        success: false,
        errors: [
          {
            field: "status",
            message: publishResult.message || "Unable to publish series.",
          },
        ],
        blockers: publishResult.blockers ?? [],
        message: publishResult.message ?? "Unable to publish series.",
      };
    }

    const { data, error } = await supabase.from("series").select("*").eq("id", id).maybeSingle();

    if (error || !data) {
      return { success: false, errors: [{ field: "status", message: "Unable to update status." }] };
    }

    return { success: true, series: data };
  }

  const { data, error } = await supabase
    .from("series")
    .update({ status })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { success: false, errors: [{ field: "status", message: "Unable to update status." }] };
  }

  return { success: true, series: data };
}

export async function persistSeriesArtwork(
  id: string,
  field: "poster_url" | "hero_image_url",
  publicUrl: string,
): Promise<SeriesActionResult> {
  const supabase = getAdminClient();
  const update = field === "poster_url" ? { poster_url: publicUrl } : { hero_image_url: publicUrl };
  const { data, error } = await supabase
    .from("series")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { success: false, errors: [{ field, message: "Unable to save artwork." }] };
  }

  return { success: true, series: data };
}

async function artworkObjectExists(objectPath: string, supabase: ReturnType<typeof getAdminClient>) {
  const normalizedObjectPath = objectPath.trim().replace(/^\/+/, "");
  const pathParts = normalizedObjectPath.split("/").filter(Boolean);
  const fileName = pathParts.at(-1);

  if (!fileName) {
    return false;
  }

  const folderPath = pathParts.slice(0, -1).join("/");
  const { data, error } = await supabase.storage.from(ARTWORK_BUCKET_ID).list(folderPath, {
    limit: 100,
    search: fileName,
  });

  if (error || !data) {
    return false;
  }

  return data.some((object) => object.name === fileName);
}

function extractTrustedArtworkObjectPath(value: string) {
  const objectPath = extractArtworkObjectPath(value);

  if (!objectPath) {
    return null;
  }

  try {
    const artworkUrl = new URL(value.trim());
    const expectedOrigin = new URL(getSupabaseEnv().url).origin;

    if (artworkUrl.origin !== expectedOrigin) {
      return null;
    }
  } catch {
    // Existing server-side artwork helpers also accept stored bucket/path values.
  }

  return objectPath;
}

export async function verifySeriesPublishIntegrity(
  series: SeriesRow,
  supabase = getAdminClient(),
): Promise<SeriesValidationError[]> {
  const errors: SeriesValidationError[] = [];

  if (!series.poster_url || !series.poster_url.trim()) {
    errors.push({ field: "posterUrl", message: "Poster artwork is required to publish." });
  } else {
    const posterObjectPath = extractTrustedArtworkObjectPath(series.poster_url);
    const hasPosterObject = posterObjectPath
      ? await artworkObjectExists(posterObjectPath, supabase)
      : false;

    if (!hasPosterObject) {
      errors.push({ field: "posterUrl", message: "Poster artwork file is missing or unavailable." });
    }
  }

  return errors;
}

async function inspectSeriesDeletion(id: string): Promise<SeriesDeletePreview> {
  const supabase = getAdminClient();
  const blockers: string[] = [];

  const [seriesResult, episodesResult] = await Promise.all([
    supabase.from("series").select("*").eq("id", id).maybeSingle(),
    supabase.from("episodes").select("id,episode_number,status").eq("series_id", id).order("episode_number", { ascending: true }),
  ]);

  if (seriesResult.error || !seriesResult.data) {
    return { blockers: ["Series not found."], series: null };
  }

  const series = seriesResult.data;
  const episodes = episodesResult.data ?? [];

  if (series.status === "published") {
   blockers.push("Archive this series before deleting it.");
  }

  if (episodes.length > 0) {
   blockers.push("Delete all episodes first.");
  }

  return { blockers, series };
}

export async function getSeriesDeletePreview(id: string) {
  return inspectSeriesDeletion(id);
}

export async function deleteSeries(id: string): Promise<SeriesDeleteResult> {
  const preview = await inspectSeriesDeletion(id);

  if (!preview.series) {
    return { success: false, message: "Series not found." };
  }

  if (preview.blockers.length > 0) {
    return { success: false, message: "Resolve the blockers before deleting this series.", blockers: preview.blockers };
  }

  const supabase = getAdminClient();
  const { error } = await supabase.from("series").delete().eq("id", id);

  if (error) {
    return { success: false, message: "Unable to delete series." };
  }

  const cleanupWarnings = await cleanupArtworkObjectsAfterContentDeletion([
    preview.series.poster_url,
    preview.series.hero_image_url,
  ]);

  return { success: true, seriesId: id, slug: preview.series.slug, cleanupWarnings };
}
