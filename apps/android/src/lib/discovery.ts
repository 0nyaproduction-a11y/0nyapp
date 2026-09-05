import type { ExploreFormat } from "../navigation/types";
import type { ApiGenre, ApiSeries, ApiShortFilm } from "../types/api";
import {
  getCanonicalGenres,
  isMicroDrama,
  isShortFilm,
  itemHasGenre,
} from "./taxonomy";

export const ALL_GENRES_FILTER = "All";

export type ExploreSortMode = "default" | "newest";

export type GenreFilterOption = ApiGenre;

export type DiscoverableItem =
  | {
      contentType: "MICRO_DRAMA";
      item: ApiSeries;
      originalIndex: number;
    }
  | {
      contentType: "SHORT_FILM";
      item: ApiShortFilm;
      originalIndex: number;
    };

export function getReleaseTimestamp(item: ApiSeries | ApiShortFilm) {
  const value = "publishAt" in item ? item.publishAt : item.publishedAt;
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getStableDiscoveryKey(entry: DiscoverableItem) {
  return `${entry.contentType}:${entry.item.slug}`;
}

export function toDiscoverableItems(
  catalog: ApiSeries[],
  shortFilms: ApiShortFilm[],
) {
  return [
    ...catalog.map<DiscoverableItem>((item, originalIndex) => ({
      contentType: "MICRO_DRAMA",
      item,
      originalIndex,
    })),
    ...shortFilms.map<DiscoverableItem>((item, index) => ({
      contentType: "SHORT_FILM",
      item,
      originalIndex: catalog.length + index,
    })),
  ];
}

export function matchesFormat(
  entry: DiscoverableItem,
  selectedFormat: ExploreFormat,
) {
  if (selectedFormat === "micro-dramas") {
    return (
      entry.contentType === "MICRO_DRAMA" &&
      isMicroDrama(entry.item as ApiSeries)
    );
  }

  if (selectedFormat === "short-films") {
    return (
      entry.contentType === "SHORT_FILM" &&
      isShortFilm(entry.item as ApiShortFilm)
    );
  }

  return (
    (entry.contentType === "MICRO_DRAMA" &&
      isMicroDrama(entry.item as ApiSeries)) ||
    (entry.contentType === "SHORT_FILM" &&
      isShortFilm(entry.item as ApiShortFilm))
  );
}

export function filterDiscoverableItems(
  entries: DiscoverableItem[],
  selectedFormat: ExploreFormat,
  selectedGenre: string,
) {
  return entries.filter((entry) => {
    const matchesGenre =
      selectedGenre === ALL_GENRES_FILTER ||
      itemHasGenre(entry.item, selectedGenre);

    return matchesFormat(entry, selectedFormat) && matchesGenre;
  });
}

export function getAvailableGenreOptions(
  entries: DiscoverableItem[],
  selectedFormat: ExploreFormat,
) {
  const byId = new Map<string, ApiGenre>();

  for (const entry of entries) {
    if (!matchesFormat(entry, selectedFormat)) {
      continue;
    }

    for (const genre of getCanonicalGenres(entry.item)) {
      if (!byId.has(genre.id)) {
        byId.set(genre.id, genre);
      }
    }
  }

  return Array.from(byId.values()).sort(
    (first, second) =>
      first.displayName.localeCompare(second.displayName) ||
      first.id.localeCompare(second.id),
  );
}

export function sortDiscoverableItems(
  entries: DiscoverableItem[],
  sortMode: ExploreSortMode,
) {
  if (sortMode === "default") {
    return entries.slice();
  }

  return entries.slice().sort((first, second) => {
    const firstTimestamp = getReleaseTimestamp(first.item);
    const secondTimestamp = getReleaseTimestamp(second.item);

    if (firstTimestamp !== secondTimestamp) {
      if (firstTimestamp === null) return 1;
      if (secondTimestamp === null) return -1;
      return secondTimestamp - firstTimestamp;
    }

    return (
      getStableDiscoveryKey(first).localeCompare(
        getStableDiscoveryKey(second),
      ) || first.originalIndex - second.originalIndex
    );
  });
}
