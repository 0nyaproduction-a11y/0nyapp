import { notFound } from "next/navigation";
import {
  contentItems,
  getEpisode as getMockEpisode,
  getSeriesBySlug as getMockSeriesBySlug,
} from "@/data/content";
import { LockedEpisode } from "@/components/player/LockedEpisode";
import { VerticalPlayer } from "@/components/player/VerticalPlayer";
import { getEpisodeBySeriesSlugAndNumber } from "@/lib/catalog";
import { canUserWatchEpisode } from "@/lib/entitlements";
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
  const catalogResult = Number.isInteger(parsedEpisodeNumber)
    ? await getEpisodeBySeriesSlugAndNumber(seriesSlug, parsedEpisodeNumber)
    : null;
  const mockSeries = getMockSeriesBySlug(seriesSlug);
  const mockEpisode = Number.isInteger(parsedEpisodeNumber)
    ? getMockEpisode(seriesSlug, parsedEpisodeNumber)
    : undefined;
  const series = catalogResult?.series ?? mockSeries;
  const episode = catalogResult?.episode ?? mockEpisode;

  if (!series || !episode) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const canWatch = await canUserWatchEpisode({
    userId: user?.id ?? null,
    episode,
  });

  if (!canWatch) {
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
      nextEpisode={series.episodes.find(
        (nextEpisode) => nextEpisode.number === episode.number + 1,
      )}
      series={series}
    />
  );
}
