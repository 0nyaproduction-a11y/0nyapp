import type { ExploreFormat, SearchResultContext } from "../navigation/types";
import type { ApiSeries, ApiShortFilm } from "../types/api";
import {
  filterDiscoverableItems,
  getStableDiscoveryKey,
  type DiscoverableItem,
} from "./discovery";
import { getCanonicalGenres } from "./taxonomy";

export const SEARCH_MATCH_PRIORITY = {
  exactTitle: 0,
  prefixTitle: 1,
  substringTitle: 2,
  exactCreator: 3,
  prefixCreator: 4,
  substringCreator: 5,
  exactGenre: 6,
  substringGenre: 7,
  exactContentType: 8,
  substringContentType: 9,
  exactLanguage: 10,
  substringLanguage: 11,
  episodeTitle: 12,
  synopsis: 13,
  description: 14,
} as const;

export type SearchMatchReason = keyof typeof SEARCH_MATCH_PRIORITY;

export type SearchResult = DiscoverableItem & {
  matchPriority: number;
  matchReason: SearchMatchReason | "no_query";
};

export function normalizeSearchQuery(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function compareText(first: string, second: string) {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function matchText(
  value: string | null | undefined,
  query: string,
  exactReason: SearchMatchReason,
  substringReason: SearchMatchReason,
  prefixReason?: SearchMatchReason,
) {
  const normalizedValue = normalizeSearchQuery(value ?? "");
  if (!normalizedValue) return null;
  if (normalizedValue === query) return exactReason;
  if (prefixReason && normalizedValue.startsWith(query)) return prefixReason;
  if (normalizedValue.includes(query)) return substringReason;
  return null;
}

function contentTypeLabels(entry: DiscoverableItem) {
  return entry.contentType === "MICRO_DRAMA"
    ? ["micro drama", "micro dramas"]
    : ["short film", "short films"];
}

function getMatchReason(entry: DiscoverableItem, query: string) {
  const titleMatch = matchText(
    entry.item.title,
    query,
    "exactTitle",
    "substringTitle",
    "prefixTitle",
  );
  if (titleMatch) return titleMatch;

  if (entry.contentType === "SHORT_FILM") {
    const creatorMatch = matchText(
      entry.item.creatorReference,
      query,
      "exactCreator",
      "substringCreator",
      "prefixCreator",
    );
    if (creatorMatch) return creatorMatch;
  }

  for (const genre of getCanonicalGenres(entry.item)) {
    const genreMatch = matchText(
      genre.displayName,
      query,
      "exactGenre",
      "substringGenre",
    );
    if (genreMatch) return genreMatch;
  }

  for (const label of contentTypeLabels(entry)) {
    const contentTypeMatch = matchText(
      label,
      query,
      "exactContentType",
      "substringContentType",
    );
    if (contentTypeMatch) return contentTypeMatch;
  }

  const languageMatch = matchText(
    entry.item.language,
    query,
    "exactLanguage",
    "substringLanguage",
  );
  if (languageMatch) return languageMatch;

  if (entry.contentType === "MICRO_DRAMA") {
    const episodeTitleMatch = entry.item.episodes.some((episode) =>
      normalizeSearchQuery(episode.title).includes(query),
    );
    if (episodeTitleMatch) return "episodeTitle";
  }

  if (normalizeSearchQuery(entry.item.synopsis).includes(query)) {
    return "synopsis";
  }

  if (
    entry.contentType === "MICRO_DRAMA" &&
    entry.item.episodes.some((episode) =>
      normalizeSearchQuery(episode.description).includes(query),
    )
  ) {
    return "description";
  }

  return null;
}

export function searchDiscoverableItems(
  entries: DiscoverableItem[],
  query: string,
  selectedFormat: ExploreFormat,
  selectedGenre: string,
) {
  const filtered = filterDiscoverableItems(
    entries,
    selectedFormat,
    selectedGenre,
  );
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    return filtered.map<SearchResult>((entry) => ({
      ...entry,
      matchPriority: Number.MAX_SAFE_INTEGER,
      matchReason: "no_query",
    }));
  }

  const results: SearchResult[] = [];
  for (const entry of filtered) {
    const matchReason = getMatchReason(entry, normalizedQuery);
    if (matchReason) {
      results.push({
        ...entry,
        matchPriority: SEARCH_MATCH_PRIORITY[matchReason],
        matchReason,
      });
    }
  }

  return results.sort(
    (first, second) =>
      first.matchPriority - second.matchPriority ||
      compareText(
        normalizeSearchQuery(first.item.title),
        normalizeSearchQuery(second.item.title),
      ) ||
      compareText(getStableDiscoveryKey(first), getStableDiscoveryKey(second)),
  );
}

export function createSearchResultContext(
  entry: DiscoverableItem,
  query: string,
  zeroBasedPosition: number,
  rankingDecisionId?: string | null,
  recommendationReason?: SearchResultContext["recommendationReason"],
): SearchResultContext {
  return {
    contentId: entry.item.id ?? entry.item.slug,
    contentSlug: entry.item.slug,
    contentType: entry.contentType,
    searchQueryContext: normalizeSearchQuery(query),
    searchResultPosition: zeroBasedPosition + 1,
    sourceSurface: "search",
    ...(rankingDecisionId !== undefined ? { rankingDecisionId: rankingDecisionId ?? null } : {}),
    ...(recommendationReason !== undefined ? { recommendationReason: recommendationReason ?? null } : {}),
  };
}
