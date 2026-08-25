import type { ApiEpisode, EpisodeAccess, WatchProgressItem } from "../types/api";

const RESUME_MIN_SECONDS = 5;

export function isQualifyingProgress(item: WatchProgressItem) {
  return (
    item.contentType === "series_episode" &&
    !item.completed &&
    item.positionSeconds >= RESUME_MIN_SECONDS
  );
}

export function findResumeEpisode(
  progress: WatchProgressItem[],
  seriesSlug: string,
  episodes: ApiEpisode[],
  episodeAccess: Record<string, EpisodeAccess>,
) {
  const qualifying = progress
    .filter((item) => item.seriesSlug === seriesSlug && isQualifyingProgress(item))
    .sort(
      (first, second) =>
        new Date(second.lastWatchedAt).getTime() - new Date(first.lastWatchedAt).getTime(),
    );

  for (const candidate of qualifying) {
    const episode = episodes.find((item) => item.number === candidate.episodeNumber);
    const access = episode ? episodeAccess[String(episode.number)] : undefined;

    if (episode && access?.canWatch) {
      return episode;
    }
  }

  return undefined;
}

export function findStartEpisode(episodes: ApiEpisode[]) {
  return episodes[0];
}
