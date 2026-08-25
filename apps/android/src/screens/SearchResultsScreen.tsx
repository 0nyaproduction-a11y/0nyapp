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
import { useAuth } from "../lib/authContext";
import { findResumeEpisode, findStartEpisode } from "../lib/seriesPlayback";
import type { RootStackScreenProps, ExploreFormat } from "../navigation/types";
import type { ApiSeries, ApiShortFilm, WatchProgressItem } from "../types/api";
import { borders, colors } from "../theme/tokens";

const ALL_GENRES_FILTER = "All";
const GRID_HORIZONTAL_PADDING = 20;
const GRID_GAP = 12;
const NARROW_WIDTH_BREAKPOINT = 360;
const formatOptions: Array<{ label: string; value: ExploreFormat }> = [
  { label: "All", value: "all" },
  { label: "Micro Dramas", value: "micro-dramas" },
  { label: "Short Films", value: "short-films" },
];

function hasValidPoster(poster?: string) {
  return typeof poster === "string" && poster.trim().length > 0 && !poster.startsWith("/");
}

function matchesMicroDramaQuery(series: ApiSeries, normalizedQuery: string) {
  return (
    series.title.toLowerCase().includes(normalizedQuery) ||
    (series.genre ?? "").toLowerCase().includes(normalizedQuery)
  );
}

function matchesShortFilmQuery(item: ApiShortFilm, normalizedQuery: string) {
  return item.title.toLowerCase().includes(normalizedQuery);
}

export function SearchResultsScreen({ navigation, route }: RootStackScreenProps<"SearchResults">) {
  const { query: initialQuery, format: initialFormat = "all", genre } = route.params;
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { width } = useWindowDimensions();
  const [catalog, setCatalog] = useState<ApiSeries[]>([]);
  const [shortFilms, setShortFilms] = useState<ApiShortFilm[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [selectedFormat, setSelectedFormat] = useState<ExploreFormat>(initialFormat);
  const [selectedGenre, setSelectedGenre] = useState(
    genre && genre !== ALL_GENRES_FILTER ? genre : ALL_GENRES_FILTER,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);

  const reloadCatalog = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await getCatalog(accessToken);
      setCatalog(data.catalog);
      setShortFilms(data.shortFilms);
      setError(null);
    } catch {
      setError("We couldn't load this right now.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const runLoad = async () => {
        setIsLoading(true);

        try {
          const data = await getCatalog(accessToken);

          if (!isActive) {
            return;
          }

          setCatalog(data.catalog);
          setShortFilms(data.shortFilms);
          setError(null);
        } catch {
          if (!isActive) {
            return;
          }

          setError("We couldn't load this right now.");
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      };

      void runLoad();

      return () => {
        isActive = false;
      };
    }, [accessToken]),
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

  const normalizedQuery = query.trim().toLowerCase();
  const columns = width < NARROW_WIDTH_BREAKPOINT ? 2 : 3;
  const cardWidth =
    (width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (columns - 1)) / columns;

  const seriesResults = useMemo(() => {
    const scope = selectedFormat === "short-films" ? [] : catalog;

    return scope.filter((series) => {
      const matchesGenre =
        selectedFormat !== "micro-dramas" ||
        effectiveGenre === ALL_GENRES_FILTER ||
        series.genre === effectiveGenre;
      const matchesSearch = !normalizedQuery || matchesMicroDramaQuery(series, normalizedQuery);

      return matchesGenre && matchesSearch;
    });
  }, [catalog, effectiveGenre, normalizedQuery, selectedFormat]);

  const shortFilmResults = useMemo(() => {
    const scope = selectedFormat === "micro-dramas" ? [] : shortFilms;

    return scope.filter((item) => !normalizedQuery || matchesShortFilmQuery(item, normalizedQuery));
  }, [normalizedQuery, selectedFormat, shortFilms]);

  const suggestions = useMemo(() => {
    const current = selectedFormat === "micro-dramas" ? catalog : selectedFormat === "short-films" ? shortFilms : [...catalog, ...shortFilms];

    return current.slice(0, 6);
  }, [catalog, selectedFormat, shortFilms]);
  const suggestionCards = suggestions.slice(0, 3);

  const shouldShowGenreFilter = selectedFormat === "micro-dramas" && availableGenres.length > 1;

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
      const targetAccess = targetEpisode 
        ? seriesData.episodeAccess[String(targetEpisode.number)]
        : undefined;

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

  function renderResultCard(item: ApiSeries | ApiShortFilm, index: number) {
    const isSeries = "genre" in item;
    const title = item.title;
    const key = isSeries ? `series-${item.slug}` : `short-${item.slug}`;
    const isBusy = resolvingKey === key;

    return (
      <View key={`${key}-${index}`} style={{ width: cardWidth }}>
        <Pressable
          accessibilityLabel={
            isSeries ? `Open ${title}` : `Open details for ${title}`
          }
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() => {
            if (isSeries) {
              void openSeriesPlayback(item);
              return;
            }

            navigation.navigate("ShortFilm", { slug: item.slug });
          }}
          style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.cardPressed]}
        >
          <View style={[styles.posterWrap, { width: cardWidth, height: cardWidth * (16 / 9) }]}>
            {hasValidPoster(item.poster) ? (
              <Image
                accessible
                accessibilityLabel={`${title} poster`}
                alt=""
                source={{ uri: item.poster }}
                style={styles.posterImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.posterFallback}>
                <Text style={styles.posterTitle} numberOfLines={2}>
                  {title}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {isSeries ? "Micro Drama" : "Short Film"}
          </Text>
        </Pressable>
      </View>
    );
  }

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
      <View style={styles.chromeStack}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.headerRow}
        >
          <Text style={styles.headerArrow}>←</Text>
          <Text style={styles.headerTitle}>Search results</Text>
        </Pressable>

        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="Search results"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={() => Keyboard.dismiss()}
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

        <ScrollView
          contentContainerStyle={styles.filterRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
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
          <ScrollView
            contentContainerStyle={styles.filterRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {availableGenres.map((genreOption) => {
              const isSelected = genreOption === selectedGenre;

              return (
                <Pressable
                  key={genreOption}
                  accessibilityLabel={`Filter by ${genreOption}`}
                  accessibilityRole="button"
                  onPress={() => setSelectedGenre(genreOption)}
                  style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                    {genreOption}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {seriesResults.length > 0 || shortFilmResults.length > 0 ? (
      <>
        <Text style={styles.sectionTitle}>{`Results for "${query.trim() || initialQuery}"`}</Text>
        <View style={styles.grid}>
          {seriesResults.map((series, index) => renderResultCard(series, index))}
          {shortFilmResults.map((shortFilm, index) => renderResultCard(shortFilm, index))}
        </View>
      </>
      ) : (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>{`No results for "${query.trim() || initialQuery}"`}</Text>
        <Text style={styles.emptyBody}>Try another search or explore these titles.</Text>
        <Text style={styles.sectionLabel}>Explore suggestions</Text>
        <View style={styles.grid}>
          {suggestionCards.length > 0 ? (
            suggestionCards.map((suggestion, index) => renderResultCard(suggestion, index))
          ) : (
            <Text style={styles.emptyBody}>Try another title or genre.</Text>
          )}
        </View>
        <Pressable
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          onPress={() => {
            setQuery("");
            Keyboard.dismiss();
          }}
          style={({ pressed }) => [styles.clearSearchLink, pressed && styles.linkPressed]}
        >
          <Text style={styles.clearSearchText}>Clear search</Text>
        </Pressable>
      </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chromeStack: {
    gap: 12,
  },
  headerRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerArrow: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 22,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
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
  filterRow: {
    gap: 8,
    paddingVertical: 2,
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
    fontWeight: "500",
  },
  filterChipTextSelected: {
    color: colors.accent,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    gap: 8,
  },
  cardPressed: {
    opacity: 0.85,
  },
  posterWrap: {
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  posterImage: {
    height: "100%",
    width: "100%",
  },
  posterFallback: {
    alignItems: "center",
    backgroundColor: colors.surface,
    height: "100%",
    justifyContent: "center",
    padding: 12,
    width: "100%",
  },
  posterTitle: {
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
    gap: 12,
    paddingTop: 12,
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
  clearSearchLink: {
    alignSelf: "flex-start",
  },
  linkPressed: {
    opacity: 0.8,
  },
  clearSearchText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
});
