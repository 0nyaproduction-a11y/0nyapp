export const CONTENT_FORMAT_IDS = ["MICRO_DRAMA", "SHORT_FILM"] as const;
export type ContentFormatId = (typeof CONTENT_FORMAT_IDS)[number];

export type CanonicalGenre = {
  id: string;
  displayName: string;
};

export type GenreAssignment = {
  primaryGenre: CanonicalGenre | null;
  secondaryGenres: CanonicalGenre[];
};

export const CANONICAL_GENRES = [
  { id: "romance", displayName: "Romance" },
  { id: "drama", displayName: "Drama" },
  { id: "comedy", displayName: "Comedy" },
  { id: "thriller", displayName: "Thriller" },
  { id: "mystery", displayName: "Mystery" },
  { id: "family", displayName: "Family" },
] as const satisfies readonly CanonicalGenre[];

const genreById: Map<string, CanonicalGenre> = new Map(
  CANONICAL_GENRES.map((genre) => [genre.id, genre]),
);

const GENRE_ALIASES: Record<string, readonly string[]> = {
  "dark comedy": ["comedy"],
  "digital thriller": ["thriller"],
  "domestic thriller": ["thriller", "drama"],
  "family secret": ["family", "mystery"],
  "inheritance drama": ["drama", "family"],
  "mumbai noir": ["thriller", "mystery"],
  "office romance": ["romance", "comedy"],
  "romantic drama": ["romance", "drama"],
  "second chance": ["romance", "drama"],
};

function normalizeGenreToken(value: string) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function normalizeAliasKey(value: string) {
  return value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

function appendKnownGenre(ids: string[], id: string) {
  const normalized = normalizeGenreToken(id);
  if (genreById.has(normalized) && !ids.includes(normalized)) {
    ids.push(normalized);
  }
}

export function normalizeGenreAssignments(value: string | null | undefined): GenreAssignment {
  if (!value) {
    return { primaryGenre: null, secondaryGenres: [] };
  }

  const ids: string[] = [];

  for (const rawPart of value.split(",")) {
    const part = rawPart.trim();
    if (!part) {
      continue;
    }

    const directId = normalizeGenreToken(part);
    if (genreById.has(directId)) {
      appendKnownGenre(ids, directId);
      continue;
    }

    const aliasIds = GENRE_ALIASES[normalizeAliasKey(part)];
    if (aliasIds) {
      aliasIds.forEach((id) => appendKnownGenre(ids, id));
    }
  }

  const [primaryId, ...secondaryIds] = ids;

  return {
    primaryGenre: primaryId ? genreById.get(primaryId) ?? null : null,
    secondaryGenres: secondaryIds.reduce<CanonicalGenre[]>((genres, id) => {
      if (id === primaryId) {
        return genres;
      }

      const genre = genreById.get(id);
      if (genre) {
        genres.push(genre);
      }

      return genres;
    }, []),
  };
}

export function serializeGenreLabel(assignment: GenreAssignment) {
  const labels = [
    assignment.primaryGenre?.displayName,
    ...assignment.secondaryGenres.map((genre) => genre.displayName),
  ].filter((label): label is string => Boolean(label));

  return labels.length > 0 ? labels.join(", ") : null;
}

export function isKnownGenreInput(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return true;
  }

  return Boolean(normalizeGenreAssignments(value).primaryGenre);
}

export function normalizeSeriesContentFormat(): ContentFormatId {
  return "MICRO_DRAMA";
}

export function normalizeShortFilmContentFormat(): ContentFormatId {
  return "SHORT_FILM";
}
