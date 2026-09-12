import { notFound } from "next/navigation";
import { LockedEpisode } from "@/components/player/LockedEpisode";
import { VerticalPlayer } from "@/components/player/VerticalPlayer";
import { getEpisodeBySeriesSlugAndNumber, getPublishedSeries } from "@/lib/catalog";
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

export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: WatchPageProps) {
  const { seriesSlug, episodeNumber } = await params;
  const normalizedSlug = decodeURIComponent(seriesSlug).toLowerCase().trim();
  const rawEpisode = typeof episodeNumber === "string" ? episodeNumber.replace(/^(?:ep|episode)-?/i, "").trim() : "";
  const parsedEpisodeNumber = Number.parseInt(rawEpisode, 10);
  const catalogResult = Number.isInteger(parsedEpisodeNumber)
    ? await getEpisodeBySeriesSlugAndNumber(normalizedSlug, parsedEpisodeNumber)
    : null;
  const series = catalogResult?.series;
  const episode = catalogResult?.episode;

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
    supabase,
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
