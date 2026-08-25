import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Label, LoadingState, RecoveryState, Title } from "../components/ui";
import { useAuth } from "../lib/authContext";
import { getSeries } from "../lib/api";
import { loadWatchHistory } from "../lib/playbackHistory";
import { findResumeEpisode } from "../lib/seriesPlayback";
import type { RootStackParamList } from "../navigation/types";
import type { ApiEpisode, ApiSeries, EpisodeAccess, WatchProgressItem } from "../types/api";
import { borders, colors } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "SeriesEpisodes">;

const RANGE_SIZE = 25;

function buildRanges(totalEpisodes: number, rangeSize: number) {
  const ranges: { end: number; start: number }[] = [];
  for (let start = 1; start <= totalEpisodes; start += rangeSize) {
    ranges.push({ start, end: Math.min(totalEpisodes, start + rangeSize - 1) });
  }
  return ranges;
}

function getRangeStartForEpisode(episodeNumber: number, totalEpisodes: number) {
  const boundedEpisodeNumber = Math.min(Math.max(1, episodeNumber), totalEpisodes || 1);
  return Math.floor((boundedEpisodeNumber - 1) / RANGE_SIZE) * RANGE_SIZE + 1;
}

export function SeriesEpisodesScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const routedSeries = route.params.series;
  const routedSeriesSlug = route.params.seriesSlug ?? routedSeries?.slug;
  const [resolvedSeries, setResolvedSeries] = useState<ApiSeries | null>(routedSeries ?? null);
  const [resolvedEpisodeAccess, setResolvedEpisodeAccess] = useState<Record<string, EpisodeAccess>>(
    route.params.episodeAccess ?? {},
  );
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const shouldFetchSeries = !routedSeries || routedSeries.episodes.length === 0;
  const [isSeriesLoading, setIsSeriesLoading] = useState(() => shouldFetchSeries);
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
          setIsSeriesLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, routedSeriesSlug, shouldFetchSeries]);

  const series = resolvedSeries ?? routedSeries ?? null;
  const episodeAccess = resolvedEpisodeAccess;
  const totalEpisodes = series
    ? Math.max(
        series.episodeCount > 0 ? series.episodeCount : series.episodes.length,
        series.episodes.length,
      )
    : 0;
  const ranges = useMemo(() => buildRanges(totalEpisodes, RANGE_SIZE), [totalEpisodes]);

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
    () => getRangeStartForEpisode(resumeEpisode?.number ?? 1, totalEpisodes),
    [resumeEpisode, totalEpisodes],
  );
  const activeRangeStart = selectedRangeStart ?? initialRangeStart;

  const visibleEpisodes = useMemo(() => {
    if (!series) {
      return [];
    }

    const startIndex = Math.max(0, activeRangeStart - 1);
    return series.episodes.slice(startIndex, startIndex + RANGE_SIZE);
  }, [activeRangeStart, series]);

  const handleEpisodePress = (episode: ApiEpisode) => {
    if (!series) {
      return;
    }

    const access = episodeAccess[String(episode.number)] ?? {
      canWatch: false,
      kind: "locked" as const,
      label: "Locked" as const,
    };

    if (access.canWatch) {
      navigation.navigate("Watch", {
        access,
        episode,
        episodeAccess,
        series,
      });
      return;
    }

    navigation.navigate("EpisodeAccessOptions", {
      access,
      episode,
      episodeAccess,
      seriesSlug: series.slug,
      seriesTitle: series.title,
    });
  };

  const resumeRangeIndex = useMemo(() => {
    if (!resumeEpisode) {
      return undefined;
    }

    const minNumber = activeRangeStart;
    const maxNumber = activeRangeStart + RANGE_SIZE - 1;
    if (resumeEpisode.number < minNumber || resumeEpisode.number > maxNumber) {
      return undefined;
    }

    return resumeEpisode.number - minNumber;
  }, [activeRangeStart, resumeEpisode]);

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
          contentContainerStyle={styles.listContent}
          data={visibleEpisodes}
          getItemLayout={(_, index) => ({
            index,
            length: 68,
            offset: index * 68,
          })}
          initialScrollIndex={resumeRangeIndex}
          keyExtractor={(episode) => String(episode.number)}
          renderItem={({ item }) => {
            const access = episodeAccess[String(item.number)] ?? {
              canWatch: false,
              kind: "locked" as const,
              label: "Locked" as const,
            };

            return (
              <Pressable
                accessibilityLabel={`Episode ${item.number}: ${item.title}`}
                accessibilityRole="button"
                onPress={() => handleEpisodePress(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.episodeNumber}>Ep {item.number}</Text>
                  <View style={styles.textWrap}>
                    <Text numberOfLines={1} style={styles.episodeTitle}>
                      {item.title || `Episode ${item.number}`}
                    </Text>
                    {item.runtime ? <Text style={styles.episodeMeta}>{item.runtime}</Text> : null}
                  </View>
                </View>
                <Text style={styles.accessLabel}>{access.label}</Text>
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    paddingBottom: 20,
    paddingHorizontal: 16,
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
    backgroundColor: "rgba(13, 209, 188, 0.12)",
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
  list: {
    flex: 1,
  },
  listContent: {
    gap: 8,
    paddingBottom: 20,
  },
  row: {
    alignItems: "center",
    borderBottomColor: borders.color,
    borderBottomWidth: borders.width,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 64,
    paddingVertical: 10,
  },
  rowPressed: {
    opacity: 0.8,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  episodeNumber: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    width: 54,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  episodeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  episodeMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  accessLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    textTransform: "uppercase",
  },
});
