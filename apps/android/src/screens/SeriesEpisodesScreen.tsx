import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Screen } from "../components/Screen";
import { EpisodeAccessMarkers } from "../components/EpisodeAccessMarkers";
import { Label, LoadingState, RecoveryState, Title } from "../components/ui";
import { useAuth } from "../lib/authContext";
import { getConfirmedSeriesAccess, subscribeConfirmedSeriesAccess } from "../lib/confirmedSeriesAccess";
import { getEpisodeAccessDisplay } from "../lib/episodeAccessDisplay";
import { getSeries } from "../lib/api";
import {
  buildEpisodeRanges,
  EPISODE_RANGE_SIZE,
  getEpisodesInRange,
  getInitialEpisodeRangeStart,
} from "../lib/episodeRanges";
import { loadWatchHistory } from "../lib/playbackHistory";
import { findResumeEpisode } from "../lib/seriesPlayback";
import { usePlusMembership } from "../player/usePlusMembership";
import type { RootStackParamList } from "../navigation/types";
import type { ApiEpisode, ApiSeries, EpisodeAccess, WatchProgressItem } from "../types/api";
import { borders, colors } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "SeriesEpisodes">;

const EMPTY_EPISODES: ApiEpisode[] = [];
const GRID_GAP = 8;
const SCREEN_HORIZONTAL_PADDING = 16;
const TOUCH_TARGET_MIN = 48;
const MIN_COLUMNS = 3;
const PREFERRED_COLUMNS = 5;
const PLUS_MARKER_COLOR = "#B91825";

export function SeriesEpisodesScreen(props: Props) {
  const { session } = useAuth();
  return <SeriesEpisodesScreenContent key={`${session?.user.id ?? "guest"}:${props.route.params.seriesSlug ?? props.route.params.series?.slug}`} {...props} />;
}

function SeriesEpisodesScreenContent({ navigation, route }: Props) {
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const isPlus = usePlusMembership(accessToken);
  const [accessRevision, setAccessRevision] = useState(0);
  const routedSeries = route.params.series;
  const routedSeriesSlug = route.params.seriesSlug ?? routedSeries?.slug;
  const confirmedInitialSeriesAccess = getConfirmedSeriesAccess(routedSeriesSlug);
  const [resolvedSeries, setResolvedSeries] = useState<ApiSeries | null>(
    confirmedInitialSeriesAccess?.series ?? routedSeries ?? null,
  );
  const [resolvedEpisodeAccess, setResolvedEpisodeAccess] = useState<Record<string, EpisodeAccess>>(
    confirmedInitialSeriesAccess?.episodeAccess ?? {},
  );
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const shouldFetchSeries = true;
  const [isSeriesLoading, setIsSeriesLoading] = useState(() => shouldFetchSeries && !confirmedInitialSeriesAccess);
  const hasHydratedRef = useRef(Boolean(confirmedInitialSeriesAccess) || !shouldFetchSeries);
  const [progress, setProgress] = useState<WatchProgressItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  useEffect(() => {
    if (!routedSeriesSlug || !shouldFetchSeries) {
      return;
    }

    let isMounted = true;

    void getSeries(routedSeriesSlug, accessToken)
      .then((seriesResponse) => {
        if (!isMounted) {
          return;
        }

        setResolvedSeries(seriesResponse.series);
        setResolvedEpisodeAccess(seriesResponse.episodeAccess);
      })
      .catch(() => {
        if (isMounted) {
          setSeriesError("We couldn't load this right now.");
        }
      })
      .finally(() => {
        if (isMounted) {
          hasHydratedRef.current = true;
          setIsSeriesLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, routedSeriesSlug, shouldFetchSeries, accessRevision]);

  useEffect(() => {
    if (!routedSeriesSlug) {
      return undefined;
    }

    return subscribeConfirmedSeriesAccess((seriesResponse) => {
      if (!seriesResponse) {
        setAccessRevision((value) => value + 1);
        setResolvedEpisodeAccess({});
        setIsSeriesLoading(true);
        return;
      }
      if (seriesResponse.series.slug !== routedSeriesSlug) {
        return;
      }

      setResolvedSeries(seriesResponse.series);
      setResolvedEpisodeAccess(seriesResponse.episodeAccess);
      setSeriesError(null);
      setIsSeriesLoading(false);
      hasHydratedRef.current = true;
    });
  }, [routedSeriesSlug]);

  useFocusEffect(
    useCallback(() => {
      if (!routedSeriesSlug || !hasHydratedRef.current) {
        return undefined;
      }

      let isActive = true;

      void getSeries(routedSeriesSlug, accessToken)
        .then((seriesResponse) => {
          if (!isActive) {
            return;
          }

          setResolvedSeries(seriesResponse.series);
          setResolvedEpisodeAccess(seriesResponse.episodeAccess);
          setSeriesError(null);
        })
        .catch(() => {
          if (isActive && __DEV__) {
            console.error("[0nya SERIES episodes access refresh] Unable to refresh episode access.");
          }
        });

      return () => {
        isActive = false;
      };
    }, [accessToken, routedSeriesSlug]),
  );

  const series = resolvedSeries ?? routedSeries ?? null;
  const episodes = useMemo(() => series?.episodes ?? EMPTY_EPISODES, [series]);
  const episodeAccess = resolvedEpisodeAccess;
  const isPlusUser =
    Boolean(isPlus) ||
    Object.values(resolvedEpisodeAccess).some(
      (access) => access?.kind === "subscription" && access?.canWatch,
    );
  const ranges = useMemo(() => buildEpisodeRanges(episodes, EPISODE_RANGE_SIZE), [episodes]);
  const columns = useMemo(() => getColumnsForWidth(width), [width]);
  const cellSize = Math.max(
    TOUCH_TARGET_MIN,
    Math.floor(
      (width - SCREEN_HORIZONTAL_PADDING * 2 - (columns - 1) * GRID_GAP) / columns,
    ),
  );

  useEffect(() => {
    let isMounted = true;

    void loadWatchHistory(session)
      .then((progressData) => {
        if (isMounted) {
          setProgress(progressData.filter((item) => item.contentType === "series_episode"));
        }
      })
      .catch(() => {
        if (isMounted) {
          setProgress([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsHistoryLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  const resumeEpisode = useMemo(
    () => (series ? findResumeEpisode(progress, series.slug, series.episodes, episodeAccess) : undefined),
    [episodeAccess, progress, series],
  );

  const [selectedRangeStart, setSelectedRangeStart] = useState<number | null>(null);
  const initialRangeStart = useMemo(
    () => getInitialEpisodeRangeStart(episodes, resumeEpisode?.number),
    [episodes, resumeEpisode],
  );
  const activeRangeStart =
    ranges.some((range) => range.start === selectedRangeStart)
      ? selectedRangeStart
      : initialRangeStart;
  const selectedRange = ranges.find((range) => range.start === activeRangeStart) ?? ranges[0];

  const visibleEpisodes = useMemo(() => {
    return getEpisodesInRange(episodes, selectedRange);
  }, [episodes, selectedRange]);

  const handleEpisodePress = (episode: ApiEpisode) => {
    if (!series) {
      return;
    }

    navigation.navigate("Watch", {
      seriesSlug: series.slug,
      episodeNumber: episode.number,
      searchContext: route.params.searchContext,
    });
  };

  if (isSeriesLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!series) {
    return (
      <Screen>
        <RecoveryState
          body={seriesError ?? "Please try again."}
          onPrimaryAction={() => {
            if (!routedSeriesSlug) {
              return;
            }

            setSeriesError(null);
            setIsSeriesLoading(true);
            void getSeries(routedSeriesSlug, accessToken)
              .then((seriesResponse) => {
                setResolvedSeries(seriesResponse.series);
                setResolvedEpisodeAccess(seriesResponse.episodeAccess);
              })
              .catch(() => {
                setSeriesError("We couldn't load this right now.");
              })
              .finally(() => {
                setIsSeriesLoading(false);
              });
          }}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      </Screen>
    );
  }

  if (series.episodes.length === 0) {
    return (
      <Screen scroll={false}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Title>{series.title}</Title>
          </View>
          <Label>No episodes are available right now.</Label>
        </View>
      </Screen>
    );
  }

  if (isHistoryLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Title>{series.title}</Title>
        </View>

        {ranges.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangeStrip}>
            {ranges.map((range) => {
              const isSelected = range.start === activeRangeStart;

              return (
                <Pressable
                  accessibilityLabel={`Show episodes ${range.start} to ${range.end}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={`${range.start}-${range.end}`}
                  onPress={() => setSelectedRangeStart(range.start)}
                  style={({ pressed }) => [
                    styles.rangeChip,
                    isSelected && styles.rangeChipSelected,
                    pressed && styles.rangePressed,
                  ]}
                >
                  <Text style={[styles.rangeText, isSelected && styles.rangeTextSelected]}>
                    {range.start}-{range.end}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <FlatList
          contentContainerStyle={styles.gridContent}
          data={visibleEpisodes}
          key={columns}
          keyExtractor={(episode) => String(episode.number)}
          numColumns={columns}
          renderItem={({ index, item }) => {
            const access = episodeAccess[String(item.number)] ?? {
              canWatch: false,
              kind: "locked" as const,
              label: "Locked" as const,
            };
            const accessDisplay = getEpisodeAccessDisplay(item, access, {
              isGuest: !session,
              isPlus: isPlusUser,
            });
            const isCurrent = item.number === resumeEpisode?.number;

            return (
              <Pressable
                accessibilityLabel={`Episode ${item.number}: ${item.title}. ${accessDisplay.accessibilityLabel}${
                  isCurrent ? ". Current episode." : ""
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent }}
                onPress={() => handleEpisodePress(item)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    height: cellSize,
                    marginRight: (index + 1) % columns === 0 ? 0 : GRID_GAP,
                    width: cellSize,
                  },
                  isCurrent && styles.cellCurrent,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.cellNumber, isCurrent && styles.cellNumberCurrent]}>
                  {item.number}
                </Text>
                <EpisodeAccessMarkers accessDisplay={accessDisplay} />
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
          style={styles.gridList}
        />
      </View>
    </Screen>
  );
}

function getColumnsForWidth(width: number) {
  const availableWidth = width - SCREEN_HORIZONTAL_PADDING * 2;
  const preferredCellSize = Math.floor(
    (availableWidth - (PREFERRED_COLUMNS - 1) * GRID_GAP) / PREFERRED_COLUMNS,
  );

  if (preferredCellSize >= TOUCH_TARGET_MIN) {
    return PREFERRED_COLUMNS;
  }

  for (let columns = PREFERRED_COLUMNS - 1; columns >= MIN_COLUMNS; columns -= 1) {
    const cellSize = Math.floor((availableWidth - (columns - 1) * GRID_GAP) / columns);
    if (cellSize >= TOUCH_TARGET_MIN) {
      return columns;
    }
  }

  return MIN_COLUMNS;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    paddingBottom: 20,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 12,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rangeStrip: {
    maxHeight: 44,
  },
  rangeChip: {
    alignItems: "center",
    borderColor: borders.color,
    borderWidth: borders.width,
    justifyContent: "center",
    marginRight: 8,
    minHeight: 36,
    minWidth: 70,
    paddingHorizontal: 12,
  },
  rangeChipSelected: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.accent,
  },
  rangePressed: {
    opacity: 0.8,
  },
  rangeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  rangeTextSelected: {
    color: colors.accent,
  },
  gridList: {
    flex: 1,
  },
  gridContent: {
    paddingBottom: 20,
  },
  cell: {
    alignItems: "center",
    borderColor: borders.color,
    borderRadius: 6,
    borderWidth: borders.width,
    justifyContent: "center",
    marginBottom: GRID_GAP,
    paddingHorizontal: 3,
  },
  cellCurrent: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.8,
  },
  cellNumber: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  cellNumberCurrent: {
    color: colors.accent,
  },
  markerRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    justifyContent: "center",
    marginTop: 3,
  },
  cellAccessLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
    textAlign: "center",
  },
  cellAccessLabelAvailable: {
    color: colors.text,
  },
  cellAccessLabelAd: {
    color: colors.muted,
  },
  cellAccessLabelCoin: {
    color: colors.text,
  },
  cellAccessLabelLocked: {
    color: colors.muted,
  },
  cellAccessLabelPlus: {
    color: PLUS_MARKER_COLOR,
  },
  cellAccessLabelCurrent: {
    color: colors.accent,
  },
  marker: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  markerAvailable: {},
  markerLocked: {},
  markerCurrent: {},
  coinGlyph: {
    alignItems: "center",
    backgroundColor: "#F2B705",
    borderColor: "#F6DD63",
    borderRadius: 999,
    borderWidth: 1.3,
    height: 8,
    justifyContent: "center",
    width: 8,
  },
  coinGlyphInner: {
    backgroundColor: "#D89100",
    borderRadius: 999,
    height: 4.5,
    width: 4.5,
  },
  coinGlyphHighlight: {
    backgroundColor: "#FFF0A6",
    borderRadius: 999,
    height: 1.6,
    left: 2,
    position: "absolute",
    top: 1.5,
    width: 1.6,
  },
});
