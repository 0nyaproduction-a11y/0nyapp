import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "EpisodeAccessOptions">;

/**
 * Compatibility redirect for EpisodeAccessOptions.
 * Product Owner Decision: C01 Wallet is the central Micro Drama access hub.
 * Any legacy caller landing on EpisodeAccessOptions immediately redirects to
 * Wallet with the exact microDramaAccess context, eliminating duplicated paywall logic.
 */
export function EpisodeAccessOptionsScreen({ navigation, route }: Props) {
  useEffect(() => {
    navigation.replace("Wallet", {
      microDramaAccess: {
        access: route.params.access,
        episode: route.params.episode,
        episodeAccess: route.params.episodeAccess,
        episodeNumber: route.params.episodeNumber ?? route.params.episode.number,
        resumeAtSeconds: route.params.resumeAtSeconds,
        seriesSlug: route.params.seriesSlug,
        seriesTitle: route.params.seriesTitle,
      },
    });
  }, [navigation, route.params]);

  return null;
}
