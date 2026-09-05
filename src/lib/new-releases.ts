import { createAdminClient } from "@/lib/supabase/admin";
import { timePerf } from "@/lib/api/perf";
import { isMediaAssetReady } from "@/lib/catalog-rules";
import {
  NEW_RELEASES_CHRONOLOGICAL_SOURCE,
  NEW_RELEASES_EDITORIAL_SOURCE,
  type NewReleasesSource,
} from "@/lib/ranking/editorial-provenance";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type SeriesRow = Database["public"]["Tables"]["series"]["Row"];
type ShortFilmRow = Database["public"]["Tables"]["short_films"]["Row"];
type HomeRowItemRow = Database["public"]["Tables"]["home_row_items"]["Row"];

export type HybridNewReleaseItem = {
  contentType: "series" | "short_film";
  seriesId: string | null;
  shortFilmId: string | null;
  slug: string;
  title: string;
  poster: string | null;
  sharePath: string;
  publishedAt: string | null;
  source: NewReleasesSource;
  sortOrder: number;
};

const NEW_RELEASES_LIMIT = 10;

async function fetchAutoSeries(supabase: SupabaseClient<Database>): Promise<SeriesRow[]> {
  const { data, error } = await timePerf("nr_series_q", () =>
    supabase
      .from("series")
      .select("*")
      .eq("status", "published")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(NEW_RELEASES_LIMIT * 3)
  );
  if (error) {
    console.warn("[new-releases] Unable to load series:", error.message);
    return [];
  }
  return data ?? [];
}

async function fetchAutoShortFilms(supabase: SupabaseClient<Database>): Promise<ShortFilmRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await timePerf("nr_short_films_q", () =>
    supabase
      .from("short_films")
      .select("*")
      .eq("status", "published")
      .lte("publish_at", nowIso)
      .order("publish_at", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true })
      .limit(NEW_RELEASES_LIMIT * 3)
  );
  if (error) {
    console.warn("[new-releases] Unable to load short films:", error.message);
    return [];
  }
  return data ?? [];
}

type ExclusionRow = {
  id: string;
  content_type: "series" | "short_film";
  series_id: string | null;
  short_film_id: string | null;
  excluded_at: string;
};

async function fetchExclusions(supabase: SupabaseClient<Database>): Promise<Set<string>> {
  const { data, error } = await timePerf("nr_exclusions_q", () =>
    supabase.from("home_new_releases_exclusions").select("*")
  );
  if (error) {
    console.warn("[new-releases] Unable to load exclusions:", error.message);
    return new Set();
  }
  const excluded = new Set<string>();
  for (const row of (data ?? []) as ExclusionRow[]) {
    if (row.content_type === "series" && row.series_id) {
      excluded.add("series:" + row.series_id);
    } else if (row.content_type === "short_film" && row.short_film_id) {
      excluded.add("short_film:" + row.short_film_id);
    }
  }
  return excluded;
}

async function fetchEditorialItems(
  supabase: SupabaseClient<Database>,
  rowId: string,
): Promise<HomeRowItemRow[]> {
  const { data, error } = await timePerf("nr_editorial_q", () =>
    supabase
      .from("home_row_items")
      .select("*")
      .eq("row_id", rowId)
      .order("sort_order", { ascending: true })
  );
  if (error) {
    console.warn("[new-releases] Unable to load editorial items:", error.message);
    return [];
  }
  return data ?? [];
}

async function getSeriesIdsWithConsumerEpisodes(
  seriesIds: string[],
  supabase: SupabaseClient<Database>,
): Promise<Set<string> | null> {
  if (!seriesIds.length) return new Set();
  const { data, error } = await timePerf("nr_series_episode_q", () =>
    supabase
      .from("episodes")
      .select("series_id")
      .in("series_id", seriesIds)
      .eq("status", "published")
      .not("media_asset_id", "is", null)
  );
  if (error) {
    console.warn("[new-releases] Unable to check series episodes:", error.message);
    return null;
  }
  const seriesWith = new Set<string>();
  for (const ep of data ?? []) {
    seriesWith.add(ep.series_id);
  }
  return seriesWith;
}

async function resolveShortFilmMediaReadiness(
  rows: readonly ShortFilmRow[],
  supabase: SupabaseClient<Database>,
): Promise<Map<string, boolean> | null> {
  if (!rows.length) return new Map();
  const assetIds = [
    ...new Set(
      rows
        .map((row) => row.media_asset_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (!assetIds.length) return new Map();
  const { data: assets, error } = await timePerf("nr_media_ready_q", () =>
    supabase
      .from("media_assets")
      .select("id,status,provider_playback_reference")
      .in("id", assetIds)
  );
  if (error) {
    console.warn("[new-releases] Unable to load media readiness:", error.message);
    return null;
  }
  const readyIds = new Set(
    (assets ?? [])
      .filter((asset) => isMediaAssetReady(asset))
      .map((asset) => asset.id)
  );
  return new Map(
    rows.map((row) => [
      row.id,
      Boolean(row.media_asset_id && readyIds.has(row.media_asset_id))
    ])
  );
}

function isPublishedSeries(row: Pick<SeriesRow, "status">) {
  return row.status === "published";
}

function isPublishedShortFilm(
  row: Pick<ShortFilmRow, "status" | "publish_at">,
  nowMs = Date.now()
) {
  return (
    row.status === "published" &&
    (!row.publish_at || new Date(row.publish_at).getTime() <= nowMs)
  );
}

export async function getHybridNewReleases(
  supabaseClient?: SupabaseClient<Database>
): Promise<HybridNewReleaseItem[]> {
  const supabase = supabaseClient ?? createAdminClient();

  const { data: nrRow } = await timePerf("nr_row_q", () =>
    supabase
      .from("home_rows")
      .select("id")
      .eq("title", "New Releases")
      .eq("row_role", "editorial")
      .eq("enabled", true)
      .maybeSingle()
  );

  const [autoSeries, autoShortFilms, exclusions, editorialItems] =
    await Promise.all([
      fetchAutoSeries(supabase),
      fetchAutoShortFilms(supabase),
      fetchExclusions(supabase),
      nrRow
        ? fetchEditorialItems(supabase, nrRow.id)
        : Promise.resolve([])
    ]);

  const seriesWithConsumerEpisodes =
    await getSeriesIdsWithConsumerEpisodes(
      autoSeries.map((s) => s.id),
      supabase
    );

  const shortFilmsReadyMap =
    await resolveShortFilmMediaReadiness(autoShortFilms, supabase);

  const items: HybridNewReleaseItem[] = [];
  const seenIds = new Set<string>();
  const now = Date.now();

  // Editorial items (pinned to top, sortOrder 0)
  for (const item of editorialItems) {
    if (item.content_type === "series" && item.series_id) {
      const series = autoSeries.find((s) => s.id === item.series_id);
      if (
        series &&
        isPublishedSeries(series) &&
        (seriesWithConsumerEpisodes === null ||
          seriesWithConsumerEpisodes.has(series.id))
      ) {
        const key = "series:" + series.id;
        if (!seenIds.has(key)) {
          items.push({
            contentType: "series",
            seriesId: series.id,
            shortFilmId: null,
            slug: series.slug,
            title: series.title,
            poster: series.poster_url ?? series.hero_image_url ?? null,
            sharePath: "/series/" + series.slug,
            publishedAt: series.published_at ?? null,
            source: NEW_RELEASES_EDITORIAL_SOURCE,
            sortOrder: 0
          });
          seenIds.add(key);
        }
      }
    } else if (item.content_type === "short_film" && item.short_film_id) {
      const sf = autoShortFilms.find((s) => s.id === item.short_film_id);
      if (sf && isPublishedShortFilm(sf, now)) {
        const key = "short_film:" + sf.id;
        const mediaReady = shortFilmsReadyMap?.get(sf.id) ?? false;
        if (!seenIds.has(key) && mediaReady) {
          items.push({
            contentType: "short_film",
            seriesId: null,
            shortFilmId: sf.id,
            slug: sf.slug,
            title: sf.title,
            poster: sf.poster_url ?? sf.hero_image_url ?? null,
            sharePath: "/short-films/" + sf.slug,
            publishedAt: sf.publish_at ?? null,
            source: NEW_RELEASES_EDITORIAL_SOURCE,
            sortOrder: 0
          });
          seenIds.add(key);
        }
      }
    }
  }

  // Automatic eligible content (after editorial, by chronology desc)
  for (const series of autoSeries) {
    if (!isPublishedSeries(series)) continue;
    if (!series.published_at) continue;
    const key = "series:" + series.id;
    if (seenIds.has(key)) continue;
    if (exclusions.has(key)) continue;
    if (
      seriesWithConsumerEpisodes !== null &&
      !seriesWithConsumerEpisodes.has(series.id)
    )
      continue;
    if (new Date(series.published_at).getTime() > now) continue;

    items.push({
      contentType: "series",
      seriesId: series.id,
      shortFilmId: null,
      slug: series.slug,
      title: series.title,
      poster: series.poster_url ?? series.hero_image_url ?? null,
      sharePath: "/series/" + series.slug,
      publishedAt: series.published_at ?? null,
      source: NEW_RELEASES_CHRONOLOGICAL_SOURCE,
      sortOrder: 1
    });
    seenIds.add(key);
  }

  for (const sf of autoShortFilms) {
    if (!isPublishedShortFilm(sf, now)) continue;
    const key = "short_film:" + sf.id;
    if (seenIds.has(key)) continue;
    if (exclusions.has(key)) continue;
    const mediaReady = shortFilmsReadyMap?.get(sf.id) ?? false;
    if (!mediaReady) continue;

    items.push({
      contentType: "short_film",
      seriesId: null,
      shortFilmId: sf.id,
      slug: sf.slug,
      title: sf.title,
      poster: sf.poster_url ?? sf.hero_image_url ?? null,
      sharePath: "/short-films/" + sf.slug,
      publishedAt: sf.publish_at ?? null,
      source: NEW_RELEASES_CHRONOLOGICAL_SOURCE,
      sortOrder: 1
    });
    seenIds.add(key);
  }

  // Sort: editorial (0) first, then auto (1) by publishedAt descending
  items.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });

  return items.slice(0, NEW_RELEASES_LIMIT);
}
