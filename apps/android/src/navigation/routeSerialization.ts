import type { NavigationState, PartialState } from "@react-navigation/native";

export function isValidEpisodeAccessRouteParams(params: Record<string, unknown>) {
  const seriesSlug = typeof params.seriesSlug === "string" ? params.seriesSlug.trim() : "";
  const episodeNumber =
    typeof params.episodeNumber === "number" ? params.episodeNumber : Number(params.episodeNumber);

  return (
    seriesSlug.length > 0 &&
    !seriesSlug.includes("/") &&
    Number.isInteger(episodeNumber) &&
    episodeNumber > 0
  );
}

export function stringifyEpisodeAccessParam(value: string | number | undefined) {
  return encodeURIComponent(String(value ?? ""));
}

/** The only durable Watch identity; rich preloads never determine the target. */
export function getWatchRouteParams(params: Record<string, unknown>) {
  const seriesSlug = typeof params.seriesSlug === "string" ? params.seriesSlug.trim() : "";
  const episodeNumber = params.episodeNumber;
  if (!seriesSlug || /[/\\\s?#]/.test(seriesSlug) || /^(undefined|null)$/i.test(seriesSlug) ||
      typeof episodeNumber !== "number" || !Number.isSafeInteger(episodeNumber) || episodeNumber <= 0) {
    return null;
  }
  const resumeAtSeconds = params.resumeAtSeconds;
  return {
    seriesSlug,
    episodeNumber,
    ...(typeof resumeAtSeconds === "number" && Number.isFinite(resumeAtSeconds) && resumeAtSeconds >= 0
      ? { resumeAtSeconds } : {}),
    ...(params.startFromBeginning === true ? { startFromBeginning: true } : {}),
  };
}

export const watchPathConfig = {
  parse: {
    episodeNumber: Number,
    resumeAtSeconds: Number,
    startFromBeginning: (value: string) => value === "true",
  },
  path: "watch/:seriesSlug/:episodeNumber",
};

/** setParams merges, so explicitly consume the outgoing episode's transient intent. */
export function getWatchEpisodeTransitionParams(seriesSlug: string, episodeNumber: number) {
  return {
    seriesSlug,
    episodeNumber,
    resumeAtSeconds: undefined,
    startFromBeginning: undefined,
    series: undefined,
    episode: undefined,
    access: undefined,
    episodeAccess: undefined,
  };
}

type UrlNavigationState = NavigationState | PartialState<NavigationState>;

export function stripNonUrlRouteParams<T extends UrlNavigationState>(state: T): T {
  const sanitizedState = {
    ...state,
    routes: state.routes.map((route) => {
      const nextRoute = {
        ...route,
        ...(route.state ? { state: stripNonUrlRouteParams(route.state) } : {}),
      };

      if (nextRoute.params && typeof nextRoute.params === "object") {
        const params = { ...(nextRoute.params as Record<string, unknown>) };
        delete params.searchContext;
        nextRoute.params = params;
      }

      if (route.name === "Watch") {
        const params = getWatchRouteParams((route.params ?? {}) as Record<string, unknown>);
        if (params) {
          nextRoute.params = params;
        } else {
          // Invalid internal state must not generate /watch/undefined/undefined.
          nextRoute.name = "MainTabs";
          delete nextRoute.params;
        }
      } else if (route.name === "EpisodeAccessOptions") {
        const params =
          route.params && typeof route.params === "object"
            ? (route.params as Record<string, unknown>)
            : undefined;
        nextRoute.params = {
          episodeNumber: params?.episodeNumber,
          seriesSlug: params?.seriesSlug,
        };
      } else if (route.name === "ShortFilmEnd") {
        const params =
          route.params && typeof route.params === "object"
            ? (route.params as Record<string, unknown>)
            : undefined;
        const shortFilm =
          params?.shortFilm && typeof params.shortFilm === "object"
            ? (params.shortFilm as Record<string, unknown>)
            : undefined;
        nextRoute.params = {
          hasSentChaiThisPlayback: params?.hasSentChaiThisPlayback === true,
          slug: typeof shortFilm?.slug === "string" ? shortFilm.slug : undefined,
        };
      } else if (route.name === "MainTabs") {
        delete nextRoute.params;
      } else if (route.name === "SeriesEpisodes") {
        const params =
          route.params && typeof route.params === "object"
            ? (route.params as Record<string, unknown>)
            : undefined;
        nextRoute.params = {
          seriesSlug: typeof params?.seriesSlug === "string" ? params.seriesSlug : undefined,
        };
      }

      return nextRoute;
    }),
  };

  return sanitizedState as T;
}
