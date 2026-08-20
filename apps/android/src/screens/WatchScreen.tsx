import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Screen } from "../components/Screen";
import { Body, Card, Label, LoadingState, Title } from "../components/ui";
import { getWatchProgress } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { RootStackParamList } from "../navigation/types";
import { PlayerScreen } from "../player/PlayerScreen";
import type { PlaybackContext } from "../player/types";
import type { ApiEpisode, EpisodeAccess, WatchProgressItem } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "Watch">;

export function WatchScreen({ route }: Props) {
  const { session } = useAuth();
  const { episodeAccess, series } = route.params;
  const [episode, setEpisode] = useState(route.params.episode);
  const [progressByEpisode, setProgressByEpisode] = useState<Record<number, WatchProgressItem>>({});
  const [loadedProgressToken, setLoadedProgressToken] = useState<string | null>(null);
  const access = episodeAccess[String(episode.number)] ?? route.params.access;
  const accessToken = session?.access_token;
  const isProgressReady = !accessToken || loadedProgressToken === accessToken;

  useEffect(() => {
    let isMounted = true;

    if (!accessToken) {
      return () => {
        isMounted = false;
      };
    }

    getWatchProgress(accessToken)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        const nextProgressByEpisode = data.progress.reduce<Record<number, WatchProgressItem>>(
          (progressMap, progress) => {
            if (progress.seriesSlug === series.slug) {
              progressMap[progress.episodeNumber] = progress;
            }

            return progressMap;
          },
          {},
        );

        setProgressByEpisode(nextProgressByEpisode);
      })
      .catch(() => {
        if (isMounted) {
          setProgressByEpisode({});
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadedProgressToken(accessToken);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, route.params.episode.number, series.slug]);

  const context = useMemo(
    () => buildSeriesEpisodeContext(series.slug, series.title, episode, access, series.episodes, episodeAccess),
    [access, episode, episodeAccess, series.episodes, series.slug, series.title],
  );

  if (context) {
    if (!isProgressReady) {
      return (
        <Screen>
          <LoadingState />
        </Screen>
      );
    }

    return (
      <PlayerScreen
        accessToken={accessToken}
        context={context}
        isProgressResolved={isProgressReady}
        onAdvanceToNext={(nextEpisode) => {
          const authorizedEpisode = series.episodes.find(
            (candidate) => candidate.number === nextEpisode.episodeNumber,
          );

          if (authorizedEpisode) {
            setEpisode(authorizedEpisode);
          }
        }}
        savedProgress={accessToken ? progressByEpisode[episode.number] : undefined}
      />
    );
  }

  return (
    <Screen>
      <Title>{series.title}</Title>
      <Card>
        <Label>{access.label}</Label>
        <Title>{episode.title}</Title>
        <Body>
          Native playback will be added later. This screen is a guarded placeholder for
          accessible episodes only.
        </Body>
      </Card>
    </Screen>
  );
}

function buildSeriesEpisodeContext(
  seriesSlug: string,
  seriesTitle: string,
  episode: ApiEpisode,
  access: EpisodeAccess,
  episodes: ApiEpisode[],
  episodeAccess: Record<string, EpisodeAccess>,
): PlaybackContext | null {
  if (!access.canWatch || access.kind === "locked") {
    return null;
  }

  const nextEpisode = episodes.find((candidate) => candidate.number === episode.number + 1);
  const nextAccess = nextEpisode ? episodeAccess[String(nextEpisode.number)] : undefined;
  const authorizedNextEpisode =
    nextEpisode && nextAccess?.canWatch === true && nextAccess.kind !== "locked"
      ? {
          episodeNumber: nextEpisode.number,
          episodeTitle: nextEpisode.title,
          accessKind: nextAccess.kind,
          accessLabel: nextAccess.label,
        }
      : undefined;

  return {
    type: "SERIES_EPISODE",
    seriesSlug,
    seriesTitle,
    episodeNumber: episode.number,
    episodeTitle: episode.title,
    accessKind: access.kind,
    accessLabel: access.label,
    nextEpisode: authorizedNextEpisode,
    hasLockedNextEpisode: Boolean(nextEpisode) && !authorizedNextEpisode,
  };
}
