import { useEffect, useMemo, useRef, useState } from "react";
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
import { BehaviorImpression } from "../components/BehaviorImpression";
import { DetailInfoButton, LoadingState, RecoveryState } from "../components/ui";
import { useDiscoveryCatalog } from "../lib/useDiscoveryCatalog";
import { resolveMediaUrl } from "../lib/media";
import { perfMark } from "../lib/perf";
import { useAuth } from "../lib/authContext";
import { getSeries, recordRankingDecision } from "../lib/api";
import { emitBehaviorEvidence } from "../lib/behavioralEvents";
import { markCollectionServed } from "../lib/behaviorImpressionModel";
import { isContinueWatchingProgress } from "../lib/playbackCompletion";
import { findStartEpisode } from "../lib/seriesPlayback";
import {
  ALL_GENRES_FILTER,
  filterDiscoverableItems,
  getAvailableGenreOptions,
  toDiscoverableItems,
  type DiscoverableItem,
} from "../lib/discovery";
import {
  createSearchResultContext,
  normalizeSearchQuery,
  searchDiscoverableItems,
} from "../lib/search";
import {
  createSearchRankingDecision,
  recommendationReasonForResult,
  runRankingDecisionEvidenceFailOpen,
} from "../lib/rankingDecisionEvidence";
import type { RootStackScreenProps, ExploreFormat, SearchResultContext } from "../navigation/types";
import type { ApiSeries } from "../types/api";
import { borders, colors, radii, typography } from "../theme/tokens";

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

export function SearchResultsScreen({ navigation, route }: RootStackScreenProps<"SearchResults">) {
  const { query: initialQuery, format: initialFormat = "all", genre } = route.params;
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { width } = useWindowDimensions();
  const resource = useDiscoveryCatalog(session, true);
  const { catalog, shortFilms } = resource;
  const progress = resource.progress;
  const { isLoading, reload: reloadCatalog } = resource;
  const error = resource.error?.title ?? null;
  const [query, setQuery] = useState(initialQuery);
  const [selectedFormat, setSelectedFormat] = useState<ExploreFormat>(initialFormat);
  const [selectedGenre, setSelectedGenre] = useState(
    genre && genre !== ALL_GENRES_FILTER ? genre : ALL_GENRES_FILTER,
  );
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const [viewportSignal, setViewportSignal] = useState(0);
  const servedCollectionsRef = useRef(new Set<string>());
  const submittedDecisionIdsRef = useRef(new Set<string>());

  useEffect(() => {
    perfMark("SEARCH_RESULTS_MOUNT", {
      format: initialFormat,
      has_query: initialQuery.trim().length > 0,
    });
  }, [initialFormat, initialQuery]);

  const discoverableItems = useMemo(
    () => toDiscoverableItems(catalog, shortFilms),
    [catalog, shortFilms],
  );

  const availableGenres = useMemo(() => {
    return getAvailableGenreOptions(discoverableItems, selectedFormat);
  }, [discoverableItems, selectedFormat]);

  const columns = width < NARROW_WIDTH_BREAKPOINT ? 2 : 3;
  const cardWidth =
    (width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (columns - 1)) / columns;
  const normalizedQuery = normalizeSearchQuery(query);

  const searchResults = useMemo(
    () =>
      searchDiscoverableItems(
        discoverableItems,
        normalizedQuery,
        selectedFormat,
        selectedGenre,
      ),
    [discoverableItems, normalizedQuery, selectedFormat, selectedGenre],
  );

  const suggestions = useMemo(() => {
    return filterDiscoverableItems(
      discoverableItems,
      selectedFormat,
      selectedGenre,
    ).slice(0, 3);
  }, [discoverableItems, selectedFormat, selectedGenre]);
  const suggestionCards = suggestions;
  const displayedResults = searchResults.length > 0 ? searchResults : suggestionCards;
  const collectionContext = useMemo(
    () => `search:${normalizedQuery}:${selectedFormat}:${selectedGenre}:${displayedResults.map((entry) => `${entry.contentType}:${entry.item.id ?? entry.item.slug}`).join(",")}`,
    [displayedResults, normalizedQuery, selectedFormat, selectedGenre],
  );
  const rankingDecision = useMemo(
    () => createSearchRankingDecision({
      candidates: discoverableItems,
      displayedResults,
      matchedResults: searchResults,
      normalizedQuery,
      selectedFormat,
      selectedGenre,
    }),
    [discoverableItems, displayedResults, normalizedQuery, searchResults, selectedFormat, selectedGenre],
  );

  useEffect(() => {
    if (isLoading || error || submittedDecisionIdsRef.current.has(rankingDecision.rankingDecisionId)) return;
    submittedDecisionIdsRef.current.add(rankingDecision.rankingDecisionId);
    runRankingDecisionEvidenceFailOpen(recordRankingDecision(accessToken, rankingDecision));
  }, [accessToken, error, isLoading, rankingDecision]);

  useEffect(() => {
    if (isLoading || error) return;
    if (!markCollectionServed(servedCollectionsRef.current, collectionContext)) return;
    for (const [index, entry] of displayedResults.entries()) {
      const recommendationReason = recommendationReasonForResult(rankingDecision, entry) as SearchResultContext["recommendationReason"];
      const context = createSearchResultContext(entry, query, index, rankingDecision.rankingDecisionId, recommendationReason);
      emitBehaviorEvidence(accessToken, {
        eventType: "content_served",
        contentId: context.contentId,
        contentType: context.contentType,
        sourceSurface: "search",
        position: context.searchResultPosition,
        searchQueryContext: context.searchQueryContext,
        searchResultPosition: context.searchResultPosition,
        rankingDecisionId: context.rankingDecisionId,
        recommendationReason: context.recommendationReason,
      });
    }
  }, [accessToken, collectionContext, displayedResults, error, isLoading, query, rankingDecision]);

  const shouldShowGenreFilter = availableGenres.length > 0;

  async function openSeriesPlayback(series: ApiSeries, searchContext: SearchResultContext) {
    const key = `series-${series.slug}`;

    if (resolvingKey) {
      return;
    }

    perfMark("CONTENT_TAP", {
      content_type: "series_episode",
      series_slug: series.slug,
      source: "SEARCH_RESULTS",
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
        void getSeries(series.slug, accessToken).catch(() => undefined);
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

  function renderResultCard(
    entry: DiscoverableItem,
    index: number,
  ) {
    const item = entry.item;
    const isSeries = entry.contentType === "MICRO_DRAMA";
    const title = item.title;
    const key = isSeries ? `series-${item.slug}` : `short-${item.slug}`;
    const isBusy = resolvingKey === key;
    const recommendationReason = recommendationReasonForResult(rankingDecision, entry) as SearchResultContext["recommendationReason"];
    const attribution = createSearchResultContext(entry, query, index, rankingDecision.rankingDecisionId, recommendationReason);

    return (
      <BehaviorImpression
        key={`${key}-${index}`}
        accessToken={accessToken}
        collectionContext={collectionContext}
        evidence={{
          contentId: attribution.contentId,
          contentType: entry.contentType,
          sourceSurface: "search",
          position: index + 1,
          searchQueryContext: query,
          searchResultPosition: index + 1,
          rankingDecisionId: attribution.rankingDecisionId,
          recommendationReason: attribution.recommendationReason,
        }}
        scrollSignal={viewportSignal}
        style={{ width: cardWidth }}
      >
        <Pressable
          accessibilityLabel={`Watch ${title}`}
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() => {
            const searchContext = createSearchResultContext(entry, query, index, rankingDecision.rankingDecisionId, recommendationReason);
            emitBehaviorEvidence(accessToken, {
              eventType: "content_open",
              contentId: searchContext.contentId,
              contentType: searchContext.contentType,
              sourceSurface: "search",
              position: searchContext.searchResultPosition,
              searchQueryContext: searchContext.searchQueryContext,
              searchResultPosition: searchContext.searchResultPosition,
              rankingDecisionId: searchContext.rankingDecisionId,
              recommendationReason: searchContext.recommendationReason,
            });

            if (isSeries) {
              perfMark("CONTENT_TAP", {
                content_type: "series",
                series_slug: item.slug,
                source: "SEARCH_RESULTS",
              });
              const series = catalog.find((candidate) => candidate.slug === item.slug);
              if (series) {
                void openSeriesPlayback(series, searchContext);
              } else {
                navigation.navigate("Series", { searchContext, slug: item.slug });
              }
              return;
            }

            perfMark("CONTENT_TAP", {
              content_type: "short_film",
              short_film_slug: item.slug,
              source: "SEARCH_RESULTS",
            });
            navigation.navigate("ShortFilmPlayback", { searchContext, slug: item.slug });
          }}
          style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.cardPressed]}
        >
          <View style={[styles.posterWrap, { width: cardWidth, height: cardWidth * (16 / 9) }]}>
            {hasValidPoster(item.poster) ? (
              <Image
                accessible
                accessibilityLabel={`${title} poster`}
                alt=""
                source={{ uri: resolveMediaUrl(item.poster)! }}
                style={styles.posterImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.posterFallback}>
                <Text style={styles.posterTitle} numberOfLines={2}>
                  {title}
                </Text>
              </View>
            )}
            <DetailInfoButton
              accessibilityLabel={`More information about ${title}`}
              onPress={() => {
                const searchContext = createSearchResultContext(entry, query, index, rankingDecision.rankingDecisionId, recommendationReason);
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
              {title}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {isSeries ? "MICRO DRAMA" : "SHORT FILM"}
            </Text>
          </View>
        </Pressable>
      </BehaviorImpression>
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
    <Screen onScroll={() => setViewportSignal((value) => value + 1)}>
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
          <Text style={styles.searchIcon}>{"\u26B2"}</Text>
          <TextInput
            accessibilityLabel="Search results"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={() => Keyboard.dismiss()}
            placeholder="Search 0nya"
            placeholderTextColor={colors.textSecondary}
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
                  setSelectedGenre(ALL_GENRES_FILTER);
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
            <Pressable
              accessibilityLabel="Filter by All Genres"
              accessibilityRole="button"
              onPress={() => setSelectedGenre(ALL_GENRES_FILTER)}
              style={[
                styles.filterChip,
                selectedGenre === ALL_GENRES_FILTER && styles.filterChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedGenre === ALL_GENRES_FILTER && styles.filterChipTextSelected,
                ]}
              >
                All Genres
              </Text>
            </Pressable>
            {availableGenres.map((genreOption) => {
              const isSelected = genreOption.id === selectedGenre;

              return (
                <Pressable
                  key={genreOption.id}
                  accessibilityLabel={`Filter by ${genreOption.displayName}`}
                  accessibilityRole="button"
                  onPress={() => setSelectedGenre(genreOption.id)}
                  style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                    {genreOption.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {searchResults.length > 0 ? (
      <>
        <Text style={styles.sectionTitle}>{`Results for "${query.trim() || initialQuery}"`}</Text>
        <View style={styles.grid}>
          {searchResults.map((entry, index) => renderResultCard(entry, index))}
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
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  headerArrow: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 22,
  },
  headerTitle: {
    color: colors.text,
    ...typography.body,
    fontWeight: "600",
  },
  searchRow: {
    alignItems: "center",
    backgroundColor: "rgba(232, 228, 218, 0.04)",
    borderColor: "rgba(232, 228, 218, 0.12)",
    borderWidth: 1,
    borderRadius: radii.sm,
    flexDirection: "row",
    height: 42,
    paddingHorizontal: 12,
  },
  searchIcon: {
    color: colors.textSecondary,
    fontSize: 15,
    marginRight: 8,
    transform: [{ rotate: "45deg" }],
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    height: 42,
    paddingVertical: 0,
  },
  clearButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 28,
  },
  clearCircle: {
    alignItems: "center",
    backgroundColor: "rgba(232, 228, 218, 0.15)",
    borderRadius: radii.pill,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  clearButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    marginTop: -1,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 0,
  },
  filterChip: {
    backgroundColor: "rgba(232, 228, 218, 0.04)",
    borderColor: "rgba(232, 228, 218, 0.12)",
    borderWidth: 1,
    borderRadius: radii.sm,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipSelected: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.accent,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  filterChipTextSelected: {
    color: colors.accent,
    fontWeight: "600",
  },
  sectionTitle: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },
  sectionLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  card: {
    gap: 4,
  },
  cardPressed: {
    opacity: 0.85,
  },
  posterWrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.poster,
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
    ...typography.h3,
    textAlign: "center",
  },
  cardInfo: {
    gap: 2,
    marginTop: 2,
  },
  cardTitle: {
    color: colors.text,
    ...typography.homeCardTitle,
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    minHeight: 36,
  },
  cardMeta: {
    color: colors.textSecondary,
    ...typography.micro,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  emptyState: {
    gap: 8,
    paddingTop: 8,
  },
  emptyTitle: {
    color: colors.text,
    ...typography.body,
    fontWeight: "600",
  },
  emptyBody: {
    color: colors.textSecondary,
    ...typography.label,
  },
  clearSearchLink: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  linkPressed: {
    opacity: 0.8,
  },
  clearSearchText: {
    color: colors.accent,
    ...typography.label,
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
