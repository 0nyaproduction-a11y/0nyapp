type PlaybackProgress = {
  completed?: boolean;
  durationSeconds: number;
  positionSeconds: number;
};

export const CONTINUE_WATCHING_MIN_SECONDS = 5;

/** Shared consumer completion rule. A server-confirmed completion remains valid. */
export function isPlaybackCompleted(progress: PlaybackProgress, durationSeconds?: number | null) {
  if (progress.completed) return true;
  const duration = typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : progress.durationSeconds;
  const position = progress.positionSeconds;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position) || position <= 0) {
    return false;
  }
  return position >= duration * 0.95 || duration - position <= 5;
}

/** Canonical Continue Watching qualification used by every consumer surface. */
export function isContinueWatchingProgress(progress: PlaybackProgress) {
  return progress.positionSeconds >= CONTINUE_WATCHING_MIN_SECONDS && !isPlaybackCompleted(progress);
}
