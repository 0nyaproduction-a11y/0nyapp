import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Screen } from "../components/Screen";
import { Body, Button, Label, LoadingState, RecoveryState, Title } from "../components/ui";
import { SeriesEpisodeTray } from "./SeriesEpisodeTray";
import { getRequestRecoveryCopy, getSeries, type RecoveryCopy } from "../lib/api";
import { loadWatchHistory } from "../lib/playbackHistory";
import { useAuth } from "../lib/authContext";
import { findResumeEpisode, findStartEpisode } from "../lib/seriesPlayback";
import type { RootStackParamList } from "../navigation/types";
import type { ApiEpisode, SeriesResponse, WatchProgressItem } from "../types/api";
import { borders, colors } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "Series">;

function hasValidPoster(poster?: string) {
  return typeof poster === "string" && poster.trim().length > 0 && !poster.startsWith("/");
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
  const [data, setData] = useState<SeriesResponse | null>(null);
  const [progress, setProgress] = useState<WatchProgressItem[]>([]);
  const [error, setError] = useState<RecoveryCopy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEpisodeTrayOpen, setIsEpisodeTrayOpen] = useState(false);
  const hasHydratedRef = useRef(false);

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

  useFocusEffect(
    useCallback(() => {
      if (!hasHydratedRef.current) {
        return undefined;
      }

      let isActive = true;

      void loadWatchHistory(session)
        .then((progressData) => {
          if (isActive) {
            setProgress(progressData.filter((item) => item.contentType === "series_episode"));
          }
        })
        .catch((error) => {
          if (isActive) {
            console.error(
              "[0nya SERIES history refresh]",
              error instanceof Error ? error.message : String(error),
              error instanceof Error ? error.stack : undefined,
            );
          }
        });

      return () => {
        isActive = false;
      };
    }, [session]),
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
        <View style={styles.heroCard}>
          <View style={styles.posterWrap}>
            {hasValidPoster(data.series.poster) ? (
              <Image
                accessibilityLabel={`${data.series.title} artwork`}
                accessible
                alt=""
                source={{ uri: data.series.poster }}
                style={styles.posterImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.posterFallback}>
                <Title>{data.series.title}</Title>
              </View>
            )}
          </View>

          <View style={styles.contentBlock}>
            <Title>{data.series.title}</Title>
            <Label>{metaLine}</Label>
            {data.series.contentRating ? (
              <Body>{formatClassification(data.series.contentRating, data.series.contentDescriptors)}</Body>
            ) : null}
            <Body>{episodeCountLabel}</Body>
            <Body>{data.series.synopsis}</Body>
          </View>
        </View>

        <Button
          accessibilityLabel={ctaEnabled ? ctaLabel : `${data.series.title} is locked`}
          disabled={!ctaEnabled}
          onPress={() => {
            if (!ctaEnabled || !ctaEpisode || !ctaAccess) {
              return;
            }

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
          <Body>Episodes</Body>
          <Body>›</Body>
        </Pressable>
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
  heroCard: {
    alignItems: "center",
    gap: 16,
  },
  contentBlock: {
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
  },
  posterWrap: {
    aspectRatio: 9 / 16,
    backgroundColor: colors.surface,
    borderColor: borders.color,
    borderWidth: borders.width,
    maxWidth: 320,
    overflow: "hidden",
    width: "76%",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  episodesAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderBottomColor: colors.accent,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
});
