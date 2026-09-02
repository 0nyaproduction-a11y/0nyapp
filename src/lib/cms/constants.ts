import type { Database } from "@/types/database";

// Shared, client-safe types/constants for CMS series/episode forms.
// Deliberately has NO "server-only" import so Client Components (e.g.
// SeriesMetadataForm) can import these without pulling admin/service-role
// code into the browser bundle. Server-only modules (lib/cms/series.ts,
// lib/cms/episodes.ts) re-export these for convenience in server-side code.

export type SeriesRow = Database["public"]["Tables"]["series"]["Row"];
export type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];

export type SeriesStatus = SeriesRow["status"];

// Reused exactly from the existing schema CHECK constraint
// (series_status_check) — do not invent new status names.
export const SERIES_STATUSES = ["draft", "published", "archived"] as const satisfies readonly SeriesStatus[];

// The consumer catalog mapper (src/lib/catalog.ts toContentFormat) only ever
// recognizes these three literals, falling back to "Series" for anything
// else. Reused here rather than inventing a new format vocabulary.
export const SERIES_FORMATS = ["Series", "Mini", "Short"] as const;
export type SeriesFormat = (typeof SERIES_FORMATS)[number];

export type EpisodeStatus = EpisodeRow["status"];
export type RewardedAccessMode = EpisodeRow["rewarded_access_mode"];

// Reused exactly from the existing schema CHECK constraint
// (episodes_status_check).
export const EPISODE_STATUSES = ["draft", "published", "archived"] as const satisfies readonly EpisodeStatus[];

// Launch operational policy is permanent-only. The database type still includes
// "session" for legacy compatibility, but CMS create/update paths must not
// author it because rewarded RPCs reject session-mode attempts.
export const REWARDED_ACCESS_MODES = ["permanent"] as const satisfies readonly RewardedAccessMode[];

// Launch-only allowed required-rewarded-completion counts. Max is 2 (no 3/4-ad
// unlocks at launch). The actual value is backend/CMS authoritative, never
// derived from coin price.
export const REWARDED_REQUIRED_COMPLETIONS_VALUES = [1, 2] as const;
export const MAX_REWARDED_REQUIRED_COMPLETIONS = 2;
export const MIN_REWARDED_REQUIRED_COMPLETIONS = 1;

export function clampRewardedRequiredCompletions(value: number): number {
  if (!Number.isInteger(value)) {
    return MIN_REWARDED_REQUIRED_COMPLETIONS;
  }

  return Math.min(
    MAX_REWARDED_REQUIRED_COMPLETIONS,
    Math.max(MIN_REWARDED_REQUIRED_COMPLETIONS, value),
  );
}

// Single source of truth for the compact Episode access summary shown on
// both the legacy Episode list and SeriesEpisodeManager. Reflects ONLY
// currently ENABLED access methods — coin_price is irrelevant (and must not
// be shown) whenever coin_unlock_enabled is false.
export function buildAccessSummary(episode: EpisodeRow) {
  const parts: string[] = [];

  if (episode.is_free) {
    parts.push("Free");
  }

  if (episode.coin_unlock_enabled) {
    parts.push(`${episode.coin_price} coins`);
  }

  if (episode.rewarded_unlock_enabled) {
    parts.push("Rewarded");
  }

  if (episode.plus_access) {
    parts.push("Plus");
  }

  return parts.length > 0 ? parts.join(" · ") : "Not configured";
}
