import { supabaseSecureStorage } from "./secureStorage";
import {
  normalizeRecentSearchList,
  normalizeRecentSearchQuery,
  prependRecentSearch,
} from "./recentSearchModel";

const RECENT_SEARCHES_KEY = "0nya.recent-searches.v1";

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

    return normalizeRecentSearchList(parsed);
  } catch {
    return [];
  }
}

export async function saveRecentSearch(query: string) {
  const sanitized = normalizeRecentSearchQuery(query);

  if (!sanitized) {
    return;
  }

  const searches = await loadRecentSearches();
  const next = prependRecentSearch(searches, sanitized);

  await supabaseSecureStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

export async function clearRecentSearches() {
  await supabaseSecureStorage.removeItem(RECENT_SEARCHES_KEY);
}
