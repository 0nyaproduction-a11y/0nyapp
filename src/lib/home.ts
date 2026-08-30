import { createAdminClient } from "@/lib/supabase/admin";
import { timePerf } from "@/lib/api/perf";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type HomeContentType = "series" | "short_film";

export type HomeSpotlight = {
  id: string;
  contentType: HomeContentType;
  slug: string;
  title: string;
  poster: string | null;
  synopsis: string | null;
  sharePath: string;
  showTitle: boolean;
};

export type HomeRowItem = {
  id: string;
  contentType: HomeContentType;
  slug: string;
  title: string;
  poster: string | null;
  sharePath: string;
};

export type HomeRow = {
  id: string;
  title: string;
  role: "start_here" | "editorial" | "spotlight";
  enabled: boolean;
  sortOrder: number;
  items: HomeRowItem[];
};

export type HomeState = {
  state: "H01" | "H02" | null;
  startHereVisible: boolean | null;
  viewerStateKnown: boolean;
  lowHistoryThreshold: number | null;
  completedCount: number;
  isGuest: boolean;
  spotlight: HomeSpotlight | null;
  spotlights: HomeSpotlight[];
  rows: HomeRow[];
};

type HomeSettingsRow = Database["public"]["Tables"]["home_settings"]["Row"];
type HomeMembershipRow = Database["public"]["Tables"]["home_row_items"]["Row"];
type SeriesRow = Database["public"]["Tables"]["series"]["Row"];
type ShortFilmRow = Database["public"]["Tables"]["short_films"]["Row"];

function getConfiguredLowHistoryThreshold(row?: Pick<HomeSettingsRow, "value"> | null) {
  const value = row?.value;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Number.isInteger(value) ? value : Math.floor(value);
}

function isPublishedSeries(row: Pick<SeriesRow, "status">) {
  return row.status === "published";
}

function isPublishedShortFilm(row: Pick<ShortFilmRow, "status" | "publish_at">) {
  return row.status === "published" && (!row.publish_at || new Date(row.publish_at).getTime() <= Date.now());
}

function resolveSpotlightItem(
  item: HomeMembershipRow,
  seriesById: Map<string, SeriesRow>,
  shortFilmsById: Map<string, ShortFilmRow>,
): HomeSpotlight | null {
  if (item.content_type === "series" && item.series_id) {
    const series = seriesById.get(item.series_id);
    if (series && isPublishedSeries(series)) {
      return {
        id: series.id,
        contentType: "series",
        slug: series.slug,
        title: series.title,
        poster: series.poster_url ?? series.hero_image_url ?? null,
        synopsis: series.synopsis ?? null,
        sharePath: `/series/${series.slug}`,
        showTitle: item.show_title,
      };
    }
    return null;
  }

  if (item.content_type === "short_film" && item.short_film_id) {
    const shortFilm = shortFilmsById.get(item.short_film_id);
    if (shortFilm && isPublishedShortFilm(shortFilm)) {
      return {
        id: shortFilm.id,
        contentType: "short_film",
        slug: shortFilm.slug,
        title: shortFilm.title,
        poster: shortFilm.poster_url ?? shortFilm.hero_image_url ?? null,
        synopsis: shortFilm.synopsis ?? null,
        sharePath: `/short-films/${shortFilm.slug}`,
        showTitle: item.show_title,
      };
    }
    return null;
  }

  return null;
}

export async function getHomeState(
  userId?: string | null,
  supabaseClient?: SupabaseClient<Database>,
): Promise<HomeState> {
  const supabase = supabaseClient ?? createAdminClient();

  const [{ data: settingsRow }, { data: rows }] = await Promise.all([
    timePerf("home_settings_q", () =>
      supabase.from("home_settings").select("value").eq("key", "low_history_threshold").maybeSingle()
    ),
    timePerf("home_rows_q", () =>
      supabase.from("home_rows").select("*").eq("enabled", true).order("sort_order", { ascending: true })
    ),
  ]);

  const lowHistoryThreshold = getConfiguredLowHistoryThreshold(settingsRow);
  if (lowHistoryThreshold === null) {
    console.warn("[0nya home] missing or invalid low_history_threshold config; server state remains unknown.");
  }
  const viewerStateKnown = !!userId && lowHistoryThreshold !== null;
  const enabledRows = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    role: row.row_role,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    items: [] as HomeRowItem[],
  }));

  let completedCount = 0;
  if (userId) {
    const { data: completedProgress } = await timePerf("watch_progress_q", () =>
      supabase
        .from("watch_progress")
        .select("id")
        .eq("user_id", userId)
        .eq("completed", true)
    );
    completedCount = completedProgress?.length ?? 0;
  }

  if (!enabledRows.length) {
    const state: HomeState["state"] =
      viewerStateKnown && userId ? (completedCount < lowHistoryThreshold! ? "H01" : "H02") : null;

    return {
      state,
      startHereVisible: viewerStateKnown && userId ? false : null,
      viewerStateKnown,
      lowHistoryThreshold,
      completedCount,
      isGuest: !userId,
      spotlight: null,
      spotlights: [],
      rows: [],
    };
  }

  const rowIds = enabledRows.map((row) => row.id);
  const { data: memberships } = rowIds.length
    ? await timePerf("home_items_q", () =>
        supabase
          .from("home_row_items")
          .select("*")
          .in("row_id", rowIds)
          .order("sort_order", { ascending: true })
      )
    : { data: [] as HomeMembershipRow[] };

  const seriesIds = (memberships ?? [])
    .filter((item) => item.content_type === "series" && item.series_id)
    .map((item) => item.series_id as string);
  const shortFilmIds = (memberships ?? [])
    .filter((item) => item.content_type === "short_film" && item.short_film_id)
    .map((item) => item.short_film_id as string);

  const [seriesRows, shortFilmRows] = await Promise.all([
    seriesIds.length
      ? timePerf("home_series_refetch", () =>
          supabase.from("series").select("*").in("id", seriesIds).eq("status", "published")
        )
      : { data: [] as SeriesRow[] },
    shortFilmIds.length
      ? timePerf("home_short_films_refetch", () =>
          supabase.from("short_films").select("*").in("id", shortFilmIds).eq("status", "published")
        )
      : { data: [] as ShortFilmRow[] },
  ]);

  const seriesById = new Map((seriesRows.data ?? []).map((series) => [series.id, series]));
  const shortFilmsById = new Map((shortFilmRows.data ?? []).map((shortFilm) => [shortFilm.id, shortFilm]));

  const membershipsByRow = new Map<string, HomeMembershipRow[]>();
  for (const item of memberships ?? []) {
    const current = membershipsByRow.get(item.row_id) ?? [];
    current.push(item);
    membershipsByRow.set(item.row_id, current);
  }

  // Resolve Spotlight collection from the single enabled spotlight row.
  // ALL valid (published) items are returned in home_row_items.sort_order ASC.
  // `spotlight` remains the backward-compatible first valid item (or null).
  const spotlights: HomeSpotlight[] = [];
  const spotlightRow = enabledRows.find((row) => row.role === "spotlight");
  if (spotlightRow) {
    const spotlightItems = membershipsByRow.get(spotlightRow.id) ?? [];
    for (const item of spotlightItems) {
      const resolved = resolveSpotlightItem(item, seriesById, shortFilmsById);
      if (resolved) {
        spotlights.push(resolved);
      }
    }
  }
  const spotlight: HomeSpotlight | null = spotlights[0] ?? null;

  // Exclude spotlight row from standard consumer rows list
  const consumerRows = enabledRows.filter((row) => row.role !== "spotlight");

  const rowsWithItems: HomeRow[] = consumerRows.map((row) => {
    const rowItems: HomeRowItem[] = [];

    for (const item of membershipsByRow.get(row.id) ?? []) {
      if (item.content_type === "series") {
        const series = item.series_id ? seriesById.get(item.series_id) : null;
        if (!series || !isPublishedSeries(series)) {
          continue;
        }

        rowItems.push({
          id: series.id,
          contentType: "series",
          slug: series.slug,
          title: series.title,
          poster: series.poster_url ?? null,
          sharePath: `/series/${series.slug}`,
        });
        continue;
      }

      const shortFilm = item.short_film_id ? shortFilmsById.get(item.short_film_id) : null;
      if (!shortFilm || !isPublishedShortFilm(shortFilm)) {
        continue;
      }

      rowItems.push({
        id: shortFilm.id,
        contentType: "short_film",
        slug: shortFilm.slug,
        title: shortFilm.title,
        poster: shortFilm.poster_url ?? null,
        sharePath: `/short-films/${shortFilm.slug}`,
      });
    }

    return {
      id: row.id,
      title: row.title,
      role: row.role,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
      items: rowItems,
    };
  });

  const hasStartHereRow = rowsWithItems.some((row) => row.role === "start_here");
  const startHereVisible =
    viewerStateKnown && userId ? hasStartHereRow && completedCount < lowHistoryThreshold! : null;
  const state: HomeState["state"] =
    viewerStateKnown && userId ? (completedCount < lowHistoryThreshold! ? "H01" : "H02") : null;

  return {
    state,
    startHereVisible,
    viewerStateKnown,
    lowHistoryThreshold,
    completedCount,
    isGuest: !userId,
    spotlight,
    spotlights,
    rows: rowsWithItems,
  };
}
