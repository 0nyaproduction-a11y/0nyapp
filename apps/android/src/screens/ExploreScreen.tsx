import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Screen } from "../components/Screen";
import { BehaviorImpression } from "../components/BehaviorImpression";
import { DetailInfoButton, LoadingState, RecoveryState } from "../components/ui";
import { resolveMediaUrl } from "../lib/media";
import { useDiscoveryCatalog } from "../lib/useDiscoveryCatalog";
import { isContinueWatchingProgress } from "../lib/playbackCompletion";
import { createScreenRequestOwner } from "../lib/screenResources";
import { perfMark } from "../lib/perf";
import { clearRecentSearches, loadRecentSearches, saveRecentSearch } from "../lib/recentSearches";
import {
  ALL_GENRES_FILTER,
  filterDiscoverableItems,
  getAvailableGenreOptions,
  sortDiscoverableItems,
  toDiscoverableItems,
  type DiscoverableItem,
} from "../lib/discovery";
import { useAuth } from "../lib/authContext";
import { recordRankingDecision } from "../lib/api";
import { emitBehaviorEvidence } from "../lib/behavioralEvents";
import { markCollectionServed } from "../lib/behaviorImpressionModel";
import {
  createExploreRankingDecision,
  recommendationReasonForResult,
  runRankingDecisionEvidenceFailOpen,
} from "../lib/rankingDecisionEvidence";
import { findStartEpisode } from "../lib/seriesPlayback";
import type { DiscoveryContext, ExploreFormat, MainTabScreenProps } from "../navigation/types";
import type { ApiSeries, ApiShortFilm } from "../types/api";
import { borders, colors, radii, typography } from "../theme/tokens";
import { useAppLanguage } from "../lib/appLanguage";

type Props = MainTabScreenProps<"Explore">;

const GRID_HORIZONTAL_PADDING = 20;
const GRID_GAP = 12;
const NARROW_WIDTH_BREAKPOINT = 360;

const formatOptions: Array<{ label: string; value: ExploreFormat }> = [
  { label: "All", value: "all" },
  { label: "Micro Dramas", value: "micro-dramas" },
  { label: "Short Films", value: "short-films" },
];

function hasValidPoster(poster?: string) {
  return typeof poster === "string" && poster.trim().length > 0;
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

export function ExploreScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { t } = useAppLanguage();
  const accessToken = session?.access_token;
  const { width } = useWindowDimensions();
  const resource = useDiscoveryCatalog(session, true);
  const { catalog, shortFilms } = resource;
  const progress = resource.progress;
  const { isLoading, error, reload: reloadCatalog } = resource;
  const [query, setQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<ExploreFormat>("all");
  const [selectedGenre, setSelectedGenre] = useState(ALL_GENRES_FILTER);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
  const [viewportSignal, setViewportSignal] = useState(0);
  const servedCollectionsRef = useRef(new Set<string>());
  const submittedDecisionIdsRef = useRef(new Set<string>());
  const recentSearchOwner = useMemo(() => createScreenRequestOwner(), []);
  const refreshRecentSearches = useCallback((operation?: () => Promise<unknown>) => {
    const isCurrent = recentSearchOwner.begin();
    void Promise.resolve().then(() => operation?.()).then(loadRecentSearches).then((items) => {
      if (isCurrent()) setRecentSearches(items);
    }).catch(() => { /* Optional device-local history stays available on retry/focus. */ });
  }, [recentSearchOwner]);

  useEffect(() => {
    perfMark("EXPLORE_MOUNT");
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshRecentSearches();
      return () => recentSearchOwner.invalidate();
    }, [recentSearchOwner, refreshRecentSearches]),
  );

  const discoverableItems = useMemo(
    () => toDiscoverableItems(catalog, shortFilms),
    [catalog, shortFilms],
  );

  const availableGenres = useMemo(() => {
    return getAvailableGenreOptions(discoverableItems, selectedFormat);
  }, [discoverableItems, selectedFormat]);

  const shouldShowGenreFilter = availableGenres.length > 0;

  const selectedGenreLabel = useMemo(() => {
    if (selectedGenre === ALL_GENRES_FILTER) {
      return ALL_GENRES_FILTER;
    }

    return (
      availableGenres.find((genre) => genre.id === selectedGenre)?.displayName ??
      selectedGenre
    );
  }, [availableGenres, selectedGenre]);

  const hasQuery = query.trim().length > 0;
  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    const entries = filterDiscoverableItems(
      discoverableItems,
      selectedFormat,
      selectedGenre,
    ).filter((entry) => {
      if (!hasQuery) return true;
      return entry.contentType === "MICRO_DRAMA"
        ? matchesMicroDramaQuery(entry.item, normalizedQuery)
        : matchesShortFilmQuery(entry.item, normalizedQuery);
    });

    return sortDiscoverableItems(entries, "default");
  }, [
    discoverableItems,
    hasQuery,
    normalizedQuery,
    selectedFormat,
    selectedGenre,
  ]);

  const totalCount = filteredItems.length;
  const collectionContext = useMemo(
    () => `explore:${selectedFormat}:${selectedGenre}:${normalizedQuery}:${filteredItems.map((entry) => `${entry.contentType}:${entry.item.id ?? entry.item.slug}`).join(",")}`,
    [filteredItems, normalizedQuery, selectedFormat, selectedGenre],
  );
  const rankingDecision = useMemo(
    () => createExploreRankingDecision({
      candidates: discoverableItems,
      displayedResults: filteredItems,
      normalizedQuery,
      selectedFormat,
      selectedGenre,
    }),
    [discoverableItems, filteredItems, normalizedQuery, selectedFormat, selectedGenre],
  );

  useEffect(() => {
    if (isLoading || error || submittedDecisionIdsRef.current.has(rankingDecision.rankingDecisionId)) return;
    submittedDecisionIdsRef.current.add(rankingDecision.rankingDecisionId);
    runRankingDecisionEvidenceFailOpen(recordRankingDecision(accessToken, rankingDecision));
  }, [accessToken, error, isLoading, rankingDecision]);

  useEffect(() => {
    if (isLoading || error) return;
    if (!markCollectionServed(servedCollectionsRef.current, collectionContext)) return;
    filteredItems.forEach((entry, index) => emitBehaviorEvidence(accessToken, {
      eventType: "content_served",
      contentId: entry.item.id ?? `${entry.contentType}:${entry.item.slug}`,
      contentType: entry.contentType,
      sourceSurface: "explore",
      position: index + 1,
      rankingDecisionId: rankingDecision.rankingDecisionId,
      recommendationReason: recommendationReasonForResult(rankingDecision, entry),
    }));
  }, [accessToken, collectionContext, error, filteredItems, isLoading, rankingDecision]);

  const columns = width < NARROW_WIDTH_BREAKPOINT ? 2 : 3;
  const cardWidth =
    (width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (columns - 1)) / columns;

  async function openSeriesPlayback(series: ApiSeries, searchContext?: DiscoveryContext) {
    const key = `series-${series.slug}`;

    if (resolvingKey) {
      return;
    }

    perfMark("CONTENT_TAP", {
      content_type: "series_episode",
      series_slug: series.slug,
      source: "EXPLORE",
    });
    setResolvingKey(key);

    try {
      const seriesProgress = progress.filter(
        (item) => item.contentType === "series_episode" && item.seriesSlug === series.slug,
      );
      const resumeProgress = seriesProgress
        .sort(
          (first, second) =>
            new Date(second.lastWatchedAt).getTime() - new Date(first.lastWatchedAt).getTime(),
        )
        .find(isContinueWatchingProgress);
      const resumeEpisode = resumeProgress
        ? series.episodes.find((episode) => episode.number === resumeProgress.episodeNumber)
        : undefined;
      const startEpisode = findStartEpisode(series.episodes);
      const targetEpisode = resumeEpisode ?? startEpisode;

      if (targetEpisode) {
        navigation.navigate("Watch", {
          episodeNumber: targetEpisode.number,
          resumeAtSeconds: resumeProgress?.positionSeconds ?? undefined,
          seriesSlug: series.slug,
          searchContext,
        });
        return;
      }
    } catch {
      // Fall through to details.
    } finally {
      setResolvingKey(null);
    }

    navigation.navigate("Series", { searchContext, slug: series.slug });
  }

  const submitSearch = useCallback(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      Keyboard.dismiss();
      return;
    }

    refreshRecentSearches(() => saveRecentSearch(trimmedQuery));
    Keyboard.dismiss();
    navigation.navigate("SearchResults", {
      format: selectedFormat,
      genre: shouldShowGenreFilter && selectedGenre !== ALL_GENRES_FILTER ? selectedGenre : undefined,
      query: trimmedQuery,
    });
  }, [navigation, query, refreshRecentSearches, selectedFormat, selectedGenre, shouldShowGenreFilter]);

  const openRecentSearch = useCallback(
    (search: string) => {
      const trimmed = search.trim();

      if (!trimmed) {
        return;
      }

      setQuery(trimmed);
      refreshRecentSearches(() => saveRecentSearch(trimmed));
      Keyboard.dismiss();
      navigation.navigate("SearchResults", {
        format: selectedFormat,
        genre: shouldShowGenreFilter && selectedGenre !== ALL_GENRES_FILTER ? selectedGenre : undefined,
        query: trimmed,
      });
    },
    [navigation, refreshRecentSearches, selectedFormat, selectedGenre, shouldShowGenreFilter],
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
      <Screen scroll={false}>
        <RecoveryState
          body={error.body}
          onPrimaryAction={() => void reloadCatalog()}
          primaryActionLabel="Retry"
          variant="cinematic"
          title={error.title}
        />
      </Screen>
    );
  }

  return (
    <Screen onScroll={() => setViewportSignal((value) => value + 1)}>
      <Text style={styles.screenTitle}>{t("nav.explore", "Explore")}</Text>

      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>{"\u26B2"}</Text>
        <TextInput
          accessibilityLabel="Search 0nya"
          autoCapitalize="none"
          autoCorrect={false}
          onBlur={() => setIsSearchFocused(false)}
          onChangeText={setQuery}
          onFocus={() => setIsSearchFocused(true)}
          onSubmitEditing={submitSearch}
          placeholder={t("explore.search_placeholder", "Search series, films, genres...")}
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
            <View style={styles.clearCircle}>
              <Text style={styles.clearButtonText}>{"\u00D7"}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      {isSearchFocused && query.trim().length === 0 && recentSearches.length > 0 ? (
        <View style={styles.recentWrap}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>{t("explore.recent_searches", "Recent searches")}</Text>
            <Pressable
              accessibilityLabel="Clear recent searches"
              accessibilityRole="button"
              onPress={() => {
                refreshRecentSearches(clearRecentSearches);
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
          const displayLabel =
            option.value === "all"
              ? t("explore.all", "All")
              : option.value === "micro-dramas"
                ? t("explore.micro_dramas", "Micro Dramas")
                : t("explore.short_films", "Short Films");

          return (
            <Pressable
              key={option.value}
              accessibilityLabel={`Filter by ${displayLabel}`}
              accessibilityRole="button"
              onPress={() => {
                setSelectedFormat(option.value);
                setSelectedGenre(ALL_GENRES_FILTER);
              }}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                {displayLabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {shouldShowGenreFilter ? (
        <View style={styles.secondaryFilterRow}>
          <Pressable
            accessibilityLabel={`Filter by genre. Currently selected: ${selectedGenreLabel}`}
            accessibilityRole="button"
            onPress={() => setIsGenreModalOpen(true)}
            style={[
              styles.genreSelectButton,
              selectedGenre !== ALL_GENRES_FILTER && styles.genreSelectButtonActive,
            ]}
          >
            <Text
              style={[
                styles.genreSelectButtonText,
                selectedGenre !== ALL_GENRES_FILTER && styles.genreSelectButtonTextActive,
              ]}
            >
              {selectedGenre === ALL_GENRES_FILTER ? "Genre ▾" : `${selectedGenreLabel} ▾`}
            </Text>
          </Pressable>

          {selectedGenre !== ALL_GENRES_FILTER ? (
            <Pressable
              accessibilityLabel="Reset genre filter"
              accessibilityRole="button"
              onPress={() => setSelectedGenre(ALL_GENRES_FILTER)}
              style={styles.resetButton}
            >
              <Text style={styles.resetButtonText}>Reset ×</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {hasQuery
            ? `Results for "${query.trim()}"`
            : t("explore.discover", "Discover")}
        </Text>
        <Text style={styles.sectionCountText}>
          {`${totalCount} ${totalCount === 1 ? "title" : "titles"}`}
        </Text>
      </View>

      {filteredItems.length > 0 ? (
        <View style={styles.grid}>
          {filteredItems.map((entry, index) => {
            const isSeries = entry.contentType === "MICRO_DRAMA";
            const item = entry.item;
            const contentId = item.id ?? `${entry.contentType}:${item.slug}`;
            const recommendationReason = recommendationReasonForResult(rankingDecision, entry);
            const isBusy = resolvingKey === `${isSeries ? "series" : "short"}-${item.slug}`;

            return (
              <BehaviorImpression
                key={`${entry.contentType}-${item.slug}`}
                accessToken={accessToken}
                collectionContext={collectionContext}
                enabled={!isGenreModalOpen}
                evidence={{ contentId, contentType: entry.contentType, sourceSurface: "explore", position: index + 1, rankingDecisionId: rankingDecision.rankingDecisionId, recommendationReason }}
                scrollSignal={viewportSignal}
                style={{ width: cardWidth }}
              >
                <Pressable
                  accessibilityLabel={`Watch ${item.title}`}
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={() => {
                    const searchContext = { contentId, contentSlug: item.slug, contentType: entry.contentType, position: index + 1, rowId: null, sourceSurface: "explore" as const, rankingDecisionId: rankingDecision.rankingDecisionId, recommendationReason };
                    emitBehaviorEvidence(accessToken, { eventType: "content_open", contentId, contentType: entry.contentType, sourceSurface: "explore", position: index + 1, rankingDecisionId: rankingDecision.rankingDecisionId, recommendationReason });
                    perfMark("CONTENT_TAP", {
                      content_type: isSeries ? "series" : "short_film",
                      slug: item.slug,
                      source: "EXPLORE",
                    });
                    if (isSeries) {
                      const series = catalog.find((candidate) => candidate.slug === item.slug);
                      if (series) {
                        void openSeriesPlayback(series, searchContext);
                      } else {
                        navigation.navigate("Series", { searchContext, slug: item.slug });
                      }
                    } else {
                      navigation.navigate("ShortFilmPlayback", { searchContext, slug: item.slug });
                    }
                  }}
                  style={({ pressed }) => [
                    styles.cardMainPressable,
                    { width: cardWidth },
                    isBusy && styles.cardBusy,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={[styles.coverWrap, { width: cardWidth, height: cardWidth * (16 / 9) }]}>
                    {hasValidPoster(item.poster) ? (
                      <Image
                        accessibilityLabel={`${item.title} poster`}
                        accessible
                        alt=""
                        source={{ uri: resolveMediaUrl(item.poster)! }}
                        style={styles.coverImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.coverFallback}>
                        <Text style={styles.coverTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                      </View>
                    )}
                    <DetailInfoButton
                      accessibilityLabel={`More information about ${item.title}`}
                      onPress={() => {
                        const searchContext = { contentId, contentSlug: item.slug, contentType: entry.contentType, position: index + 1, rowId: null, sourceSurface: "explore" as const, rankingDecisionId: rankingDecision.rankingDecisionId, recommendationReason };
                        if (isSeries) {
                          navigation.navigate("Series", { searchContext, slug: item.slug });
                        } else {
                          navigation.navigate("ShortFilm", { searchContext, slug: item.slug });
                        }
                      }}
                      style={styles.infoButton}
                    >
                    </DetailInfoButton>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {isSeries
                        ? t("explore.micro_drama_tag", "MICRO DRAMA")
                        : t("explore.short_film_tag", "SHORT FILM")}
                    </Text>
                  </View>
                </Pressable>
              </BehaviorImpression>
            );
          })}
        </View>
      ) : hasQuery ? (
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
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setIsGenreModalOpen(false)}
        transparent
        visible={isGenreModalOpen}
      >
        <Pressable
          accessibilityLabel="Close genre filter sheet"
          onPress={() => setIsGenreModalOpen(false)}
          style={styles.modalBackdrop}
        >
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Genre</Text>
              <Pressable
                accessibilityLabel="Close modal"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsGenreModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>{"\u00D7"}</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Pressable
                accessibilityLabel="Select All Genres"
                accessibilityRole="button"
                onPress={() => {
                  setSelectedGenre(ALL_GENRES_FILTER);
                  setIsGenreModalOpen(false);
                }}
                style={[
                  styles.modalItem,
                  selectedGenre === ALL_GENRES_FILTER && styles.modalItemSelected,
                ]}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    selectedGenre === ALL_GENRES_FILTER && styles.modalItemTextSelected,
                  ]}
                >
                  All Genres
                </Text>
              </Pressable>
              {availableGenres.map((genre) => {
                const isSelected = genre.id === selectedGenre;
                return (
                  <Pressable
                    key={genre.id}
                    accessibilityLabel={`Select genre ${genre.displayName}`}
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedGenre(genre.id);
                      setIsGenreModalOpen(false);
                    }}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        isSelected && styles.modalItemTextSelected,
                      ]}
                    >
                      {genre.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    color: colors.text,
    ...typography.h2,
    marginBottom: 4,
  },
  searchRow: {
    alignItems: "center",
    backgroundColor: "rgba(232, 228, 218, 0.04)",
    borderColor: "rgba(232, 228, 218, 0.12)",
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    minHeight: 46,
    paddingHorizontal: 12,
  },
  searchIcon: {
    color: colors.muted,
    fontSize: 16,
    marginRight: 8,
    transform: [{ rotate: "45deg" }],
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  clearButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 32,
  },
  clearCircle: {
    backgroundColor: "rgba(232, 228, 218, 0.15)",
    borderRadius: 999,
    height: 20,
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "bold",
    marginTop: -1,
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
    paddingVertical: 6,
  },
  filterChip: {
    backgroundColor: "rgba(232, 228, 218, 0.04)",
    borderColor: "rgba(232, 228, 218, 0.12)",
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  filterChipSelected: {
    backgroundColor: "rgba(13, 209, 188, 0.12)",
    borderColor: colors.accent,
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextSelected: {
    color: colors.accent,
  },
  secondaryFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  genreSelectButton: {
    backgroundColor: "rgba(232, 228, 218, 0.04)",
    borderColor: "rgba(232, 228, 218, 0.12)",
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  genreSelectButtonActive: {
    backgroundColor: "rgba(13, 209, 188, 0.12)",
    borderColor: colors.accent,
  },
  genreSelectButtonText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  genreSelectButtonTextActive: {
    color: colors.accent,
  },
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  resetButtonText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.h3,
  },
  sectionCountText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
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
    borderRadius: 8,
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
    ...typography.h3,
    textAlign: "center",
  },
  cardInfo: {
    gap: 4,
  },
  cardTitle: {
    color: colors.text,
    ...typography.homeCardTitle,
    minHeight: 36,
  },
  cardMeta: {
    color: colors.muted,
    ...typography.micro,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  emptyState: {
    gap: 10,
    paddingTop: 12,
    width: "100%",
  },
  emptyTitle: {
    color: colors.text,
    ...typography.body,
    fontWeight: "600",
  },
  emptyBody: {
    color: colors.muted,
    ...typography.label,
  },
  clearEmptyButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 0,
    marginTop: 4,
  },
  clearEmptyButtonText: {
    color: colors.accent,
    ...typography.body,
    fontSize: 14,
    fontWeight: "600",
  },
  cardBusy: {
    opacity: 0.7,
  },
  cardPressed: {
    opacity: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#16161A",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.text,
    ...typography.h3,
  },
  modalCloseText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 24,
  },
  modalScroll: {
    maxHeight: 300,
  },
  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(232, 228, 218, 0.08)",
  },
  modalItemSelected: {
    backgroundColor: "rgba(13, 209, 188, 0.12)",
  },
  modalItemText: {
    color: colors.text,
    fontSize: 15,
  },
  modalItemTextSelected: {
    color: colors.accent,
    fontWeight: "600",
  },
  infoButton: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(232, 228, 218, 0.12)",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoButtonText: {
    color: "rgba(232, 228, 218, 0.75)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
});
