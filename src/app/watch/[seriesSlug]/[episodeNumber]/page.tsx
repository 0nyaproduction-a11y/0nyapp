import { notFound } from "next/navigation";
import {
  contentItems,
  getEpisode,
  getNextEpisode,
  getSeriesBySlug,
} from "@/data/content";
import { LockedEpisode } from "@/components/player/LockedEpisode";
import { VerticalPlayer } from "@/components/player/VerticalPlayer";

type WatchPageProps = {
  params: Promise<{ seriesSlug: string; episodeNumber: string }>;
};

export function generateStaticParams() {
  return contentItems.flatMap((series) =>
    series.episodes.map((episode) => ({
      seriesSlug: series.slug,
      episodeNumber: `${episode.number}`,
    })),
  );
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { seriesSlug, episodeNumber } = await params;
  const parsedEpisodeNumber = Number(episodeNumber);
  const series = getSeriesBySlug(seriesSlug);
  const episode = Number.isInteger(parsedEpisodeNumber)
    ? getEpisode(seriesSlug, parsedEpisodeNumber)
    : undefined;

  if (!series || !episode) {
    notFound();
  }

  if (episode.isLocked) {
    return <LockedEpisode episode={episode} series={series} />;
  }

  return (
    <VerticalPlayer
      episode={episode}
      nextEpisode={getNextEpisode(series.slug, episode.number)}
      series={series}
    />
  );
}
