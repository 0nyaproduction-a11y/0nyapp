import type { LinkingOptions } from "@react-navigation/native";
import { getAndroidLinkingPrefixes } from "../lib/content-links";
import type { RootStackParamList } from "./types";

export function getAndroidLinkingConfig(): LinkingOptions<RootStackParamList> | undefined {
  const prefixes = getAndroidLinkingPrefixes();

  if (!prefixes.length) {
    return undefined;
  }

  return {
    prefixes,
    config: {
      screens: {
        Series: "series/:slug",
        ShortFilm: "short-films/:slug",
        Watch: {
          parse: {
            episodeNumber: Number,
          },
          path: "watch/:seriesSlug/:episodeNumber",
        },
      },
    },
  };
}
