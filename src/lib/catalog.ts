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
import { timePerf } from "@/lib/api/perf";
import {
  isMediaAssetReady,
  isSeriesConsumerVisible,
  isShortFilmConsumerVisible,
  resolveShortFilmPlaybackReady,
} from "@/lib/catalog-rules";
import {
  normalizeGenreAssignments,
  normalizeSeriesContentFormat,
  normalizeShortFilmContentFormat,
  serializeGenreLabel,
  type CanonicalGenre,
  type ContentFormatId,
} from "@/lib/taxonomy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type SeriesRow = Database["public"]["Tables"]["series"]["Row"];
type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];
type ShortFilmRow = Database["public"]["Tables"]["short_films"]["Row"];

export type ShortFilm = {
  id: string;
  slug: string;
  title: string;
  contentType: ContentFormatId;
  synopsis: string;
  genre: string | null;
  primaryGenre: CanonicalGenre | null;
  secondaryGenres: CanonicalGenre[];
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
  if (supabase) {
    return supabase;
  }
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/**
 * Returns the ids of media_assets that are actually playable, using the exact
 * same readiness source the playback path reads (`media_assets.status` and
 * `provider_playback_reference`). Returns null when the readiness lookup
 * failed so callers can fail open instead of blanking the catalog.
 */
async function getReadyMediaAssetIds(
  rows: readonly Pick<EpisodeRow, "media_asset_id">[],
  supabase: SupabaseClient<Database>,
): Promise<Set<string> | null> {
  const assetIds = [
    ...new Set(
      rows
        .map((row) => row.media_asset_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (!assetIds.length) {
    return new Set();
  }

  const { data: assets, error } = await timePerf("media_ready_q", () =>
    supabase
      .from("media_assets")
      .select("id,status,provider_playback_reference")
      .in("id", assetIds),
  );

  if (error) {
    console.warn("Unable to load media readiness.");
    return null;
  }

  return new Set(
    (assets ?? [])
      .filter((asset) => isMediaAssetReady(asset))
      .map((asset) => asset.id),
  );
}

/**
 * Resolves short-film playback readiness (media_assets-based) for a set of
 * short-film rows. Returns null when the lookup failed.
 */
async function resolveShortFilmMediaReadiness(
  rows: readonly ShortFilmRow[],
  supabase: SupabaseClient<Database>,
): Promise<Map<string, boolean> | null> {
  if (!rows.length) {
    return new Map();
  }

  const readyAssetIds = await getReadyMediaAssetIds(rows, supabase);
  if (readyAssetIds === null) {
    return null;
  }

  return new Map(
    rows.map((row) => [
      row.id,
      Boolean(row.media_asset_id && readyAssetIds.has(row.media_asset_id)),
    ]),
  );
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
  const contentRatingOverride = normalizeContentRating(
    row.content_rating_override,
  );
  const contentDescriptorsOverride = normalizeContentDescriptors(
    row.content_descriptors_override,
  );
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
    requiredRewardedCompletions: row.required_rewarded_completions,
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
  const genreAssignment = normalizeGenreAssignments(row.genre);
  const contentRating = normalizeContentRating(row.content_rating);
  const contentDescriptors = normalizeContentDescriptors(
    row.content_descriptors,
  );
  const classification = resolveContentClassification(
    contentRating,
    contentDescriptors,
  );
  const mappedEpisodes = episodes
    .filter((episode) => episode.series_id === row.id)
    .sort((first, second) => first.episode_number - second.episode_number)
    .map(mapEpisode)
    .filter((episode) => !episode.ageVerificationRequired);

  return {
    id: row.slug,
    title: row.title,
    slug: row.slug,
    contentType: normalizeSeriesContentFormat(),
    publishedAt: row.published_at,
    language: row.language,
    genre: serializeGenreLabel(genreAssignment),
    primaryGenre: genreAssignment.primaryGenre,
    secondaryGenres: genreAssignment.secondaryGenres,
    format: toContentFormat(row.format),
    episodeCount: mappedEpisodes.length,
    episodeDuration:
      row.episode_duration_label ?? fallback?.episodeDuration ?? "",
    synopsis: row.synopsis ?? "",
    poster:
      row.poster_url ??
      row.hero_image_url ??
      fallback?.poster ??
      fallbackPoster,
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

function mapShortFilm(row: ShortFilmRow, mediaReady: boolean): ShortFilm {
  const genreAssignment = normalizeGenreAssignments(undefined);
  const contentRating = normalizeContentRating(row.content_rating);
  const contentDescriptors = normalizeContentDescriptors(
    row.content_descriptors,
  );
  const classification = resolveContentClassification(
    contentRating,
    contentDescriptors,
  );

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    contentType: normalizeShortFilmContentFormat(),
    synopsis: row.synopsis ?? "",
    genre: serializeGenreLabel(genreAssignment),
    primaryGenre: genreAssignment.primaryGenre,
    secondaryGenres: genreAssignment.secondaryGenres,
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
    playbackReady: resolveShortFilmPlaybackReady({
      status: row.status,
      publishAt: row.publish_at,
      mediaReady,
      ageVerificationRequired: classification.ageVerificationRequired,
    }),
    sharePath: `/short-films/${row.slug}`,
  };
}

async function getPublishedEpisodeRows(
  seriesIds: string[],
  supabaseClient?: SupabaseClient<Database> | null,
): Promise<EpisodeRow[] | null> {
  if (!seriesIds.length) {
    return [];
  }

  const supabase = await getSupabase(supabaseClient ?? undefined);
  if (!supabase) {
    return [];
  }

  const { data, error } = await timePerf("episodes_q", () =>
    supabase
      .from("episodes")
      .select("*")
      .in("series_id", seriesIds)
      .eq("status", "published")
      .order("episode_number", { ascending: true }),
  );

  if (error) {
    console.warn("Unable to load catalog episodes.");
    return null;
  }

  const readyAssetIds = await getReadyMediaAssetIds(data, supabase);
  if (readyAssetIds === null) {
    return data;
  }

  return data.filter(
    (row) => row.media_asset_id && readyAssetIds.has(row.media_asset_id),
  );
}

export async function getPublishedSeries(
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  if (!supabase) {
    return [];
  }

  const { data, error } = await timePerf("series_q", () =>
    supabase
      .from("series")
      .select("*")
      .eq("status", "published")
      .order("sort_order", { ascending: true }),
  );

  if (error) {
    console.warn("Unable to load published series.");
    return [];
  }

  const episodes = await getPublishedEpisodeRows(
    data.map((series) => series.id),
    supabase,
  );

  return data
    .map((series) => mapSeries(series, episodes ?? []))
    .filter(
      (series) => episodes === null || isSeriesConsumerVisible(series.episodes),
    );
}

export async function getFeaturedSeries(
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  if (!supabase) {
    return null;
  }

  const { data, error } = await timePerf("series_q", () =>
    supabase
      .from("series")
      .select("*")
      .eq("status", "published")
      .eq("featured", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
  );

  if (error || !data) {
    if (error) {
      console.warn("Unable to load featured series.");
    }

    return null;
  }

  const episodes = await getEpisodesForSeries(data.id, supabase);

  if (episodes === null) {
    return mapSeries(data, []);
  }

  const series = mapSeries(
    data,
    episodes.map((episode) => ({
      ...episode,
      series_id: data.id,
    })),
  );

  return isSeriesConsumerVisible(series.episodes) ? series : null;
}

export async function getSeriesBySlug(
  slug: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  if (!supabase) {
    return null;
  }

  const { data, error } = await timePerf("series_q", () =>
    supabase
      .from("series")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
  );

  if (error || !data) {
    if (error) {
      console.warn("Unable to load series.");
    }

    return null;
  }

  const episodes = await getEpisodesForSeries(data.id, supabase);
  const series = mapSeries(data, episodes ?? []);

  if (episodes !== null && !isSeriesConsumerVisible(series.episodes)) {
    return null;
  }

  return series;
}

export async function getPublishedShortFilms(
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  if (!supabase) {
    return [];
  }

  const { data, error } = await timePerf("short_films_q", () =>
    supabase
      .from("short_films")
      .select("*")
      .eq("status", "published")
      .order("publish_at", { ascending: true, nullsFirst: true })
      .order("title", { ascending: true }),
  );

  if (error) {
    console.warn("Unable to load published short films.");
    return [];
  }

  const mediaReadiness = await resolveShortFilmMediaReadiness(data, supabase);

  return data
    .map((row) => mapShortFilm(row, mediaReadiness?.get(row.id) ?? false))
    .filter((shortFilm) =>
      isShortFilmConsumerVisible({
        status: shortFilm.status,
        publish_at: shortFilm.publishAt,
      }),
    );
}

export async function getShortFilmBySlug(
  slug: string,
  supabaseClient?: SupabaseClient<Database>,
) {
  const supabase = await getSupabase(supabaseClient);
  if (!supabase) {
    return null;
  }

  const { data, error } = await timePerf("short_films_q", () =>
    supabase
      .from("short_films")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
  );

  if (error || !data) {
    if (error) {
      console.warn("Unable to load short film.");
    }

    return null;
  }

  if (data.publish_at && new Date(data.publish_at).getTime() > Date.now()) {
    return null;
  }

  const mediaReadiness = await resolveShortFilmMediaReadiness([data], supabase);

  return mapShortFilm(data, mediaReadiness?.get(data.id) ?? false);
}

export async function getEpisodesForSeries(
  seriesId: string,
  supabaseClient?: SupabaseClient<Database>,
): Promise<EpisodeRow[] | null> {
  const supabase = await getSupabase(supabaseClient);
  if (!supabase) {
    return null;
  }

  const { data, error } = await timePerf("episodes_q", () =>
    supabase
      .from("episodes")
      .select("*")
      .eq("series_id", seriesId)
      .eq("status", "published")
      .order("episode_number", { ascending: true }),
  );

  if (error) {
    console.warn("Unable to load series episodes.");
    return null;
  }

  const readyAssetIds = await getReadyMediaAssetIds(data, supabase);

  if (readyAssetIds === null) {
    return data;
  }

  return data.filter(
    (row) => row.media_asset_id && readyAssetIds.has(row.media_asset_id),
  );
}

/**
 * Returns the ids of series that serve at least one published, media-ready
 * episode — the exact same rule the consumer catalog applies. Used by Home so
 * spotlight/editorial rows stay consistent with the catalog. Returns null when
 * the lookup failed so Home can fail open and keep curated rows visible.
 */
export async function getSeriesIdsWithConsumerEpisodes(
  seriesIds: string[],
  supabaseClient?: SupabaseClient<Database> | null,
): Promise<Set<string> | null> {
  if (!seriesIds.length) {
    return new Set();
  }

  const supabase = await getSupabase(supabaseClient ?? undefined);
  if (!supabase) {
    return null;
  }

  const { data: episodeRows, error } = await timePerf("home_episodes_q", () =>
    supabase
      .from("episodes")
      .select("series_id,media_asset_id")
      .eq("status", "published")
      .in("series_id", seriesIds),
  );

  if (error || !episodeRows) {
    console.warn("Unable to load series consumer episodes.");
    return null;
  }

  const readyAssetIds = await getReadyMediaAssetIds(episodeRows, supabase);
  if (readyAssetIds === null) {
    return new Set(episodeRows.map((row) => row.series_id));
  }

  return new Set(
    episodeRows
      .filter(
        (row) => row.media_asset_id && readyAssetIds.has(row.media_asset_id),
      )
      .map((row) => row.series_id),
  );
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
