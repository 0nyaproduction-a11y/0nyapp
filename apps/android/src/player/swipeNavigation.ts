import type { PlaybackContext } from "./types";
import type { ApiEpisode } from "../types/api";

/**
 * Minimum vertical movement (in pixels) needed to steal the responder from
 * the Pressable tap handlers on the touchLayer.
 *
 * Keeps small accidental finger movements from being interpreted as
 * episode-change swipes, so tap / double-tap / long-press gestures are
 * not disrupted.
 */
export const SWIPE_DEADZONE_PX = 12;

/**
 * Minimum total vertical displacement (in pixels) for a released gesture
 * to be considered an intentional episode change.
 *
 * Deliberately restrained — not a feed-style flick threshold.
 */
export const SWIPE_MIN_DISTANCE_PX = 60;

/**
 * Maximum horizontal drift (in pixels) allowed while still treating a
 * gesture as a vertical swipe. Rejects scrub-like horizontal gestures
 * that would otherwise conflict with the timeline slider.
 */
export const SWIPE_MAX_HORIZONTAL_DRIFT_PX = 48;

/**
 * Minimum vertical velocity (pixels per millisecond) for a short but
 * fast flick to count as an intentional swipe.
 *
 * Allows faster, smaller gestures (e.g. a quick 30px flick) to trigger
 * the transition without requiring a full 60px displacement.
 */
export const SWIPE_MIN_VELOCITY = 0.5;

export type SwipeDirection = "up" | "down";

export type ResolvedSwipeEpisode = {
  /** The 1-based episode number to navigate to. */
  episodeNumber: number;
  /** Whether the target is the next (N+1) or previous (N-1) episode. */
  direction: "next" | "previous";
};

/**
 * Determines whether a touch gesture qualifies as a deliberate vertical
 * swipe and, if so, which direction it is.
 *
 * On screen, `dy < 0` means the finger moved upward → `"up"` (next episode).
 * `dy > 0` means the finger moved downward → `"down"` (previous episode).
 *
 * Returns `null` for:
 * - Zero movement
 * - Movement that is too small (below deadzone / min distance / velocity)
 * - Movement that is predominantly horizontal (scrub-like)
 */
export function classifyVerticalSwipe(
  dx: number,
  dy: number,
  vy: number,
): SwipeDirection | null {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const absVy = Math.abs(vy);

  // Must be predominantly vertical — reject horizontal scrub-like gestures.
  if (absDx > SWIPE_MAX_HORIZONTAL_DRIFT_PX) {
    return null;
  }

  // No vertical movement at all — not a swipe.
  if (absDy <= 0) {
    return null;
  }

  // Intentional if EITHER:
  //   (a) slow but deliberate — enough total vertical distance, OR
  //   (b) fast but short — enough velocity AND past the deadzone.
  const committedByDistance = absDy >= SWIPE_MIN_DISTANCE_PX;
  const committedByVelocity =
    absVy >= SWIPE_MIN_VELOCITY && absDy >= SWIPE_DEADZONE_PX;

  if (!committedByDistance && !committedByVelocity) {
    return null;
  }

  // dy < 0 → finger moved up on screen → next episode
  if (dy < 0) {
    return "up";
  }
  // dy > 0 → finger moved down on screen → previous episode
  if (dy > 0) {
    return "down";
  }
  return null;
}

/**
 * Resolves which episode (if any) a vertical swipe should navigate to.
 *
 * - **SWIPE UP** → immediate next episode N+1.
 *   Delegates to the caller to invoke `onAdvanceToNext`, which routes
 *   through the same `activateTargetFromEpisode` access-resolution path
 *   used by Auto-Next (W01 preview / W02 paywall / playable / etc.).
 *
 * - **SWIPE DOWN** → immediate previous episode N-1.
 *   Delegates to the caller to invoke `onSelectEpisode`, which routes
 *   through the same `activateTargetFromEpisode` access-resolution path
 *   used by manual episode selection.
 *
 * Returns `null` when there is no valid target (no next/previous episode,
 * unreleased episode, wrong context type, etc.). The caller should
 * silently remain on the current episode in that case.
 *
 * Does NOT directly swap Mux URLs — navigation always goes through the
 * parent screen's episode-transition callbacks.
 */
export function resolveSwipeTarget(
  context: PlaybackContext,
  episodes: ApiEpisode[] | undefined,
  direction: SwipeDirection,
): ResolvedSwipeEpisode | null {
  if (context.type !== "SERIES_EPISODE") {
    return null;
  }

  if (direction === "up") {
    // SWIPE UP → Episode N+1
    //
    // `context.nextEpisode` is `undefined` when the next episode is
    // unreleased (not yet in the published episodes array) or when this
    // is the series finale. A *locked but published* next episode is
    // still present in `nextEpisode` — the access path below
    // (onAdvanceToNext → activateTargetFromEpisode) handles W01/W02/etc.
    if (!context.nextEpisode) {
      return null;
    }
    return {
      episodeNumber: context.nextEpisode.episodeNumber,
      direction: "next",
    };
  }

  // SWIPE DOWN → Episode N-1
  //
  // The playback context does not carry a `previousEpisode` field, so
  // the previous episode is resolved by looking it up in the published
  // `episodes` array (which only contains published rows). If the
  // previous episode is unreleased/draft, it won't be found and the
  // swipe is a no-op (remain on the current episode).
  const prevNumber = context.episodeNumber - 1;
  if (prevNumber < 1) {
    return null;
  }
  const prevEpisode = episodes?.find(
    (candidate) => candidate.number === prevNumber,
  );
  if (!prevEpisode) {
    return null;
  }
  return {
    episodeNumber: prevNumber,
    direction: "previous",
  };
}
