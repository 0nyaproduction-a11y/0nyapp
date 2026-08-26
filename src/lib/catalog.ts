import {
  getSeriesBySlug as getMockSeriesBySlug,
  type ContentFormat,
  type ContentItem,
  type Episode,
} from "@/data/content";
import {
  normalizeContentDescriptors,
  normalizeContentRating,
  resolveContentClassification,
} from "@/lib/classification";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type SeriesRow = Database["public"]["Tables"]["series"]["Row"];
type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];
type ShortFilmRow = Database["public"]["Tables"]["short_films"]["Row"];

export type ShortFilm = {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  poster: string;
  heroImage: string | null;
  creatorReference: string | null;
  durationSeconds: number;
  durationLabel: string;
  language: string | null;
  contentRating: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
  contentDescriptors: string[];
  parentalLockRequired: boolean;
  ageVerificationRequired: boolean;
  status: "draft" | "published" | "archived";
  publishAt: string | null;
  midrollEnabled: boolean;
  midrollTimecodes: number[];
  postrollEnabled: boolean;
  chaiEnabled: boolean;
  playbackReady: boolean;
  sharePath: string;
};

const fallbackPoster = "/logo-og.jpg";

async function getSupabase(supabase?: SupabaseClient<Database>) {
  return supabase ?? createAdminClient();
}

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

function formatShortFilmDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.max(1, Math.round(safeSeconds / 60));

  return `${minutes} min`;
}

function mapEpisode(row: EpisodeRow): Episode {
  const contentRatingOverride = normalizeContentRating(row.content_rating_override);
  const contentDescriptorsOverride = normalizeContentDescriptors(row.content_descriptors_override);
  const classification = resolveContentClassification(
    contentRatingOverride,
    contentDescriptorsOverride,
  );

  return {
    id: row.id,
    number: row.episode_number,
    title: row.title ?? `Episode ${row.episode_number}`,
    description: row.synopsis ?? "",
    runtime: toRuntime(row.duration_seconds),
    isFree: row.is_free,
    isLocked: !row.is_free,
    coinPrice: row.coin_price,
    coinUnlockEnabled: row.coin_unlock_enabled,
    rewardedUnlockEnabled: row.rewarded_unlock_enabled,
    rewardedAccessMode: row.rewarded_access_mode,
    plusAccess: row.plus_access,
    lockedPreviewSeconds: row.locked_preview_seconds,
    contentRatingOverride,
    contentDescriptorsOverride,
    contentRating: classification.contentRating,
    contentDescriptors: classification.contentDescriptors,
    parentalLockRequired: classification.parentalLockRequired,
    ageVerificationRequired: classification.ageVerificationRequired,
  };
}

function mapSeries(row: SeriesRow, episodes: EpisodeRow[] = []): ContentItem {
  const fallback = getMockSeriesBySlug(row.slug);
  const contentRating = normalizeContentRating(row.content_rating);
  const contentDescriptors = normalizeContentDescriptors(row.content_descriptors);
  const classification = resolveContentClassification(contentRating, contentDescriptors);
  const mappedEpisodes = episodes
    .filter((episode) => episode.series_id === row.id)
    .sort((first, second) => first.episode_number - second.episode_number)
    .map(mapEpisode)
    .filter((episode) => !episode.ageVerificationRequired);

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
    episodes: mappedEpisodes,
    contentRating: classification.contentRating,
    contentDescriptors: classification.contentDescriptors,
    parentalLockRequired: classification.parentalLockRequired,
    ageVerificationRequired: classification.ageVerificationRequired,
    isFree: fallback?.isFree,
    isLocked: fallback?.isLocked,
    progress: fallback?.progress,
    currentEpisode: fallback?.currentEpisode,
  };
}

function mapShortFilm(row: ShortFilmRow): ShortFilm {
  const contentRating = normalizeContentRating(row.content_rating);
  const contentDescriptors = normalizeContentDescriptors(row.content_descriptors);
  const classification = resolveContentClassification(contentRating, contentDescriptors);
  const isPublished = row.status === "published" && (!row.publish_at || new Date(row.publish_at).getTime() <= Date.now());

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    synopsis: row.synopsis ?? "",
    poster: row.poster_url ?? row.hero_image_url ?? fallbackPoster,
    heroImage: row.hero_image_url ?? row.poster_url ?? null,
    creatorReference: row.creator_reference,
    durationSeconds: row.duration_seconds,
    durationLabel: formatShortFilmDuration(row.duration_seconds),
    language: row.language,
    contentRating: classification.contentRating,
    contentDescriptors: classification.contentDescriptors,
    parentalLockRequired: classification.parentalLockRequired,
    ageVerificationRequired: classification.ageVerificationRequired,
    status: row.status,
    publishAt: row.publish_at,
    midrollEnabled: row.midroll_enabled,
    midrollTimecodes: row.midroll_timecodes,
    postrollEnabled: row.postroll_enabled,
    chaiEnabled: row.chai_enabled,
    playbackReady: isPublished && Boolean(row.playback_reference) && !classification.ageVerificationRequired,
    sharePath: `/short-films/${row.slug}`,
  };
}

async function getPublishedEpisodeRows(
  seriesIds: string[],
  supabaseClient?: SupabaseClient<Database>,
) {
  if (!seriesIds.length) {
    return [];
  }

  const supabase = await getSupabase(supabaseClient);
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

export async function getPublishedSeries(supabaseClient?: SupabaseClient<Database>) {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("Unable to load published series.");
    return [];
  }

  const episodes = await getPublishedEpisodeRows(
    data.map((series) => series.id),
    supabase,
  );

  return data
    .map((series) => mapSeries(series, episodes))
    .filter((series) => !(series.ageVerificationRequired && series.episodes.length === 0));
}

export async function getFeaturedSeries(supabaseClient?: SupabaseClient<Database>) {
  const supabase = await getSupabase(supabaseClient);
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

  const episodes = await getEpisodesForSeries(data.id, supabase);

  return mapSeries(data, episodes.map((episode) => ({
    ...episode,
    series_id: data.id,
  })));
}

export async function getSeriesBySlug(
  slug: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
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

  const episodes = await getEpisodesForSeries(data.id, supabase);
  const series = mapSeries(data, episodes);

  if (series.ageVerificationRequired && series.episodes.length === 0) {
    return null;
  }

  return series;
}

export async function getPublishedShortFilms(supabaseClient?: SupabaseClient<Database>) {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase
    .from("short_films")
    .select("*")
    .eq("status", "published")
    .order("publish_at", { ascending: true, nullsFirst: true })
    .order("title", { ascending: true });

  if (error) {
    console.warn("Unable to load published short films.");
    return [];
  }

  return data
    .filter((row) => !row.publish_at || new Date(row.publish_at).getTime() <= Date.now())
    .map(mapShortFilm);
}

export async function getShortFilmBySlug(
  slug: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  const { data, error } = await supabase
    .from("short_films")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn("Unable to load short film.");
    }

    return null;
  }

  if (data.publish_at && new Date(data.publish_at).getTime() > Date.now()) {
    return null;
  }

  const shortFilm = mapShortFilm(data);

  if (shortFilm.ageVerificationRequired && shortFilm.contentRating === "A") {
    return shortFilm;
  }

  return shortFilm;
}

export async function getEpisodesForSeries(
  seriesId: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
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
  supabase?: SupabaseClient<Database>,
) {
  const series = await getSeriesBySlug(slug, supabase);

  if (!series) {
    return null;
  }

  const episode = series.episodes.find((item) => item.number === episodeNumber);

  if (!episode) {
    return null;
  }

  return {
    series,
    episode,
  };
}
