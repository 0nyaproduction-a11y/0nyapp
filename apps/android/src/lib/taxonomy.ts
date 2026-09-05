import type { ApiGenre, ApiSeries, ApiShortFilm } from "../types/api";

export function getCanonicalGenres(item: ApiSeries | ApiShortFilm): ApiGenre[] {
  const byId = new Map<string, ApiGenre>();

  if (item.primaryGenre) {
    byId.set(item.primaryGenre.id, item.primaryGenre);
  }

  for (const genre of item.secondaryGenres ?? []) {
    if (!byId.has(genre.id)) {
      byId.set(genre.id, genre);
    }
  }

  if (byId.size === 0 && item.genre) {
    const rawLabels = item.genre
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    for (const label of rawLabels) {
      const id = label.toLowerCase();
      if (!byId.has(id)) {
        byId.set(id, { id, displayName: label });
      }
    }
  }

  return Array.from(byId.values());
}

export function getGenreDisplayLabels(item: ApiSeries | ApiShortFilm) {
  const canonicalLabels = getCanonicalGenres(item).map(
    (genre) => genre.displayName,
  );
  if (canonicalLabels.length > 0) {
    return canonicalLabels;
  }

  return (item.genre ?? "")
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
}

export function itemHasGenre(
  item: ApiSeries | ApiShortFilm,
  selectedGenre: string,
) {
  const normalized = selectedGenre.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (
    getCanonicalGenres(item).some(
      (genre) => genre.id.toLowerCase() === normalized,
    )
  ) {
    return true;
  }

  return getGenreDisplayLabels(item).some(
    (genre) => genre.toLowerCase() === normalized,
  );
}

export function isMicroDrama(item: ApiSeries) {
  return item.contentType === undefined || item.contentType === "MICRO_DRAMA";
}

export function isShortFilm(item: ApiShortFilm) {
  return item.contentType === undefined || item.contentType === "SHORT_FILM";
}
