export const MAX_RECENT_SEARCHES = 8;

export function normalizeRecentSearchQuery(value: string) {
  return value.trim();
}

export function normalizeRecentSearchList(values: unknown[]) {
  return values
    .filter((value): value is string => typeof value === "string")
    .map(normalizeRecentSearchQuery)
    .filter(Boolean)
    .filter(
      (value, index, searches) =>
        searches.findIndex(
          (candidate) => candidate.toLowerCase() === value.toLowerCase(),
        ) === index,
    )
    .slice(0, MAX_RECENT_SEARCHES);
}

export function prependRecentSearch(values: string[], query: string) {
  const normalizedQuery = normalizeRecentSearchQuery(query);
  if (!normalizedQuery) return normalizeRecentSearchList(values);

  return normalizeRecentSearchList([
    normalizedQuery,
    ...values.filter(
      (value) => value.toLowerCase() !== normalizedQuery.toLowerCase(),
    ),
  ]);
}

