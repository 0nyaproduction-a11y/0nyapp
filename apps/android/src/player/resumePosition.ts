import type { WatchProgressItem } from "../types/api";

export function getResumePositionSeconds(
  progress: Pick<WatchProgressItem, "completed" | "durationSeconds" | "positionSeconds"> | null | undefined,
  durationSeconds?: number | null,
  minEntrySeconds = 0,
) {
  if (
    !progress ||
    progress.completed ||
    progress.positionSeconds <= 0 ||
    progress.positionSeconds < minEntrySeconds
  ) {
    return null;
  }

  const effectiveDuration =
    typeof durationSeconds === "number" && durationSeconds > 0
      ? durationSeconds
      : progress.durationSeconds;

  if (effectiveDuration > 0 && effectiveDuration - progress.positionSeconds <= 5) {
    return null;
  }

  return Math.max(0, Math.min(progress.positionSeconds, effectiveDuration || progress.positionSeconds));
}
