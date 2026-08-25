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

// Reused exactly from the existing schema CHECK constraints
// (episodes_status_check, episodes rewarded_access_mode check).
export const EPISODE_STATUSES = ["draft", "published", "archived"] as const satisfies readonly EpisodeStatus[];
export const REWARDED_ACCESS_MODES = ["permanent", "session"] as const satisfies readonly RewardedAccessMode[];
