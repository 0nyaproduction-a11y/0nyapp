import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildMediaTruth, getAssetsByState, getMuxProviderInventory } from "./media-truth";
import {
  classifyProviderOnlyMuxAsset,
} from "./media-truth-model";
import {
  buildPlaybackTelemetry,
  type PublishedEpisode,
  type PublishedShortFilm,
  type WatchProgressRow,
  type PlaybackTelemetryOutput,
} from "./playback-telemetry";

export interface ContentSnapshot {
  publishedSeries: number;
  publishedEpisodes: number;
  publishedShortFilms: number;
  homeRows: number;
  homeRowItems: number;
}

export interface MediaGuardianSnapshot {
  READY: number;
  PROCESSING: number;
  FAILED: number;
  MISSING: number;
  UNASSIGNED: number;
  PROBLEMS: number;
}

export interface PlaybackTelemetrySnapshot {
  completionRate: PlaybackTelemetryOutput["completionRate"];
  episodeDropoff: PlaybackTelemetryOutput["episodeDropoff"];
  seriesCompletionRate: PlaybackTelemetryOutput["seriesCompletionRate"];
  generatedAt: number;
  authority: "DERIVED";
  source: "TELEMETRY";
  caveat: "Historical completeness may be partial.";
}

export interface AnalyticsSnapshot {
  generatedAt: number;
  content: ContentSnapshot;
  mediaGuardian: MediaGuardianSnapshot;
  playbackTelemetry: PlaybackTelemetrySnapshot;
}

async function countPublishedSeries(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await supabase
    .from("series")
    .select("*", { count: "exact", head: true })
    .eq("status", "published");
  return count ?? 0;
}

async function countPublishedEpisodes(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await supabase
    .from("episodes")
    .select("*", { count: "exact", head: true })
    .eq("status", "published");
  return count ?? 0;
}

async function countPublishedShortFilms(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await supabase
    .from("short_films")
    .select("*", { count: "exact", head: true })
    .eq("status", "published");
  return count ?? 0;
}

async function countHomeRows(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await supabase
    .from("home_rows")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function countHomeRowItems(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await supabase
    .from("home_row_items")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function fetchPublishedEpisodes(supabase: ReturnType<typeof createAdminClient>): Promise<PublishedEpisode[]> {
  const { data, error } = await supabase
    .from("episodes")
    .select("series_id, episode_number, status, duration_seconds, series:series_id(slug)")
    .eq("status", "published");

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seriesSlug: (row as any).series?.slug ?? "",
    episodeNumber: row.episode_number,
    status: row.status as "draft" | "published" | "archived",
    durationSeconds: row.duration_seconds,
  }));
}

async function fetchPublishedShortFilms(supabase: ReturnType<typeof createAdminClient>): Promise<PublishedShortFilm[]> {
  const { data, error } = await supabase
    .from("short_films")
    .select("slug, status, duration_seconds")
    .eq("status", "published");

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    slug: row.slug,
    status: row.status as "draft" | "published" | "archived",
    durationSeconds: row.duration_seconds,
  }));
}

async function fetchWatchProgressRows(supabase: ReturnType<typeof createAdminClient>): Promise<WatchProgressRow[]> {
  const { data, error } = await supabase
    .from("watch_progress")
    .select("user_id, content_type, series_slug, episode_number, short_film_slug, duration_seconds, completed")
    .not("duration_seconds", "is", null);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    userId: row.user_id,
    contentType: row.content_type as "series_episode" | "short_film",
    seriesSlug: row.series_slug ?? null,
    episodeNumber: row.episode_number ?? null,
    shortFilmSlug: row.short_film_slug ?? null,
    durationSeconds: row.duration_seconds,
    completed: row.completed,
  }));
}

export async function getPlaybackTelemetrySnapshot(): Promise<PlaybackTelemetrySnapshot> {
  const supabase = createAdminClient();

  const [publishedEpisodes, publishedShortFilms, progressRows] = await Promise.all([
    fetchPublishedEpisodes(supabase),
    fetchPublishedShortFilms(supabase),
    fetchWatchProgressRows(supabase),
  ]);

  const telemetry = buildPlaybackTelemetry(progressRows, publishedEpisodes, publishedShortFilms);

  return {
    completionRate: telemetry.completionRate,
    episodeDropoff: telemetry.episodeDropoff,
    seriesCompletionRate: telemetry.seriesCompletionRate,
    generatedAt: telemetry.generatedAt,
    authority: telemetry.authority,
    source: telemetry.source,
    caveat: telemetry.caveat,
  };
}

export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const supabase = createAdminClient();

  const [
    publishedSeries,
    publishedEpisodesCount,
    publishedShortFilmsCount,
    homeRows,
    homeRowItems,
    playbackTelemetry,
  ] = await Promise.all([
    countPublishedSeries(supabase),
    countPublishedEpisodes(supabase),
    countPublishedShortFilms(supabase),
    countHomeRows(supabase),
    countHomeRowItems(supabase),
    getPlaybackTelemetrySnapshot(),
  ]);

  const providerInventory = await getMuxProviderInventory();
  const truths = await buildMediaTruth(supabase, { providerInventory, probeMux: false });

  const mediaGuardian: MediaGuardianSnapshot = {
    READY: 0,
    PROCESSING: 0,
    FAILED: 0,
    MISSING: 0,
    UNASSIGNED: 0,
    PROBLEMS: 0,
  };

  for (const truth of truths) {
    mediaGuardian[truth.classification]++;

    if (truth.flags.includes("UNASSIGNED")) {
      mediaGuardian.UNASSIGNED++;
    }

    const isProblem =
      truth.classification === "FAILED" ||
      truth.classification === "MISSING" ||
      truth.flags.includes("PUBLISHED_BUT_UNPLAYABLE") ||
      truth.flags.includes("PROVIDER_REFERENCE_MISMATCH") ||
      truth.flags.includes("PROVIDER_REFERENCE_AMBIGUOUS");
    if (isProblem) {
      mediaGuardian.PROBLEMS++;
    }
  }

  const muxOnlyItems = getAssetsByState(providerInventory, "MUX_ONLY");
  for (const item of muxOnlyItems) {
    const classification = classifyProviderOnlyMuxAsset(item.muxStatus);
    mediaGuardian[classification]++;

    mediaGuardian.UNASSIGNED++;

    mediaGuardian.PROBLEMS++;
  }

  return {
    generatedAt: Date.now(),
    content: {
      publishedSeries,
      publishedEpisodes: publishedEpisodesCount,
      publishedShortFilms: publishedShortFilmsCount,
      homeRows,
      homeRowItems,
    },
    mediaGuardian,
    playbackTelemetry,
  };
}


