import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Screen } from "../components/Screen";
import { Body, Button, Label, LoadingState, RecoveryState, Title } from "../components/ui";
import { SeriesEpisodeTray } from "./SeriesEpisodeTray";
import { getRequestRecoveryCopy, getSeries, type RecoveryCopy } from "../lib/api";
import { resolveMediaUrl } from "../lib/media";
import { getConfirmedSeriesAccess, subscribeConfirmedSeriesAccess } from "../lib/confirmedSeriesAccess";
import { loadWatchHistory } from "../lib/playbackHistory";
import { perfMark } from "../lib/perf";
import { useAuth } from "../lib/authContext";
import { findResumeEpisode, findStartEpisode } from "../lib/seriesPlayback";
import type { RootStackParamList } from "../navigation/types";
import type { ApiEpisode, SeriesResponse, WatchProgressItem } from "../types/api";
import { colors } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "Series">;

function hasValidPoster(poster?: string) {
  return typeof poster === "string" && poster.trim().length > 0;
}

function formatClassification(contentRating: string, contentDescriptors: string[]) {
  return contentDescriptors.length ? `${contentRating} • ${contentDescriptors.join(", ")}` : contentRating;
}

function formatEpisodeCount(count: number) {
  return `${count} ${count === 1 ? "Episode" : "Episodes"}`;
}

export function SeriesScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const normalizedSlug = typeof route.params.slug === "string" ? route.params.slug.trim() : "";
  const hasValidSlug = normalizedSlug.length > 0;
  const confirmedInitialSeriesAccess = hasValidSlug ? getConfirmedSeriesAccess(normalizedSlug) : null;
  const [data, setData] = useState<SeriesResponse | null>(confirmedInitialSeriesAccess);
  const [progress, setProgress] = useState<WatchProgressItem[]>([]);
  const [error, setError] = useState<RecoveryCopy | null>(null);
  const [isLoading, setIsLoading] = useState(() => !confirmedInitialSeriesAccess);
  const [isEpisodeTrayOpen, setIsEpisodeTrayOpen] = useState(false);
  const hasHydratedRef = useRef(Boolean(confirmedInitialSeriesAccess));

  /* eslint-disable react-hooks/set-state-in-effect -- invalid route params hydrate the existing recovery state. */
  useEffect(() => {
    if (!hasValidSlug) {
      setError({
        body: "This series link is unavailable.",
        title: "Unavailable",
      });
      setIsLoading(false);
      setData(null);
      return undefined;
    }

    let isMounted = true;

    getSeries(normalizedSlug, accessToken)
      .then((seriesData) => {
        if (isMounted) {
          setData(seriesData);
          setError(null);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setError(
            getRequestRecoveryCopy(error, {
              body: "Please try again.",
              title: "We couldn't load this right now.",
            }),
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          hasHydratedRef.current = true;
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hasValidSlug, normalizedSlug, accessToken]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hasValidSlug) {
      return undefined;
    }

    return subscribeConfirmedSeriesAccess((seriesResponse) => {
      if (seriesResponse.series.slug !== normalizedSlug) {
        return;
      }

      setData(seriesResponse);
      setError(null);
      setIsLoading(false);
      hasHydratedRef.current = true;
    });
  }, [hasValidSlug, normalizedSlug]);

  useFocusEffect(
    useCallback(() => {
      if (!hasHydratedRef.current) {
        return undefined;
      }

      let isActive = true;

      void Promise.allSettled([
        getSeries(normalizedSlug, accessToken),
        loadWatchHistory(session),
      ]).then(([seriesResult, progressResult]) => {
        if (!isActive) {
          return;
        }

        if (seriesResult.status === "fulfilled") {
          setData(seriesResult.value);
          setError(null);
        } else if (__DEV__) {
          console.error(
            "[0nya SERIES access refresh]",
            seriesResult.reason instanceof Error ? seriesResult.reason.message : String(seriesResult.reason),
            seriesResult.reason instanceof Error ? seriesResult.reason.stack : undefined,
          );
        }

        if (progressResult.status === "fulfilled") {
          setProgress(progressResult.value.filter((item) => item.contentType === "series_episode"));
        } else if (__DEV__) {
          console.error(
            "[0nya SERIES history refresh]",
            progressResult.reason instanceof Error ? progressResult.reason.message : String(progressResult.reason),
            progressResult.reason instanceof Error ? progressResult.reason.stack : undefined,
          );
        }
      });

      return () => {
        isActive = false;
      };
    }, [accessToken, normalizedSlug, session]),
  );

  useEffect(() => {
    let isMounted = true;

    void loadWatchHistory(session)
      .then((progressData) => {
        if (isMounted) {
          setProgress(
            progressData.filter((item) => item.contentType === "series_episode"),
          );
        }
      })
      .catch(() => {
        if (isMounted) {
          setProgress([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  const resumeEpisode = useMemo(() => {
    if (!data) {
      return undefined;
    }

    const candidate = findResumeEpisode(
      progress,
      data.series.slug,
      data.series.episodes,
      data.episodeAccess,
    );

    if (__DEV__) {
      console.info("[0nya SERIES resume audit]", {
        progressCount: progress.length,
        resumeEpisodeNumber: candidate?.number ?? null,
        seriesSlug: data.series.slug,
      });
    }

    return candidate;
  }, [data, progress]);

  const startEpisode = useMemo(
    () => (data ? findStartEpisode(data.series.episodes) : undefined),
    [data],
  );

  const ctaEpisode = resumeEpisode ?? startEpisode;
  const ctaAccess = ctaEpisode && data ? data.episodeAccess[String(ctaEpisode.number)] : undefined;
  const ctaEnabled = Boolean(ctaEpisode && ctaAccess);
  const ctaLabel = resumeEpisode
    ? `Resume Episode ${resumeEpisode.number}`
    : ctaAccess?.canWatch
      ? "Start Watching"
      : "Unlock options";

  const handleSelectEpisode = useCallback(
    (episode: ApiEpisode) => {
      if (!data) {
        return;
      }

      const access = data.episodeAccess[String(episode.number)];
      if (!access) {
        return;
      }

      perfMark("CONTENT_TAP", {
        content_type: "series_episode",
        episode_number: episode.number,
        series_slug: data.series.slug,
        source: "SERIES_EPISODE_TRAY",
      });

      setIsEpisodeTrayOpen(false);

      if (access.canWatch) {
        navigation.navigate("Watch", {
          access,
          episode,
          episodeAccess: data.episodeAccess,
          series: data.series,
        });
        return;
      }

      navigation.navigate("EpisodeAccessOptions", {
        access,
        episode,
        episodeAccess: data.episodeAccess,
        seriesSlug: data.series.slug,
        seriesTitle: data.series.title,
      });
    },
    [data, navigation],
  );

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!hasValidSlug) {
    return (
      <Screen scroll={false}>
        <RecoveryState
          body="This series link is unavailable."
          onPrimaryAction={() => navigation.goBack()}
          primaryActionLabel="Back"
          variant="cinematic"
          title="Unavailable"
        />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen scroll={false}>
        <RecoveryState
          body={error?.body ?? "Please try again."}
          onPrimaryAction={() => {
            setIsLoading(true);
            setData(null);
            setError(null);
            void getSeries(normalizedSlug, accessToken)
              .then((seriesData) => {
                setData(seriesData);
              })
              .catch((error) => {
                setError(
                  getRequestRecoveryCopy(error, {
                    body: "Please try again.",
                    title: "We couldn't load this right now.",
                  }),
                );
              })
              .finally(() => {
                setIsLoading(false);
              });
          }}
          primaryActionLabel="Retry"
          variant="cinematic"
          title={error?.title ?? "We couldn't load this right now."}
        />
      </Screen>
    );
  }

  const metaLine = data.series.genre ? `Micro Drama • ${data.series.genre}` : "Micro Drama";
  const episodeCountLabel = formatEpisodeCount(
    data.series.episodeCount > 0 ? data.series.episodeCount : data.series.episodes.length,
  );

  return (
    <>
      <Screen>
        <View style={styles.heroLayout}>
          <View style={styles.posterWrap}>
            {hasValidPoster(data.series.poster) ? (
              <Image
                accessibilityLabel={`${data.series.title} artwork`}
                accessible
                alt=""
                source={{ uri: resolveMediaUrl(data.series.poster)! }}
                style={styles.posterImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.posterFallback}>
                <Title numberOfLines={1}>{data.series.title}</Title>
              </View>
            )}
          </View>

          <View style={styles.detailsBlock}>
            <Title numberOfLines={2} style={styles.titleText}>{data.series.title}</Title>
            <Label style={styles.metaLabel}>{metaLine}</Label>
            {data.series.contentRating ? (
              <Body style={styles.classificationText}>
                {formatClassification(data.series.contentRating, data.series.contentDescriptors)}
              </Body>
            ) : null}
            <Body style={styles.episodeCountText}>{episodeCountLabel}</Body>
          </View>
        </View>

        <View style={styles.actionBlock}>
          <Button
            accessibilityLabel={ctaEnabled ? ctaLabel : `${data.series.title} is locked`}
            disabled={!ctaEnabled}
            onPress={() => {
              if (!ctaEnabled || !ctaEpisode || !ctaAccess) {
                return;
              }

              perfMark("CONTENT_TAP", {
                content_type: "series_episode",
                episode_number: ctaEpisode.number,
                series_slug: data.series.slug,
                source: "SERIES_DETAIL",
              });

              if (ctaAccess.canWatch) {
                navigation.navigate("Watch", {
                  access: ctaAccess,
                  episode: ctaEpisode,
                  episodeAccess: data.episodeAccess,
                  series: data.series,
                });
                return;
              }

              navigation.navigate("EpisodeAccessOptions", {
                access: ctaAccess,
                episode: ctaEpisode,
                episodeAccess: data.episodeAccess,
                seriesSlug: data.series.slug,
                seriesTitle: data.series.title,
              });
            }}
          >
            {ctaEnabled ? ctaLabel : "Locked"}
          </Button>

          <Pressable
            accessibilityLabel="Browse episodes"
            accessibilityRole="button"
            onPress={() => setIsEpisodeTrayOpen(true)}
            style={styles.episodesAction}
          >
            <Body style={styles.episodesActionText}>Episodes</Body>
            <Body style={styles.episodesActionChevron}>›</Body>
          </Pressable>
        </View>

        <View style={styles.synopsisBlock}>
          <Body numberOfLines={5} style={styles.synopsisText}>
            {data.series.synopsis}
          </Body>
        </View>
      </Screen>

      {isEpisodeTrayOpen ? (
        <SeriesEpisodeTray
          currentEpisodeNumber={ctaEpisode?.number}
          episodeAccess={data.episodeAccess}
          episodes={data.series.episodes}
          onClose={() => setIsEpisodeTrayOpen(false)}
          onSelectEpisode={handleSelectEpisode}
          seriesTitle={data.series.title}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  heroLayout: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 8,
  },
  detailsBlock: {
    flex: 1,
    gap: 6,
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  titleText: {
    fontSize: 22,
    lineHeight: 28,
  },
  metaLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  classificationText: {
    fontSize: 13,
  },
  episodeCountText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "600",
  },
  posterWrap: {
    aspectRatio: 9 / 16,
    backgroundColor: colors.surface,
    borderColor: "rgba(232, 228, 218, 0.08)",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    width: "36%",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 8,
  },
  actionBlock: {
    gap: 16,
    marginVertical: 8,
  },
  episodesAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    paddingVertical: 8,
  },
  episodesActionText: {
    color: colors.accent,
    fontWeight: "700",
  },
  episodesActionChevron: {
    color: colors.accent,
    fontSize: 20,
    marginTop: -2,
  },
  synopsisBlock: {
    marginTop: 8,
  },
  synopsisText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
});
