import {
  contentItems,
  getEpisode as getMockEpisode,
  getSeriesBySlug as getMockSeriesBySlug,
  type ContentFormat,
  type ContentItem,
  type Episode,
} from "@/data/content";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type SeriesRow = Database["public"]["Tables"]["series"]["Row"];
type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];

const fallbackPoster = "/logo-og.jpg";

function toContentFormat(format: string | null): ContentFormat {
  if (format === "Series" || format === "Mini" || format === "Short") {
    return format;
  }

  return "Series";
}

function toRuntime(durationSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(durationSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = `${safeSeconds % 60}`.padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function getFallbackAccent(slug: string) {
  return getMockSeriesBySlug(slug)?.accent ?? "#0DD1BC";
}

function mapEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    number: row.episode_number,
    title: row.title ?? `Episode ${row.episode_number}`,
    description: row.synopsis ?? "",
    runtime: toRuntime(row.duration_seconds),
    isFree: row.is_free,
    isLocked: !row.is_free,
  };
}

function mapSeries(row: SeriesRow, episodes: EpisodeRow[] = []): ContentItem {
  const fallback = getMockSeriesBySlug(row.slug);
  const mappedEpisodes = episodes
    .filter((episode) => episode.series_id === row.id)
    .sort((first, second) => first.episode_number - second.episode_number)
    .map(mapEpisode);

  return {
    id: row.slug,
    title: row.title,
    slug: row.slug,
    genre: row.genre ?? fallback?.genre ?? "Drama",
    format: toContentFormat(row.format),
    episodeCount: row.episode_count,
    episodeDuration: row.episode_duration_label ?? fallback?.episodeDuration ?? "",
    synopsis: row.synopsis ?? fallback?.synopsis ?? "",
    poster: row.poster_url ?? row.hero_image_url ?? fallback?.poster ?? fallbackPoster,
    accent: fallback?.accent ?? getFallbackAccent(row.slug),
    episodes: mappedEpisodes.length ? mappedEpisodes : (fallback?.episodes ?? []),
    isFree: fallback?.isFree,
    isLocked: fallback?.isLocked,
    progress: fallback?.progress,
    currentEpisode: fallback?.currentEpisode,
  };
}

async function getPublishedEpisodeRows(seriesIds: string[]) {
  if (!seriesIds.length) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .in("series_id", seriesIds)
    .eq("status", "published")
    .order("episode_number", { ascending: true });

  if (error) {
    console.warn("Unable to load catalog episodes.");
    return [];
  }

  return data;
}

export async function getPublishedSeries() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("Unable to load published series.");
    return [];
  }

  const episodes = await getPublishedEpisodeRows(data.map((series) => series.id));

  return data.map((series) => mapSeries(series, episodes));
}

export async function getFeaturedSeries() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("status", "published")
    .eq("featured", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn("Unable to load featured series.");
    }

    return null;
  }

  const episodes = await getEpisodesForSeries(data.id);

  return mapSeries(data, episodes.map((episode) => ({
    ...episode,
    series_id: data.id,
  })));
}

export async function getSeriesBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn("Unable to load series.");
    }

    return null;
  }

  const episodes = await getEpisodesForSeries(data.id);

  return mapSeries(data, episodes);
}

export async function getEpisodesForSeries(seriesId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("series_id", seriesId)
    .eq("status", "published")
    .order("episode_number", { ascending: true });

  if (error) {
    console.warn("Unable to load series episodes.");
    return [];
  }

  return data;
}

export async function getEpisodeBySeriesSlugAndNumber(
  slug: string,
  episodeNumber: number,
) {
  const series = await getSeriesBySlug(slug);

  if (!series) {
    return null;
  }

  const episode =
    series.episodes.find((item) => item.number === episodeNumber) ??
    getMockEpisode(slug, episodeNumber);

  if (!episode) {
    return null;
  }

  return {
    series,
    episode,
  };
}

export function getMockOrCatalogRows(catalogItems: ContentItem[]) {
  return catalogItems.length ? catalogItems : contentItems;
}
