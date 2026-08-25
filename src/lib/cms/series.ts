import "server-only";

import {
  CONTENT_DESCRIPTORS,
  CONTENT_RATINGS,
  type ContentDescriptor,
  type ContentRating,
} from "@/lib/classification";
import {
  SERIES_FORMATS,
  SERIES_STATUSES,
  type SeriesFormat,
  type SeriesRow,
  type SeriesStatus,
} from "@/lib/cms/constants";
import { createAdminClient } from "@/lib/supabase/admin";

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
  | { success: false; errors: SeriesValidationError[] };

export type SeriesDeletePreview = {
  blockers: string[];
  series: SeriesRow | null;
};

export type SeriesDeleteResult =
  | { success: true; seriesId: string; slug: string }
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

export async function listSeriesForAdmin(): Promise<SeriesRow[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("Unable to list series for CMS.");
    return [];
  }

  return data;
}

export async function getSeriesForAdminById(id: string): Promise<SeriesRow | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("series").select("*").eq("id", id).maybeSingle();

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

  return { success: true, seriesId: id, slug: preview.series.slug };
}
