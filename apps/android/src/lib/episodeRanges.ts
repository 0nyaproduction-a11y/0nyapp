import type { ApiEpisode } from "../types/api";

export type EpisodeRange = {
  end: number;
  start: number;
};

export const EPISODE_RANGE_SIZE = 25;

export function buildEpisodeRanges(
  episodes: ApiEpisode[],
  rangeSize = EPISODE_RANGE_SIZE,
): EpisodeRange[] {
  const rangesByStart = new Map<number, EpisodeRange>();

  for (const episode of episodes) {
    if (!Number.isFinite(episode.number)) {
      continue;
    }

    const start = getRangeStartForEpisode(episode.number, rangeSize);
    const range = rangesByStart.get(start);

    if (range) {
      range.end = Math.max(range.end, episode.number);
    } else {
      rangesByStart.set(start, { end: episode.number, start });
    }
  }

  return Array.from(rangesByStart.values()).sort((left, right) => left.start - right.start);
}

export function getEpisodesInRange(
  episodes: ApiEpisode[],
  range: EpisodeRange | undefined,
): ApiEpisode[] {
  if (!range) {
    return episodes;
  }

  return episodes.filter((episode) => episode.number >= range.start && episode.number <= range.end);
}

export function getInitialEpisodeRangeStart(
  episodes: ApiEpisode[],
  preferredEpisodeNumber?: number,
  rangeSize = EPISODE_RANGE_SIZE,
) {
  const ranges = buildEpisodeRanges(episodes, rangeSize);

  if (!ranges.length) {
    return null;
  }

  const preferredRange =
    typeof preferredEpisodeNumber === "number"
      ? ranges.find(
          (range) => preferredEpisodeNumber >= range.start && preferredEpisodeNumber <= range.end,
        )
      : undefined;

  return (preferredRange ?? ranges[0]).start;
}

export function getRangeStartForEpisode(
  episodeNumber: number,
  rangeSize = EPISODE_RANGE_SIZE,
) {
  return Math.floor((Math.max(1, episodeNumber) - 1) / rangeSize) * rangeSize + 1;
}
