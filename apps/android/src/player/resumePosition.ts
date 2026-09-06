import type { WatchProgressItem } from "../types/api";
import { isPlaybackCompleted } from "../lib/playbackCompletion";

export function getResumePositionSeconds(
  progress: Pick<WatchProgressItem, "completed" | "durationSeconds" | "positionSeconds"> | null | undefined,
  durationSeconds?: number | null,
  minEntrySeconds = 0,
) {
  if (
    !progress ||
    isPlaybackCompleted(progress, durationSeconds) ||
    !Number.isFinite(progress.positionSeconds) ||
    progress.positionSeconds <= 0 ||
    progress.positionSeconds < minEntrySeconds
  ) {
    return null;
  }

  const effectiveDuration =
    typeof durationSeconds === "number" && durationSeconds > 0
      ? durationSeconds
      : progress.durationSeconds;

  return Math.max(0, Math.min(progress.positionSeconds, effectiveDuration || progress.positionSeconds));
}
