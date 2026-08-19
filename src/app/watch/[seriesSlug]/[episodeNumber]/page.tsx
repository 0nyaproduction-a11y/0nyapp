import { notFound } from "next/navigation";
import {
  contentItems,
  getEpisode,
  getNextEpisode,
  getSeriesBySlug,
} from "@/data/content";
import { LockedEpisode } from "@/components/player/LockedEpisode";
import { VerticalPlayer } from "@/components/player/VerticalPlayer";
import { createClient } from "@/lib/supabase/server";
import {
  getEpisodeProgress,
  getFallbackPositionSeconds,
  getResumePositionSeconds,
  runtimeToSeconds,
} from "@/lib/watch-progress";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (episode.isLocked) {
    return (
      <LockedEpisode
        episode={episode}
        isAuthenticated={Boolean(user)}
        series={series}
      />
    );
  }

  const savedProgress = user
    ? await getEpisodeProgress(supabase, series.slug, episode.number)
    : null;
  const durationSeconds = runtimeToSeconds(episode.runtime);
  const initialPositionSeconds = getResumePositionSeconds(
    savedProgress,
    getFallbackPositionSeconds(episode.progress, episode.runtime),
    durationSeconds,
  );

  return (
    <VerticalPlayer
      canPersistProgress={Boolean(user)}
      durationSeconds={durationSeconds}
      episode={episode}
      initialPositionSeconds={initialPositionSeconds}
      nextEpisode={getNextEpisode(series.slug, episode.number)}
      series={series}
    />
  );
}
