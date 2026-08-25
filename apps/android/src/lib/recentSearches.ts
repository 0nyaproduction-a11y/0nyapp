import { supabaseSecureStorage } from "./secureStorage";

const RECENT_SEARCHES_KEY = "0nya.recent-searches.v1";
const MAX_RECENT_SEARCHES = 8;

export async function loadRecentSearches(): Promise<string[]> {
  const raw = await supabaseSecureStorage.getItem(RECENT_SEARCHES_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, values) => values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export async function saveRecentSearch(query: string) {
  const sanitized = query.trim();

  if (!sanitized) {
    return;
  }

  const searches = await loadRecentSearches();
  const next = [sanitized, ...searches.filter((value) => value.toLowerCase() !== sanitized.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);

  await supabaseSecureStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

export async function clearRecentSearches() {
  await supabaseSecureStorage.removeItem(RECENT_SEARCHES_KEY);
}
