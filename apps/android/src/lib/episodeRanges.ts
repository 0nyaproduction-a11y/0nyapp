import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiEpisode } from "../types/api";

export type EpisodeRange = {
  end: number;
  start: number;
};

export const EPISODE_RANGE_SIZE = 20;

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
    if (!rangesByStart.has(start)) {
      rangesByStart.set(start, {
        end: start + rangeSize - 1,
        start,
      });
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

export function getActiveEpisodeRange(
  ranges: EpisodeRange[],
  currentEpisodeNumber?: number,
  selectedRangeStart?: number | null,
): EpisodeRange | undefined {
  if (!ranges.length) {
    return undefined;
  }

  if (typeof selectedRangeStart === "number") {
    const selectedRange = ranges.find((range) => range.start === selectedRangeStart);
    if (selectedRange) {
      return selectedRange;
    }
  }

  if (typeof currentEpisodeNumber === "number") {
    const preferredRange = ranges.find(
      (range) => currentEpisodeNumber >= range.start && currentEpisodeNumber <= range.end,
    );
    if (preferredRange) {
      return preferredRange;
    }
  }

  return ranges[0];
}

export function getInitialEpisodeRangeStart(
  episodes: ApiEpisode[],
  preferredEpisodeNumber?: number,
  rangeSize = EPISODE_RANGE_SIZE,
) {
  const ranges = buildEpisodeRanges(episodes, rangeSize);
  const activeRange = getActiveEpisodeRange(ranges, preferredEpisodeNumber);
  return activeRange ? activeRange.start : null;
}

export function getRangeStartForEpisode(
  episodeNumber: number,
  rangeSize = EPISODE_RANGE_SIZE,
) {
  return Math.floor((Math.max(1, episodeNumber) - 1) / rangeSize) * rangeSize + 1;
}

export function useEpisodeRanges({
  currentEpisodeNumber,
  episodes,
  rangeSize = EPISODE_RANGE_SIZE,
}: {
  currentEpisodeNumber?: number;
  episodes: ApiEpisode[];
  rangeSize?: number;
}) {
  const ranges = useMemo(() => buildEpisodeRanges(episodes, rangeSize), [episodes, rangeSize]);
  const [selectedRangeStart, setSelectedRangeStart] = useState<number | null>(null);
  const prevEpisodeNumberRef = useRef<number | undefined>(currentEpisodeNumber);

  useEffect(() => {
    if (typeof currentEpisodeNumber !== "number") {
      return;
    }
    const prevEpisodeNumber = prevEpisodeNumberRef.current;
    prevEpisodeNumberRef.current = currentEpisodeNumber;

    if (prevEpisodeNumber !== undefined && prevEpisodeNumber !== currentEpisodeNumber) {
      const currentActive = getActiveEpisodeRange(ranges, prevEpisodeNumber, selectedRangeStart);
      if (
        !currentActive ||
        currentEpisodeNumber < currentActive.start ||
        currentEpisodeNumber > currentActive.end
      ) {
        const nextRange = ranges.find(
          (range) => currentEpisodeNumber >= range.start && currentEpisodeNumber <= range.end,
        );
        if (nextRange) {
          setSelectedRangeStart(nextRange.start);
        }
      }
    }
  }, [currentEpisodeNumber, ranges, selectedRangeStart]);

  const activeRange = useMemo(
    () => getActiveEpisodeRange(ranges, currentEpisodeNumber, selectedRangeStart),
    [ranges, currentEpisodeNumber, selectedRangeStart],
  );

  const visibleEpisodes = useMemo(
    () => getEpisodesInRange(episodes, activeRange),
    [episodes, activeRange],
  );

  return {
    activeRange,
    activeRangeStart: activeRange?.start ?? null,
    onSelectRange: setSelectedRangeStart,
    ranges,
    selectedRangeStart,
    visibleEpisodes,
  };
}
