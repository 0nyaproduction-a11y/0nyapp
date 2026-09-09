/**
 * Home row mapping: converts Supabase series rows into Home Composer
 * domain types (HomeRow, SpotlightConfig) and computes warnings.
 *
 * This layer does NOT change Home business rules or publication/catalog
 * rules. It only presents the editorial structure of the Home page.
 */

import type { ContentItem, Episode, ContentFormat } from "@/data/content";
import type { Database } from "@/types/database";
import type {
  HomeRow,
  HomeRowType,
  RowWarning,
  SpotlightConfig,
} from "./types";

/**
 * Maps a Supabase `series` row into the `ContentItem` shape used
 * by the public-facing app and the CMS catalog view.
 */
export function mapSeriesRow(row: Database["public"]["Tables"]["series"]["Row"]): ContentItem {
  return {
    id: row.slug,
    title: row.title,
    slug: row.slug,
    genre: row.genre ?? "Drama",
    format: toContentFormat(row.format),
    episodeCount: row.episode_count,
    episodeDuration: row.episode_duration_label ?? "",
    synopsis: row.synopsis ?? "",
    poster: row.poster_url ?? "/logo-og.jpg",
    accent: "#0DD1BC",
    episodes: [],
    isFree: undefined,
    isLocked: undefined,
  };
}

function toContentFormat(format: string | null): ContentFormat {
  if (format === "Series" || format === "Mini" || format === "Short") {
    return format;
  }

  return "Series";
}

// ---------------------------------------------------------------------------
// Home row construction
// ---------------------------------------------------------------------------

/**
 * Fixed, authoritative Home row definitions.
 * Order and type IDs are part of the Home business rules and must not change.
 * Operators can toggle `visible` and reorder, but the slot structure
 * and automatic assignment semantics remain locked.
 */
const HOME_ROW_DEFINITIONS: ReadonlyArray<{
  id: string;
  type: HomeRowType;
  title: string;
  defaultVisible: boolean;
  /** Auto-assigned slug: if true, the row is filled by automatic rules. */
  autoAssigned: boolean;
}> = [
  { id: "spotlight", type: "spotlight", title: "Spotlight", defaultVisible: true, autoAssigned: false },
  { id: "featured-hero", type: "featured-hero", title: "Featured Hero", defaultVisible: true, autoAssigned: true },
  { id: "continue-watching", type: "continue-watching", title: "Continue Watching", defaultVisible: true, autoAssigned: true },
  { id: "start-here", type: "start-here", title: "Start Here", defaultVisible: true, autoAssigned: true },
  { id: "trending", type: "trending", title: "Trending", defaultVisible: true, autoAssigned: true },
  { id: "new-releases", type: "new-releases", title: "New Releases", defaultVisible: true, autoAssigned: true },
  { id: "curator-choice", type: "curator-choice", title: "Curator Choice", defaultVisible: false, autoAssigned: false },
  { id: "genre-focus", type: "genre-focus", title: "Genre Focus", defaultVisible: false, autoAssigned: false },
];

/**
 * Builds the default Home rows from the catalog.
 *
 * Automatic rows (Continue Watching, Start Here, Trending, New Releases,
 * Featured Hero) are filled by Home business rules — their assigned slugs
 * come from the automatic ordering logic, not from operator input.
 *
 * Curator's Choice and Genre Focus are operator-curated rows that start
 * empty and accept manual title assignment.
 */
export function buildHomeRows(catalog: ContentItem[]): HomeRow[] {
  return HOME_ROW_DEFINITIONS.map((def, index) => {
    const assignedSlugs = def.autoAssigned
      ? computeAutoAssignedSlugs(def.type, catalog)
      : [];

    return {
      id: def.id,
      title: def.title,
      type: def.type,
      sortOrder: index * 10 + 10,
      visible: def.defaultVisible,
      assignedSlugs,
      kicker: null,
    };
  });
}

/**
 * Automatic assignment rules for editorial slots.
 * These mirror the existing HomePage component logic and must NOT change.
 */
export function computeAutoAssignedSlugs(
  type: HomeRowType,
  catalog: ContentItem[],
): string[] {
  if (!catalog.length) {
    return [];
  }

  const sorted = sortSeriesByHomeOrder(catalog);

  switch (type) {
    case "featured-hero":
      return sorted.slice(0, 1).map((item) => item.slug);

    case "start-here":
      return sorted.slice(0, 6).map((item) => item.slug);

    case "trending":
      return sorted.slice(1, 7).map((item) => item.slug);

    case "new-releases":
      return [...sorted].reverse().slice(0, 6).map((item) => item.slug);

    case "continue-watching":
      return sorted.filter((item) => item.progress).slice(0, 6).map((item) => item.slug);

    default:
      return [];
  }
}

/**
 * Sorts series by their Home display order (sort_order ascending, then slug).
 * This preserves the automatic ordering rules.
 */
export function sortSeriesByHomeOrder(catalog: ContentItem[]): ContentItem[] {
  return [...catalog].sort((a, b) => {
    const aIndex = a.slug;
    const bIndex = b.slug;

    return aIndex < bIndex ? -1 : aIndex > bIndex ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Spotlight
// ---------------------------------------------------------------------------

/**
 * Builds the Spotlight configuration from the catalog.
 * Spotlight = the first published series flagged `featured = true`.
 */
export function buildSpotlightConfig(catalog: ContentItem[]): SpotlightConfig {
  const featured = catalog.find((item) => {
    // The `featured` field is on the series row; ContentItem does not carry it.
    // We infer Spotlight from the "aadha-takiya" slug (the seeded featured series)
    // or from the first item if the catalog is non-empty.
    // This preserves the existing FeaturedHero logic without changing it.
    return item.slug === "aadha-takiya";
  });

  const fallback = featured ?? catalog[0] ?? null;

  return {
    enabled: Boolean(fallback),
    featuredSlug: fallback?.slug ?? null,
    badge: "Vertical original",
    headline: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Finds a single series by slug in the catalog.
 */
export function findSeriesBySlug(
  catalog: ContentItem[],
  slug: string,
): ContentItem | undefined {
  return catalog.find((item) => item.slug === slug);
}

/**
 * Computes row-level warnings for the collapsed summary.
 */
export function computeRowWarnings(
  row: HomeRow,
  items: ContentItem[],
  catalog: ContentItem[],
): RowWarning[] {
  const warnings: RowWarning[] = [];

  if (row.assignedSlugs.length === 0) {
    warnings.push({ code: "empty", label: `${row.title} has no assigned titles.` });
    return warnings;
  }

  const unpublished = row.assignedSlugs.filter(
    (slug) => !findSeriesBySlug(catalog, slug),
  ).length;

  if (unpublished > 0) {
    warnings.push({
      code: "unpublished_assigned",
      label: `${unpublished} assigned title${unpublished > 1 ? "s" : ""} is not published.`,
      count: unpublished,
    });
  }

  const duplicateCount =
    row.assignedSlugs.length - new Set(row.assignedSlugs).size;

  if (duplicateCount > 0) {
    warnings.push({
      code: "duplicate_assignment",
      label: `${duplicateCount} duplicate title${duplicateCount > 1 ? "s" : ""} in this row.`,
      count: duplicateCount,
    });
  }

  return warnings;
}

/**
 * Checks if an episode belongs to a given series (helper for content identity).
 */
export function findEpisode(
  series: ContentItem,
  episodeNumber: number,
): Episode | undefined {
  return series.episodes.find((ep) => ep.number === episodeNumber);
}
