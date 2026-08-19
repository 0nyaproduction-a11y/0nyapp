import type { ContentItem, Episode } from "@/data/content";
import type { EpisodeAccessState } from "@/lib/entitlements";

export function serializeEpisode(episode: Episode) {
  return {
    number: episode.number,
    title: episode.title,
    description: episode.description,
    runtime: episode.runtime,
    isFree: episode.isFree,
    coinPrice: episode.coinPrice ?? 0,
  };
}

export function serializeSeries(series: ContentItem) {
  return {
    title: series.title,
    slug: series.slug,
    genre: series.genre,
    format: series.format,
    episodeCount: series.episodeCount,
    episodeDuration: series.episodeDuration,
    synopsis: series.synopsis,
    poster: series.poster,
    episodes: series.episodes.map(serializeEpisode),
  };
}

export function serializeEpisodeAccess(
  accessByEpisodeNumber: Map<number, EpisodeAccessState>,
) {
  return Object.fromEntries(
    Array.from(accessByEpisodeNumber.entries()).map(([episodeNumber, access]) => [
      episodeNumber,
      {
        canWatch: access.canWatch,
        kind: access.kind,
        label: access.label,
      },
    ]),
  );
}
