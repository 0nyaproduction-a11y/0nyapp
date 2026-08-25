import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Screen } from "../components/Screen";
import { LoadingState, RecoveryState } from "../components/ui";
import { getCatalog, getSeries } from "../lib/api";
import { loadWatchHistory } from "../lib/playbackHistory";
import { clearRecentSearches, loadRecentSearches, saveRecentSearch } from "../lib/recentSearches";
import { useAuth } from "../lib/authContext";
import { findResumeEpisode, findStartEpisode } from "../lib/seriesPlayback";
import type { ExploreFormat, MainTabScreenProps } from "../navigation/types";
import type { ApiSeries, ApiShortFilm, WatchProgressItem } from "../types/api";
import { borders, colors } from "../theme/tokens";

type Props = MainTabScreenProps<"Explore">;

const GRID_HORIZONTAL_PADDING = 20;
const GRID_GAP = 12;
const NARROW_WIDTH_BREAKPOINT = 360;
const ALL_GENRES_FILTER = "All";
const formatOptions: Array<{ label: string; value: ExploreFormat }> = [
  { label: "All", value: "all" },
  { label: "Micro Dramas", value: "micro-dramas" },
  { label: "Short Films", value: "short-films" },
];

function hasValidPoster(poster?: string) {
  return typeof poster === "string" && poster.trim().length > 0 && !poster.startsWith("/");
}

export function ExploreScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { width } = useWindowDimensions();
  const [catalog, setCatalog] = useState<ApiSeries[]>([]);
  const [shortFilms, setShortFilms] = useState<ApiShortFilm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<ExploreFormat>("all");
  const [selectedGenre, setSelectedGenre] = useState(ALL_GENRES_FILTER);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    const data = await getCatalog(accessToken);
    setCatalog(data.catalog);
    setShortFilms(data.shortFilms);
    setError(null);
    return data;
  }, [accessToken]);

  const reloadCatalog = useCallback(async () => {
    setIsLoading(true);

    try {
      await loadCatalog();
    } catch {
      setError("We couldn't load this right now.");
    } finally {
      setIsLoading(false);
    }
  }, [loadCatalog]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const runLoad = async () => {
        try {
          const data = await loadCatalog();

          if (!isMounted) {
            return;
          }

          setCatalog(data.catalog);
          setShortFilms(data.shortFilms);
        } catch {
          if (!isMounted) {
            return;
          }

          setError("We couldn't load this right now.");
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

      void runLoad();

      return () => {
        isMounted = false;
      };
    }, [loadCatalog]),
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void loadRecentSearches().then((items) => {
        if (isActive) {
          setRecentSearches(items);
        }
      });

      return () => {
        isActive = false;
      };
    }, []),
  );

  const effectiveGenre = selectedFormat === "micro-dramas" ? selectedGenre : ALL_GENRES_FILTER;

  const availableGenres = useMemo(() => {
    const genres = new Set<string>();

    catalog.forEach((series) => {
      if (series.genre) {
        genres.add(series.genre);
      }
    });

    return [ALL_GENRES_FILTER, ...Array.from(genres).sort((a, b) => a.localeCompare(b))];
  }, [catalog]);

  const shouldShowGenreFilter = selectedFormat === "micro-dramas" && availableGenres.length > 1;

  const visibleCatalog = useMemo(() => {
    return catalog.filter((series) => {
      const matchesFormat = selectedFormat === "all" || selectedFormat === "micro-dramas";
      const matchesGenre =
        !shouldShowGenreFilter ||
        effectiveGenre === ALL_GENRES_FILTER ||
        series.genre === effectiveGenre;

      return matchesFormat && matchesGenre;
    });
  }, [catalog, effectiveGenre, selectedFormat, shouldShowGenreFilter]);

  const visibleShortFilms = useMemo(() => {
    if (selectedFormat === "micro-dramas") {
      return [];
    }

    return selectedFormat === "short-films" || selectedFormat === "all" ? shortFilms : [];
  }, [selectedFormat, shortFilms]);

  const columns = width < NARROW_WIDTH_BREAKPOINT ? 2 : 3;
  const cardWidth =
    (width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (columns - 1)) / columns;

  async function openSeriesPlayback(series: ApiSeries) {
    const key = `series-${series.slug}`;

    if (resolvingKey) {
      return;
    }

    setResolvingKey(key);

    try {
      const seriesData = await getSeries(series.slug, accessToken);
      const progressData = await loadWatchHistory(session).catch(() => [] as WatchProgressItem[]);
      const seriesProgress = progressData.filter(
        (item) => item.contentType === "series_episode" && item.seriesSlug === series.slug,
      );
      const resumeEpisode = findResumeEpisode(
        seriesProgress,
        seriesData.series.slug,
        seriesData.series.episodes,
        seriesData.episodeAccess,
      );
      const startEpisode = findStartEpisode(seriesData.series.episodes);
      const targetEpisode = resumeEpisode ?? startEpisode;
      const targetAccess = targetEpisode ? seriesData.episodeAccess[String(targetEpisode.number)] : undefined;

      if (targetEpisode && targetAccess) {
        navigation.navigate("Watch", {
          access: targetAccess,
          episode: targetEpisode,
          episodeAccess: seriesData.episodeAccess,
          series: seriesData.series,
        });
        return;
      }
    } catch {
      // Fall through to details.
    } finally {
      setResolvingKey(null);
    }

    navigation.navigate("Series", { slug: series.slug });
  }

  const submitSearch = useCallback(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      Keyboard.dismiss();
      return;
    }

    void saveRecentSearch(trimmedQuery).then(() => loadRecentSearches().then(setRecentSearches));
    Keyboard.dismiss();
    navigation.push("SearchResults", {
      format: selectedFormat,
      genre: shouldShowGenreFilter && effectiveGenre !== ALL_GENRES_FILTER ? effectiveGenre : undefined,
      query: trimmedQuery,
    });
  }, [effectiveGenre, navigation, query, selectedFormat, shouldShowGenreFilter]);

  const openRecentSearch = useCallback(
    (search: string) => {
      const trimmed = search.trim();

      if (!trimmed) {
        return;
      }

      setQuery(trimmed);
      void saveRecentSearch(trimmed).then(() => loadRecentSearches().then(setRecentSearches));
      Keyboard.dismiss();
      navigation.push("SearchResults", {
        format: selectedFormat,
        genre: shouldShowGenreFilter && effectiveGenre !== ALL_GENRES_FILTER ? effectiveGenre : undefined,
        query: trimmed,
      });
    },
    [effectiveGenre, navigation, selectedFormat, shouldShowGenreFilter],
  );

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <RecoveryState
          body={error}
          onPrimaryAction={() => void reloadCatalog()}
          primaryActionLabel="Retry"
          title="We couldn't load this right now."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.screenTitle}>Explore</Text>

      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="Search 0nya"
          autoCapitalize="none"
          autoCorrect={false}
          onBlur={() => setIsSearchFocused(false)}
          onChangeText={setQuery}
          onFocus={() => setIsSearchFocused(true)}
          onSubmitEditing={submitSearch}
          placeholder="Search 0nya"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setQuery("")}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>{"\u00D7"}</Text>
          </Pressable>
        ) : null}
      </View>

      {(isSearchFocused || query.trim().length > 0) && recentSearches.length > 0 ? (
        <View style={styles.recentWrap}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent searches</Text>
            <Pressable
              accessibilityLabel="Clear recent searches"
              accessibilityRole="button"
              onPress={() => {
                void clearRecentSearches().then(() => setRecentSearches([]));
              }}
            >
              <Text style={styles.clearRecentText}>Clear</Text>
            </Pressable>
          </View>
          {recentSearches.map((search) => (
            <Pressable
              key={search}
              accessibilityLabel={`Search ${search}`}
              accessibilityRole="button"
              onPress={() => openRecentSearch(search)}
              style={({ pressed }) => [styles.recentItem, pressed && styles.cardPressed]}
            >
              <Text style={styles.recentItemText}>{search}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.filterRow} horizontal showsHorizontalScrollIndicator={false}>
        {formatOptions.map((option) => {
          const isSelected = option.value === selectedFormat;

          return (
            <Pressable
              key={option.value}
              accessibilityLabel={`Filter by ${option.label}`}
              accessibilityRole="button"
              onPress={() => {
                setSelectedFormat(option.value);
                if (option.value !== "micro-dramas") {
                  setSelectedGenre(ALL_GENRES_FILTER);
                }
              }}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {shouldShowGenreFilter ? (
        <ScrollView contentContainerStyle={styles.filterRow} horizontal showsHorizontalScrollIndicator={false}>
          {availableGenres.map((genre) => {
            const isSelected = genre === selectedGenre;

            return (
              <Pressable
                key={genre}
                accessibilityLabel={`Filter by ${genre}`}
                accessibilityRole="button"
                onPress={() => setSelectedGenre(genre)}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                  {genre}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <Text style={styles.sectionTitle}>Discover</Text>

      {visibleCatalog.length > 0 || visibleShortFilms.length > 0 ? (
        <View style={styles.grid}>
          {visibleCatalog.map((series) => {
            const isBusy = resolvingKey === `series-${series.slug}`;

            return (
              <View key={series.slug} style={{ width: cardWidth }}>
                <Pressable
                  accessibilityLabel={`Play or resume ${series.title}`}
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={() => void openSeriesPlayback(series)}
                  style={({ pressed }) => [
                    styles.cardMainPressable,
                    { width: cardWidth },
                    isBusy && styles.cardBusy,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={[styles.coverWrap, { width: cardWidth, height: cardWidth * (16 / 9) }]}>
                    {hasValidPoster(series.poster) ? (
                      <Image
                        accessibilityLabel={`${series.title} poster`}
                        accessible
                        alt=""
                        source={{ uri: series.poster }}
                        style={styles.coverImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.coverFallback}>
                        <Text style={styles.coverTitle} numberOfLines={2}>
                          {series.title}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {series.title}
                  </Text>
                  <Text style={styles.cardMeta}>Micro Drama</Text>
                </Pressable>
              </View>
            );
          })}

          {visibleShortFilms.map((shortFilm) => {
            const isBusy = resolvingKey === `short-${shortFilm.slug}`;

            return (
              <View key={shortFilm.slug} style={{ width: cardWidth }}>
                <Pressable
                  accessibilityLabel={`Open details for ${shortFilm.title}`}
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={() => navigation.navigate("ShortFilm", { slug: shortFilm.slug })}
                  style={({ pressed }) => [
                    styles.cardMainPressable,
                    { width: cardWidth },
                    isBusy && styles.cardBusy,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={[styles.coverWrap, { width: cardWidth, height: cardWidth * (16 / 9) }]}>
                    {hasValidPoster(shortFilm.poster) ? (
                      <Image
                        accessibilityLabel={`${shortFilm.title} poster`}
                        accessible
                        alt=""
                        source={{ uri: shortFilm.poster }}
                        style={styles.coverImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.coverFallback}>
                        <Text style={styles.coverTitle} numberOfLines={2}>
                          {shortFilm.title}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {shortFilm.title}
                  </Text>
                  <Text style={styles.cardMeta}>Short Film</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No results</Text>
          <Text style={styles.emptyBody}>Try another title or genre.</Text>
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            onPress={() => {
              setQuery("");
              setSelectedGenre(ALL_GENRES_FILTER);
            }}
            style={({ pressed }) => [styles.clearEmptyButton, pressed && styles.cardPressed]}
          >
            <Text style={styles.clearEmptyButtonText}>Clear search</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  searchRow: {
    alignItems: "center",
    borderColor: borders.color,
    borderWidth: borders.width,
    flexDirection: "row",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  clearButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 32,
  },
  clearButtonText: {
    color: colors.muted,
    fontSize: 20,
  },
  recentWrap: {
    gap: 8,
    paddingTop: 4,
  },
  recentHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clearRecentText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  recentItem: {
    borderColor: borders.color,
    borderWidth: borders.width,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recentItemText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  filterRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    borderColor: borders.color,
    borderWidth: borders.width,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  filterChipSelected: {
    backgroundColor: colors.surface,
  },
  filterChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextSelected: {
    color: colors.accent,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  cardMainPressable: {
    gap: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  coverWrap: {
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  coverImage: {
    height: "100%",
    width: "100%",
  },
  coverFallback: {
    alignItems: "center",
    backgroundColor: colors.surface,
    height: "100%",
    justifyContent: "center",
    padding: 12,
    width: "100%",
  },
  coverTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  emptyState: {
    gap: 10,
    paddingTop: 12,
    width: "100%",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 14,
  },
  clearEmptyButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: borders.color,
    borderWidth: borders.width,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clearEmptyButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  cardBusy: {
    opacity: 0.7,
  },
  cardPressed: {
    opacity: 0.8,
  },
});
