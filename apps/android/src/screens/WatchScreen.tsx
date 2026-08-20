import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Screen } from "../components/Screen";
import { Body, Card, Label, Title } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { PlayerScreen } from "../player/PlayerScreen";
import type { PlaybackContext } from "../player/types";
import type { ApiEpisode, EpisodeAccess } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "Watch">;

export function WatchScreen({ route }: Props) {
  const { episodeAccess, series } = route.params;
  const [episode, setEpisode] = useState(route.params.episode);
  const access = episodeAccess[String(episode.number)] ?? route.params.access;

  const context = useMemo(
    () => buildSeriesEpisodeContext(series.slug, series.title, episode, access, series.episodes, episodeAccess),
    [access, episode, episodeAccess, series.episodes, series.slug, series.title],
  );

  if (context) {
    return (
      <PlayerScreen
        context={context}
        onAdvanceToNext={(nextEpisode) => {
          const authorizedEpisode = series.episodes.find(
            (candidate) => candidate.number === nextEpisode.episodeNumber,
          );

          if (authorizedEpisode) {
            setEpisode(authorizedEpisode);
          }
        }}
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
