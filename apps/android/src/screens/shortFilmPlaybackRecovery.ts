import type { PlaybackAuthorizationResponse } from "../types/api";

export type ShortFilmPlaybackRecoveryConfig = {
  title: string;
  body: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
};

// Maps a non-ok short-film playback authorization status to a restrained,
// recoverable UI config. Returns null for statuses that are not handled here
// (the caller decides what to render for those).
//
// Short Films are always playable by product rule, so access_required should
// not occur under the current backend contract — but if it does, we fail
// safely (Retry + Back) instead of spinning forever.
export function getShortFilmPlaybackRecoveryConfig(
  status: PlaybackAuthorizationResponse["status"],
): ShortFilmPlaybackRecoveryConfig | null {
  if (status === "parental_required") {
    return {
      title: "Parental controls required",
      body: "This short film is locked by parental controls. Unlock it to continue.",
      primaryActionLabel: "Unlock",
      secondaryActionLabel: "Back",
    };
  }

  if (status === "access_required") {
    return {
      title: "Playback unavailable",
      body: "This short film can't be played right now.",
      primaryActionLabel: "Retry",
      secondaryActionLabel: "Back",
    };
  }

  return null;
}
