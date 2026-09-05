import { createAdminClient } from "@/lib/supabase/admin";
import { getSeriesIdsWithConsumerEpisodes } from "@/lib/catalog";
import { timePerf } from "@/lib/api/perf";
import { getHybridNewReleases } from "@/lib/new-releases";
import {
  EDITORIAL_RANKING_POLICY,
  HOME_EDITORIAL_POLICY_VERSION,
  computeHomeEditorialConfigHash,
  computeHomeEditorialConfigVersion,
  NEW_RELEASES_EDITORIAL_SOURCE,
  type NewReleasesSource,
} from "@/lib/ranking/editorial-provenance";
import {
  createRankingDecisionEvidence,
  type RankingDecisionEvidence,
  type RankingEditorialIntervention,
  type RecommendationReason,
} from "@/lib/ranking/decision-evidence";
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
  source?: NewReleasesSource;
};

export type HomeRow = {
  id: string;
  title: string;
  role: "start_here" | "editorial" | "spotlight" | "category";
  enabled: boolean;
  sortOrder: number;
  rankingPolicy: typeof EDITORIAL_RANKING_POLICY;
  rankingPolicyVersion: typeof HOME_EDITORIAL_POLICY_VERSION;
  configVersion: string;
  configHash: string;
  rankingDecisionId: string;
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
  spotlightRowId: string | null;
  spotlightRankingDecisionId: string | null;
  rows: HomeRow[];
};

export type HomeStateWithDecisionEvidence = HomeState & {
  rankingDecisionEvidence: RankingDecisionEvidence[];
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

function withEditorialIdentity<T extends Omit<HomeRow, "rankingPolicy" | "rankingPolicyVersion" | "configVersion" | "configHash" | "rankingDecisionId">>(
  row: T,
  configVersion: string,
  configHash: string,
): T & Pick<HomeRow, "rankingPolicy" | "rankingPolicyVersion" | "configVersion" | "configHash"> {
  return {
    ...row,
    rankingPolicy: EDITORIAL_RANKING_POLICY,
    rankingPolicyVersion: HOME_EDITORIAL_POLICY_VERSION,
    configVersion,
    configHash,
  };
}

function getHomeRecommendationReason(row: Pick<HomeRow, "role" | "title">): RecommendationReason {
  if (row.title === "New Releases") return "NEW_RELEASE";
  if (row.role === "category") return "FORMAT_FILTER";
  return "EDITORIAL";
}

function getHomeEditorialIntervention(
  row: Pick<HomeRow, "role" | "title">,
  item: HomeRowItem,
): RankingEditorialIntervention | null {
  if (row.title === "New Releases") {
    return item.source === NEW_RELEASES_EDITORIAL_SOURCE ? "EDITORIAL_PIN" : null;
  }
  return row.role === "category" ? null : "EDITORIAL_ORDER";
}

function createHomeRowDecision(row: Omit<HomeRow, "rankingDecisionId">) {
  const candidates = row.items.map((item, index) => {
    const recommendationReason = getHomeRecommendationReason(row);
    const editorialIntervention = getHomeEditorialIntervention(row, item);
    return {
      contentId: item.id,
      contentType: item.contentType === "series" ? "MICRO_DRAMA" as const : "SHORT_FILM" as const,
      eligible: true,
      filterReason: null,
      preRankPosition: index + 1,
      finalPosition: index + 1,
      recommendationReason,
      editorialIntervention,
      editorialChangeRef: null,
    };
  });

  return createRankingDecisionEvidence({
    sessionId: null,
    rankingPolicy: row.rankingPolicy,
    rankingPolicyVersion: row.rankingPolicyVersion,
    configVersion: row.configVersion,
    configHash: row.configHash,
    rankingEngineVersion: "home_server_v1",
    sourceSurface: "home",
    rowId: row.id,
    requestContext: { rowRole: row.role },
    candidates,
    orderedResults: candidates.map((candidate) => ({
      contentId: candidate.contentId,
      contentType: candidate.contentType,
      position: candidate.finalPosition!,
      recommendationReason: candidate.recommendationReason,
      editorialIntervention: candidate.editorialIntervention,
      editorialChangeRef: candidate.editorialChangeRef,
      selectionProbability: null,
    })),
  });
}

function createHomeSpotlightDecision(
  rowId: string,
  spotlights: HomeSpotlight[],
  configVersion: string,
  configHash: string,
) {
  const candidates = spotlights.map((item, index) => ({
    contentId: item.id,
    contentType: item.contentType === "series" ? "MICRO_DRAMA" as const : "SHORT_FILM" as const,
    eligible: true,
    filterReason: null,
    preRankPosition: index + 1,
    finalPosition: index + 1,
    recommendationReason: "EDITORIAL" as const,
    editorialIntervention: "EDITORIAL_ORDER" as const,
    editorialChangeRef: null,
  }));

  return createRankingDecisionEvidence({
    sessionId: null,
    rankingPolicy: EDITORIAL_RANKING_POLICY,
    rankingPolicyVersion: HOME_EDITORIAL_POLICY_VERSION,
    configVersion,
    configHash,
    rankingEngineVersion: "home_server_v1",
    sourceSurface: "home",
    rowId,
    requestContext: { rowRole: "spotlight" },
    candidates,
    orderedResults: candidates.map((candidate) => ({
      contentId: candidate.contentId,
      contentType: candidate.contentType,
      position: candidate.finalPosition,
      recommendationReason: candidate.recommendationReason,
      editorialIntervention: candidate.editorialIntervention,
      editorialChangeRef: null,
      selectionProbability: null,
    })),
  });
}

function resolveSpotlightItem(
  item: HomeMembershipRow,
  seriesById: Map<string, SeriesRow>,
  shortFilmsById: Map<string, ShortFilmRow>,
  seriesWithConsumerEpisodes: Set<string> | null,
): HomeSpotlight | null {
  if (item.content_type === "series" && item.series_id) {
    const series = seriesById.get(item.series_id);
    if (
      series &&
      isPublishedSeries(series) &&
      (seriesWithConsumerEpisodes === null || seriesWithConsumerEpisodes.has(series.id))
    ) {
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
): Promise<HomeStateWithDecisionEvidence> {
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

  const allRowIds = enabledRows.map((row) => row.id);
  const { data: configItems } = allRowIds.length
    ? await timePerf("home_config_items_q", () =>
        supabase
          .from("home_row_items")
          .select("*")
          .in("row_id", allRowIds)
          .order("sort_order", { ascending: true })
      )
    : { data: [] as HomeMembershipRow[] };

  const configHash = computeHomeEditorialConfigHash({
    lowHistoryThreshold,
    rows: rows ?? [],
    items: configItems ?? [],
  });
  const configVersion = computeHomeEditorialConfigVersion({
    lowHistoryThreshold,
    rows: rows ?? [],
    items: configItems ?? [],
  });

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
      spotlightRowId: null,
      spotlightRankingDecisionId: null,
      rows: [],
      rankingDecisionEvidence: [],
    };
  }

  const manualRowIds = enabledRows
    .filter((row) => row.role !== "category")
    .map((row) => row.id);
  const { data: memberships } = manualRowIds.length
    ? await timePerf("home_items_q", () =>
        supabase
          .from("home_row_items")
          .select("*")
          .in("row_id", manualRowIds)
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

  // Keep Home consistent with the consumer catalog: a series item is only
  // surfaced when it serves at least one published, media-ready episode.
  // null => lookup failed; fail open so curated rows are retained.
  const seriesWithConsumerEpisodes = await getSeriesIdsWithConsumerEpisodes(
    Array.from(seriesById.keys()),
    supabase,
  );

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
      const resolved = resolveSpotlightItem(item, seriesById, shortFilmsById, seriesWithConsumerEpisodes);
      if (resolved) {
        spotlights.push(resolved);
      }
    }
  }
  const spotlight: HomeSpotlight | null = spotlights[0] ?? null;

  // Exclude spotlight and category rows from standard consumer rows list
  const consumerRows = enabledRows.filter((row) => row.role !== "spotlight" && row.role !== "category");

  // Category rows ("Micro Dramas", "Short Films") auto-populate items from the
  // authoritative catalog. Manual home_row_items membership must NOT control
  // these rows' catalog contents.
  const categoryRows = enabledRows.filter((row) => row.role === "category");
  const hasCategoryRows = categoryRows.length > 0;

  let allPublishedSeries: SeriesRow[] = [];
  let allPublishedShortFilms: ShortFilmRow[] = [];

  if (hasCategoryRows) {
    const [{ data: seriesRows }, { data: shortFilmRows }] = await Promise.all([
      timePerf("home_all_series_q", () =>
        supabase.from("series").select("*").eq("status", "published").order("sort_order", { ascending: true })
      ),
      timePerf("home_all_short_films_q", () =>
        supabase
          .from("short_films")
          .select("*")
          .eq("status", "published")
          .order("publish_at", { ascending: true, nullsFirst: true })
          .order("title", { ascending: true })
      ),
    ]);

    allPublishedSeries = seriesRows ?? [];
    allPublishedShortFilms = shortFilmRows ?? [];
  }

  // Series that have at least one published, media-ready episode (consistent
  // with consumer catalog eligibility).
  const seriesWithConsumerEpisodeSet = hasCategoryRows
    ? await getSeriesIdsWithConsumerEpisodes(
        allPublishedSeries.map((s) => s.id),
        supabase,
      )
    : null;

  const categoryItems: Array<Omit<HomeRow, "rankingPolicy" | "rankingPolicyVersion" | "configVersion" | "configHash" | "rankingDecisionId">> = categoryRows.map((row) => {
    if (row.title === "Micro Dramas") {
      const eligibleSeries = allPublishedSeries.filter((series) => {
        if (seriesWithConsumerEpisodeSet === null) {
          return isPublishedSeries(series);
        }
        return isPublishedSeries(series) && seriesWithConsumerEpisodeSet.has(series.id);
      });

      return {
        ...row,
        items: eligibleSeries.map((series) => ({
          id: series.id,
          contentType: "series" as const,
          slug: series.slug,
          title: series.title,
          poster: series.poster_url ?? series.hero_image_url ?? null,
          sharePath: `/series/${series.slug}`,
        })),
      };
    }

    if (row.title === "Short Films") {
      return {
        ...row,
        items: allPublishedShortFilms
          .filter((sf) => isPublishedShortFilm(sf))
          .map((shortFilm) => ({
            id: shortFilm.id,
            contentType: "short_film" as const,
            slug: shortFilm.slug,
            title: shortFilm.title,
            poster: shortFilm.poster_url ?? shortFilm.hero_image_url ?? null,
            sharePath: `/short-films/${shortFilm.slug}`,
          })),
      };
    }

    return { ...row, items: [] as HomeRowItem[] };
  });

  const rowsWithItems: Array<Omit<HomeRow, "rankingDecisionId">> = await Promise.all(
    consumerRows.map(async (row) => {
      // New Releases row uses the hybrid resolver (automatic + editorial)
      if (row.title === "New Releases") {
        const hybridItems = await getHybridNewReleases(supabase);
        const rowItems: HomeRowItem[] = hybridItems.map((item) => ({
          id: item.seriesId ?? item.shortFilmId ?? item.slug,
          contentType: item.contentType,
          slug: item.slug,
          title: item.title,
          poster: item.poster,
          sharePath: item.sharePath,
          source: item.source,
        }));
        return withEditorialIdentity({
          id: row.id,
          title: row.title,
          role: row.role,
          enabled: row.enabled,
          sortOrder: row.sortOrder,
          items: rowItems,
        }, configVersion, configHash);
      }

      const rowItems: HomeRowItem[] = [];

    for (const item of membershipsByRow.get(row.id) ?? []) {
      if (item.content_type === "series") {
        const series = item.series_id ? seriesById.get(item.series_id) : null;
        if (!series || !isPublishedSeries(series)) {
          continue;
        }

        if (seriesWithConsumerEpisodes !== null && !seriesWithConsumerEpisodes.has(series.id)) {
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

    return withEditorialIdentity({
      id: row.id,
      title: row.title,
      role: row.role,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
      items: rowItems,
    }, configVersion, configHash);
  }));

  // Append category rows (auto-populated from catalog) after consumer rows.
  // CMS sort_order preserves Micro Dramas above Short Films.
  const allRows = [...rowsWithItems, ...categoryItems.map((row) => withEditorialIdentity(row, configVersion, configHash))];

  const hasStartHereRow = allRows.some((row) => row.role === "start_here");
  const startHereVisible =
    viewerStateKnown && userId ? hasStartHereRow && completedCount < lowHistoryThreshold! : null;
  const state: HomeState["state"] =
    viewerStateKnown && userId ? (completedCount < lowHistoryThreshold! ? "H01" : "H02") : null;

  const rowDecisions = allRows.map((row) => createHomeRowDecision(row));
  const rankedRows = allRows.map((row, index) => ({
    ...row,
    rankingDecisionId: rowDecisions[index].rankingDecisionId,
  }));
  const spotlightDecision = spotlightRow
    ? createHomeSpotlightDecision(spotlightRow.id, spotlights, configVersion, configHash)
    : null;

  return {
    state,
    startHereVisible,
    viewerStateKnown,
    lowHistoryThreshold,
    completedCount,
    isGuest: !userId,
    spotlight,
    spotlights,
    spotlightRowId: spotlightRow?.id ?? null,
    spotlightRankingDecisionId: spotlightDecision?.rankingDecisionId ?? null,
    rows: rankedRows,
    rankingDecisionEvidence: spotlightDecision ? [spotlightDecision, ...rowDecisions] : rowDecisions,
  };
}
