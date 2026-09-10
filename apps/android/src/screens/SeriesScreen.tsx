import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import {
  CheckmarkVectorIcon,
  CompactPillButton,
  DetailInfoButton,
  LoadingState,
  PlayTriangleIcon,
  PlusVectorIcon,
  RecoveryState,
  TealCircleBadge,
  Title,
  VectorChevron,
} from "../components/ui";
import { SeriesEpisodeTray } from "./SeriesEpisodeTray";
import { getCatalog, getRequestRecoveryCopy, getSeries, type RecoveryCopy } from "../lib/api";
import { resolveMediaUrl } from "../lib/media";
import { getConfirmedSeriesAccess, subscribeConfirmedSeriesAccess } from "../lib/confirmedSeriesAccess";
import { loadWatchHistory } from "../lib/playbackHistory";
import { perfMark } from "../lib/perf";
import { useAuth } from "../lib/authContext";
import { useAppLanguage } from "../lib/appLanguage";
import { getEpisodeAccessDisplay } from "../lib/episodeAccessDisplay";
import { findResumeEpisode, findStartEpisode } from "../lib/seriesPlayback";
import { usePlusMembership } from "../player/usePlusMembership";
import type { RootStackParamList } from "../navigation/types";
import type { ApiEpisode, ApiSeries, SeriesResponse, WatchProgressItem } from "../types/api";
import { borders, colors, radii, spacing, surfaces, typography } from "../theme/tokens";

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

function getDisplayValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function SeriesScreen(props: Props) {
  const { session } = useAuth();
  return <SeriesScreenContent key={`${session?.user.id ?? "guest"}:${props.route.params.slug}`} {...props} />;
}

function SeriesScreenContent({ navigation, route }: Props) {
  const { session } = useAuth();
  const { t } = useAppLanguage();
  const accessToken = session?.access_token;
  const isPlus = usePlusMembership(accessToken);
  const [accessRevision, setAccessRevision] = useState(0);
  const normalizedSlug = typeof route.params.slug === "string" ? route.params.slug.trim() : "";
  const hasValidSlug = normalizedSlug.length > 0;
  const confirmedInitialSeriesAccess = hasValidSlug ? getConfirmedSeriesAccess(normalizedSlug) : null;
  const [data, setData] = useState<SeriesResponse | null>(confirmedInitialSeriesAccess);
  const [progress, setProgress] = useState<WatchProgressItem[]>([]);
  const [relatedSeries, setRelatedSeries] = useState<ApiSeries[]>([]);
  const [error, setError] = useState<RecoveryCopy | null>(null);
  const [isLoading, setIsLoading] = useState(() => !confirmedInitialSeriesAccess);
  const [isEpisodeTrayOpen, setIsEpisodeTrayOpen] = useState(false);
  const [isMyList, setIsMyList] = useState(false);
  const hasHydratedRef = useRef(Boolean(confirmedInitialSeriesAccess));

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => null,
      title: "",
    });
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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
  }, [hasValidSlug, normalizedSlug, accessToken, accessRevision]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hasValidSlug) {
      return undefined;
    }

    return subscribeConfirmedSeriesAccess((seriesResponse) => {
      if (!seriesResponse) {
        setAccessRevision((value) => value + 1);
        setData(null);
        setIsLoading(true);
        return;
      }
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

  // Load related series for "More like this"
  useEffect(() => {
    let isMounted = true;

    if (!hasValidSlug) {
      setRelatedSeries([]);
      return undefined;
    }

    void getCatalog(accessToken)
      .then((catalog) => {
        if (!isMounted) {
          return;
        }

        setRelatedSeries(
          catalog.catalog.filter((item) => item.slug !== normalizedSlug).slice(0, 6),
        );
      })
      .catch(() => {
        if (isMounted) {
          setRelatedSeries([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, hasValidSlug, normalizedSlug]);

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
  const ctaAccessDisplay =
    ctaEpisode ? getEpisodeAccessDisplay(ctaEpisode, ctaAccess, { isGuest: !session }) : null;
  const ctaEnabled = Boolean(
    ctaEpisode && ctaAccessDisplay && ctaAccessDisplay.stateKind !== "unavailable",
  );
  const ctaLabel = resumeEpisode
    ? `Resume Episode ${resumeEpisode.number}`
    : ctaAccessDisplay?.stateKind === "coin_required"
      ? `Unlock Episode ${ctaEpisode?.number ?? 1}`
      : ctaAccessDisplay?.stateKind === "preview"
        ? `Preview Episode ${ctaEpisode?.number ?? 1}`
        : "Start Watching";

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

      navigation.navigate("Watch", {
        seriesSlug: data.series.slug,
        episodeNumber: episode.number,
        searchContext: route.params.searchContext,
      });
    },
    [data, navigation, route.params.searchContext],
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

  const formatLabel = getDisplayValue(data.series.format);
  const genreLabel = getDisplayValue(data.series.genre);
  const languageLabel = getDisplayValue(data.series.language);
  const episodeCountLabel = formatEpisodeCount(
    data.series.episodeCount > 0 ? data.series.episodeCount : data.series.episodes.length,
  );

  return (
    <>
      <Screen>
        {/* BACK ACTION */}
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        {/* HERO SECTION (Compact 9:16 poster + details) */}
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
            <Text style={styles.categoryEyebrow}>
              {formatLabel ? formatLabel.toUpperCase() : "MICRO DRAMA"}
            </Text>
            <Title numberOfLines={2} style={styles.titleText}>{data.series.title}</Title>
            <Text style={styles.metaLine}>
              {`${languageLabel ?? "Hindi"} · ${episodeCountLabel}`}
            </Text>
            {genreLabel ? (
              <View style={styles.genreRow}>
                <Text style={styles.genrePrefix}>GENRE</Text>
                <Text numberOfLines={1} style={styles.genreValue}>{genreLabel}</Text>
              </View>
            ) : null}
            {data.series.contentRating ? (
              <Text style={styles.classificationText}>
                {formatClassification(data.series.contentRating, data.series.contentDescriptors)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* SHORT SYNOPSIS */}
        {/* SHORT SYNOPSIS (integrated into one editorial flow) */}
        {data.series.synopsis ? (
          <View style={styles.synopsisBlock}>
            <Text numberOfLines={4} style={styles.synopsisText}>
              {data.series.synopsis}
            </Text>
          </View>
        ) : null}

        {/* PRIMARY CTA & MY LIST */}
        <View style={styles.actionBlock}>
          <CompactPillButton
            accessibilityLabel={ctaEnabled ? ctaLabel : `${data.series.title} is locked`}
            disabled={!ctaEnabled}
            icon={
              ctaEnabled ? (
                <TealCircleBadge size={20}>
                  <PlayTriangleIcon color="#FEFDFD" size={8} />
                </TealCircleBadge>
              ) : undefined
            }
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

              navigation.navigate("Watch", {
                seriesSlug: data.series.slug,
                episodeNumber: ctaEpisode.number,
                searchContext: route.params.searchContext,
              });
            }}
            style={styles.primaryActionPill}
            variant="primary"
          >
            <View style={styles.primaryCtaContent}>
              <Text style={[styles.playIcon, !ctaEnabled && styles.ctaTextDisabled]}>▶</Text>
              <Text numberOfLines={1} style={[styles.primaryCtaText, !ctaEnabled && styles.ctaTextDisabled]}>
                {ctaEnabled ? ctaLabel : "Locked"}
              </Text>
            </View>
          </CompactPillButton>

          <CompactPillButton
            accessibilityLabel={isMyList ? "In My List" : "Add to My List"}
            icon={
              isMyList ? (
                <CheckmarkVectorIcon color={colors.accent} size={12} />
              ) : (
                <PlusVectorIcon color="rgba(254, 253, 253, 0.70)" size={11} />
              )
            }
            onPress={() => setIsMyList((prev) => !prev)}
            style={styles.secondaryActionPill}
            variant="secondary"
          >
            <Text style={[styles.myListButtonText, isMyList && styles.myListButtonTextActive]}>
              {isMyList ? "✓ My List" : "+ My List"}
            </Text>
          </CompactPillButton>
        </View>

        {/* EPISODES NAVIGATION ROW */}
        <Pressable
          accessibilityLabel={`Browse all ${episodeCountLabel}`}
          accessibilityRole="button"
          onPress={() => {
            perfMark("CONTENT_TAP", {
              content_type: "series_episode",
              source: "SERIES_EPISODES_CTA",
              series_slug: data.series.slug,
            });

            setIsEpisodeTrayOpen(true);
          }}
          style={({ pressed }) => [
            styles.episodesRow,
            pressed && styles.episodesRowPressed,
          ]}
        >
          <View style={styles.episodesRowLeft}>
            <Text style={styles.episodesRowTitle}>Episodes</Text>
            <View style={styles.episodesCountBadge}>
              <Text style={styles.episodesCountText}>
                {data.series.episodeCount > 0 ? data.series.episodeCount : data.series.episodes.length}
              </Text>
            </View>
          </View>
          <View style={styles.episodesRowRight}>
            <Text style={styles.episodesRowBrowseText}>Browse</Text>
            <Text style={styles.episodesRowChevron}>›</Text>
            <VectorChevron color={colors.accent} size={6} />
          </View>
        </Pressable>

        {/* MORE LIKE THIS RECOMMENDATIONS */}
        {relatedSeries.length > 0 ? (
          <View style={styles.relatedSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>{t("series.more_like_this", "More Like This")}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.relatedRow}>
                {relatedSeries.map((item) => {
                  const posterUri = hasValidPoster(item.poster)
                    ? resolveMediaUrl(item.poster)
                    : null;

                  return (
                    <View key={item.slug} style={styles.relatedCard}>
                      <Pressable
                        accessibilityLabel={`Open details for ${item.title}`}
                        accessibilityRole="button"
                        onPress={() => navigation.push("Series", { slug: item.slug })}
                        style={({ pressed }) => [
                          styles.relatedCardInner,
                          pressed && styles.relatedCardPressed,
                        ]}
                      >
                        <View style={styles.relatedPosterWrap}>
                          {posterUri ? (
                            <Image
                              accessibilityLabel={`${item.title} poster`}
                              accessible
                              alt=""
                              source={{ uri: posterUri }}
                              style={styles.relatedPoster}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.relatedPosterFallback}>
                              <Text style={styles.relatedPosterTitle} numberOfLines={2}>
                                {item.title}
                              </Text>
                            </View>
                          )}
                          <DetailInfoButton
                            accessibilityLabel={`More information about ${item.title}`}
                            onPress={() => navigation.push("Series", { slug: item.slug })}
                          />
                        </View>
                        <Text style={styles.relatedTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ) : null}
      </Screen>

      {isEpisodeTrayOpen ? (
        <SeriesEpisodeTray
          currentEpisodeNumber={ctaEpisode?.number}
          episodeAccess={data.episodeAccess}
          episodes={data.series.episodes}
          isGuest={!session}
          isPlus={isPlus}
          onClose={() => setIsEpisodeTrayOpen(false)}
          onSelectEpisode={handleSelectEpisode}
          seriesTitle={data.series.title}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 40,
    minWidth: 40,
    marginBottom: 4,
  },
  backArrow: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  heroLayout: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 8,
  },
  detailsBlock: {
    flex: 1,
    gap: 4,
    justifyContent: "flex-end",
    paddingBottom: 2,
  },
  categoryEyebrow: {
    ...typography.micro,
    color: colors.accent,
    letterSpacing: 1.0,
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 2,
  },
  titleText: {
    ...typography.h2,
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
  },
  metaLine: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  genreRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 1,
  },
  genrePrefix: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  genreValue: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  classificationText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  posterWrap: {
    aspectRatio: 9 / 16,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: borders.width,
    borderRadius: radii.poster,
    overflow: "hidden",
    width: "35%",
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
  synopsisBlock: {
    marginTop: spacing.sm,
  },
  synopsisText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  actionBlock: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.md,
  },
  primaryCtaButton: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: "rgba(43, 126, 125, 0.40)",
    borderRadius: radii.sm,
    borderWidth: borders.width,
  },
  primaryActionPill: {
    flex: 1,
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    minHeight: 46,
  },
  primaryCtaContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  playIcon: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 14,
  },
  primaryCtaText: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  ctaButtonDisabled: {
    backgroundColor: colors.surfacePressed,
    borderColor: colors.borderSubtle,
    opacity: 0.6,
  },
  ctaTextDisabled: {
    color: colors.textDisabled,
  },
  myListButton: {
    alignItems: "center",
    backgroundColor: surfaces.s2,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    borderWidth: borders.width,
    height: 48,
    justifyContent: "center",
  },
  secondaryActionPill: {
    minHeight: 46,
    paddingHorizontal: 16,
  },
  myListButtonActive: {
    backgroundColor: "rgba(43, 126, 125, 0.14)",
    borderColor: "rgba(43, 126, 125, 0.35)",
  },
  myListButtonText: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  myListButtonTextActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  btnPressed: {
    opacity: 0.82,
  },
  episodesRow: {
    alignItems: "center",
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    borderWidth: borders.width,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  episodesRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  episodesRowLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  episodesRowTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  episodesCountBadge: {
    backgroundColor: "rgba(254, 253, 253, 0.08)",
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  episodesCountText: {
    ...typography.micro,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  episodesRowRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  episodesRowBrowseText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 13,
    fontWeight: "500",
  },
  episodesRowChevron: {
    color: colors.accent,
    fontSize: 18,
    lineHeight: 18,
  },
  relatedSection: {
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  sectionHeaderRow: {
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    ...typography.h3,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  relatedRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  relatedCard: {
    width: 104,
  },
  relatedCardInner: {
    width: "100%",
  },
  relatedCardPressed: {
    opacity: 0.82,
  },
  relatedPosterWrap: {
    aspectRatio: 9 / 16,
    backgroundColor: surfaces.s1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.poster,
    borderWidth: borders.width,
    overflow: "hidden",
    width: 104,
    marginBottom: spacing.xs,
  },
  relatedPoster: {
    height: "100%",
    width: "100%",
  },
  relatedPosterFallback: {
    alignItems: "center",
    backgroundColor: surfaces.s1,
    flex: 1,
    justifyContent: "center",
    padding: 8,
  },
  relatedPosterTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
  },
  relatedTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
});
