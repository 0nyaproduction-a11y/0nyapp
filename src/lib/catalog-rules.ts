import type { Database } from "@/types/database";

/**
 * Pure catalog consumer-visibility rules (CMS-C05).
 *
 * These predicates are framework-free (no `server-only`, no network) so the
 * Node test runner can exercise the exact rules the consumer catalog uses.
 * `catalog.ts` and `home.ts` delegate to these so the visibility contract has
 * a single source of truth.
 */

type ShortFilmRow = Database["public"]["Tables"]["short_films"]["Row"];
export type ShortFilmStatusRow = Pick<ShortFilmRow, "status" | "publish_at">;

type MediaAssetReadinessRow = Pick<
  Database["public"]["Tables"]["media_assets"]["Row"],
  "status" | "provider_playback_reference"
>;

const PUBLISHED = "published";

/**
 * A scheduled short film (status=published with a future publish_at) must not
 * be consumer-visible until its publish_at elapses. A null publish_at means
 * immediately released. An unparseable date is treated as not yet released.
 */
export function isReleased(publishAt: ShortFilmStatusRow["publish_at"] | null | undefined, now = Date.now()) {
  if (!publishAt) {
    return true;
  }

  const time = new Date(publishAt).getTime();
  return !Number.isNaN(time) && time <= now;
}

export function isShortFilmConsumerVisible(row: ShortFilmStatusRow, now = Date.now()) {
  return row.status === PUBLISHED && isReleased(row.publish_at, now);
}

/**
 * Mirrors the exact source the playback paths read (`resolveShortFilmPlayback`
 * / `resolveEpisodePlayback` in `lib/playback.ts`): a media asset is ready only
 * when status=ready AND a provider playback reference is present.
 */
export function isMediaAssetReady(asset: MediaAssetReadinessRow | null | undefined) {
  return Boolean(
    asset &&
      asset.status === "ready" &&
      asset.provider_playback_reference &&
      asset.provider_playback_reference.trim() !== "",
  );
}

/**
 * A series is consumer-visible only when it serves at least one episode.
 * Published series with zero served episodes (nothing watchable) must not
 * appear in the consumer catalog or on Home.
 */
export function isSeriesConsumerVisible(servedEpisodes: readonly unknown[]) {
  return servedEpisodes.length > 0;
}

/**
 * Short-film playback readiness reported to Android. The legacy
 * `short_films.playback_reference` column is never written by the production
 * media-assignment path and is NOT the readiness source — media_assets is.
 */
export function resolveShortFilmPlaybackReady(
  input: {
    status: ShortFilmStatusRow["status"];
    publishAt: ShortFilmStatusRow["publish_at"] | null | undefined;
    mediaReady: boolean;
    ageVerificationRequired: boolean;
  },
  now = Date.now(),
) {
  return (
    input.status === PUBLISHED &&
    isReleased(input.publishAt, now) &&
    input.mediaReady &&
    !input.ageVerificationRequired
  );
}