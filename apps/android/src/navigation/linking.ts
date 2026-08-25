import type { LinkingOptions } from "@react-navigation/native";
import { getStateFromPath as getReactNavigationStateFromPath } from "@react-navigation/native";
import { getAndroidLinkingPrefixes } from "../lib/content-links";
import type { RootStackParamList } from "./types";

function sanitizePathValue(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidSlug(value: string | undefined) {
  const slug = sanitizePathValue(value);
  return slug.length > 0 && !slug.includes("/");
}

function isValidEpisodeNumber(value: string | number | undefined) {
  const candidate = typeof value === "number" ? value : Number(value);
  return Number.isInteger(candidate) && candidate > 0;
}

export function getAndroidLinkingConfig(): LinkingOptions<RootStackParamList> | undefined {
  const prefixes = getAndroidLinkingPrefixes();

  if (!prefixes.length) {
    return undefined;
  }

  const screens = {
    Series: "series/:slug",
    ShortFilm: "short-films/:slug",
    Watch: {
      parse: {
        episodeNumber: Number,
      },
      path: "watch/:seriesSlug/:episodeNumber",
    },
  };

  return {
    prefixes,
    config: {
      screens,
    },
    getStateFromPath: (path, options) => {
      const normalizedPath = sanitizePathValue(path);
      if (!normalizedPath || normalizedPath === "/") {
        return undefined;
      }

      const state = getReactNavigationStateFromPath(path, {
        ...options,
        screens,
      });

      if (!state) {
        return undefined;
      }

      const route = state.routes[0];
      if (!route) {
        return undefined;
      }

      const params = (route.params ?? {}) as Record<string, unknown>;

      if (route.name === "Series" && !isValidSlug(params.slug as string | undefined)) {
        return undefined;
      }

      if (route.name === "ShortFilm" && !isValidSlug(params.slug as string | undefined)) {
        return undefined;
      }

      if (
        route.name === "Watch" &&
        (!isValidSlug(params.seriesSlug as string | undefined) ||
          !isValidEpisodeNumber(params.episodeNumber as string | number | undefined))
      ) {
        return undefined;
      }

      return state;
    },
  };
}
