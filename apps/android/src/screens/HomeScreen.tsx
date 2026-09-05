import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { Screen } from "../components/Screen";
import { BehaviorImpression } from "../components/BehaviorImpression";
import { Button, RecoveryState } from "../components/ui";
import {
  ApiError,
  authorizePlayback,
  getSeries,
  recordRankingDecision,
} from "../lib/api";
import { resolveMediaUrl } from "../lib/media";
import { useDiscoveryCatalog } from "../lib/useDiscoveryCatalog";
import {
  CONTINUE_WATCHING_MIN_SECONDS,
  isContinueWatchingProgress,
  isPlaybackCompleted,
} from "../lib/playbackCompletion";
import { createScreenRequestOwner } from "../lib/screenResources";
import { getPlaybackAuthorizationCredentials } from "../lib/parentalControls";
import { perfMark } from "../lib/perf";
import { useAuth } from "../lib/authContext";
import { emitBehaviorEvidence } from "../lib/behavioralEvents";
import { markCollectionServed } from "../lib/behaviorImpressionModel";
import {
  createContinueWatchingRankingDecision,
  runRankingDecisionEvidenceFailOpen,
} from "../lib/rankingDecisionEvidence";
import { findStartEpisode } from "../lib/seriesPlayback";
import { useAppLanguage } from "../lib/appLanguage";
import type { DiscoveryContext, MainTabScreenProps } from "../navigation/types";
import type {
  ApiSeries,
  ApiShortFilm,
  HomeSpotlight,
  PlaybackAuthorizationResponse,
  WatchProgressItem,
} from "../types/api";
import { colors, radii, surfaces, typography } from "../theme/tokens";

type Props = MainTabScreenProps<"Home">;

// Product default per Product Bible §6 (Continue Watching entry rule:
// "watched >= 5 seconds"). The current watch-progress API does not expose a
// backend/CMS-configurable threshold, so this is isolated as the single
// temporary product-default constant rather than a magic number inline.
const HOME_POSTER_MIN_WIDTH = 120;
const HOME_POSTER_MAX_WIDTH = 160;
// Continue Watching: compact enough to show the edge of the next card on screen.
// 150–200dp shows ~1.4 cards on a 360dp device, making horizontal scroll obvious.
const HOME_RESUME_MIN_WIDTH = 150;
const HOME_RESUME_MAX_WIDTH = 200;
// Spotlight rail geometry. MUST stay in sync with styles.spotlightRail below:
// paddingLeft 16 mirrors the Screen horizontal padding and gap 12 is the
// inter-poster spacing. The snap offsets and the active-index derivation both
// use this single geometry so snapping and indexing share one coordinate
// system instead of duplicating the stride in two places.
const SPOTLIGHT_RAIL_LEFT_INSET = 16;
const SPOTLIGHT_RAIL_GAP = 12;

const BRAND_LOGO_IMAGE = require("../../assets/brand/0nya-trans-400.png");

type ContinueWatchingEntry = WatchProgressItem & {
  series?: ApiSeries;
  shortFilm?: ApiShortFilm;
};

function hasValidPoster(poster?: string) {
  return typeof poster === "string" && poster.trim().length > 0;
}

// Active-spotlight index for a settled rail offset: the nearest member of the
// snap-offset array. Card k rests at content x = leftInset + k*stride, so the
// offset k*stride puts it exactly on the rail's left inset; the constant
// paddingLeft shifts every card equally and cancels from the math. Deriving
// the index from the same array used for snapToOffsets guarantees the settled
// offset is always an exact snap target (no interval re-derivation drift).
function getNearestSpotlightIndex(offsetX: number, snapOffsets: number[]) {
  let nearestIndex = 0;
  for (let index = 1; index < snapOffsets.length; index += 1) {
    if (
      Math.abs(snapOffsets[index] - offsetX) <
      Math.abs(snapOffsets[nearestIndex] - offsetX)
    ) {
      nearestIndex = index;
    }
  }
  return nearestIndex;
}

function isQualifyingProgress(item: WatchProgressItem) {
  return isContinueWatchingProgress(item);
}

function summarizeContinueWatchingCandidate(
  item: WatchProgressItem,
  catalog: ApiSeries[],
  shortFilms: ApiShortFilm[],
) {
  const catalogMatch =
    item.contentType === "short_film"
      ? shortFilms.some((candidate) => candidate.slug === item.shortFilmSlug)
      : catalog.some((candidate) => {
          if (candidate.slug !== item.seriesSlug) {
            return false;
          }

          return candidate.episodes.some((episode) => episode.number === item.episodeNumber);
        });

  return {
    completed: item.completed,
    contentType: item.contentType,
    catalogMatch,
    durationSeconds: item.durationSeconds,
    episodeNumber: item.episodeNumber,
    exclusionReason: isPlaybackCompleted(item)
      ? "completed"
      : item.positionSeconds < CONTINUE_WATCHING_MIN_SECONDS
        ? "below_threshold"
        : !catalogMatch
          ? "catalog_miss"
          : "included",
    positionSeconds: item.positionSeconds,
    qualifying: isQualifyingProgress(item),
    seriesSlug: item.seriesSlug,
    shortFilmSlug: item.shortFilmSlug,
    updatedAt: item.lastWatchedAt,
  };
}

function getContinueWatchingMeta(entry: ContinueWatchingEntry) {
  if (entry.contentType === "short_film") {
    return "Short Film · Resume";
  }

  return entry.episodeNumber !== null ? `Episode ${entry.episodeNumber} · Resume` : "Resume";
}

function buildContinueWatchingPlaybackRequest(entry: ContinueWatchingEntry) {
  if (entry.contentType === "short_film") {
    return {
      slug: entry.shortFilmSlug ?? "",
      targetType: "SHORT_FILM" as const,
    };
  }

  return {
    episodeNumber: entry.episodeNumber ?? 0,
    seriesSlug: entry.seriesSlug ?? "",
    targetType: "SERIES_EPISODE" as const,
  };
}

function buildContinueWatchingPlaybackTitle(entry: ContinueWatchingEntry) {
  return entry.contentType === "short_film"
    ? entry.shortFilm?.title ?? "Short Film"
    : entry.series?.title ?? "Episode";
}

function getContinueWatchingKey(entry: ContinueWatchingEntry) {
  const resumeToken = Number.isFinite(entry.positionSeconds) ? `${entry.positionSeconds}` : "0";
  const updatedAtToken = entry.lastWatchedAt;

  return entry.contentType === "short_film"
    ? `short-${entry.shortFilmSlug}-${resumeToken}-${updatedAtToken}`
    : `series-${entry.seriesSlug}-${entry.episodeNumber}-${resumeToken}-${updatedAtToken}`;
}

function getHomeRowRecommendationReason(row: { role: string; title: string }) {
  if (row.title === "New Releases") return "NEW_RELEASE" as const;
  if (row.role === "category") return "FORMAT_FILTER" as const;
  return "EDITORIAL" as const;
}

type ContinueWatchingMediaCacheEntry =
  | {
      expiresAt: string;
      stillUrl: string | null;
      status: "ok";
    }
  | {
      expiresAt: null;
      stillUrl: null;
      status: Exclude<PlaybackAuthorizationResponse["status"], "ok">;
    };

function useContinueWatchingMedia(
  entry: ContinueWatchingEntry,
  readMedia: (mediaKey: string) => ContinueWatchingMediaCacheEntry | null,
  resolveMedia: (entry: ContinueWatchingEntry) => Promise<ContinueWatchingMediaCacheEntry | null>,
) {
  const mediaKey = getContinueWatchingKey(entry);
  const [state, setState] = useState<ContinueWatchingMediaCacheEntry | null>(() => readMedia(mediaKey));

  useEffect(() => {
    let cancelled = false;

    void resolveMedia(entry).then((resolved) => {
      if (cancelled || !resolved) {
        return;
      }

      setState(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [entry, resolveMedia]);

  return state;
}

function CinematicPressable({
  children,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityValue,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: "button";
  accessibilityValue?: {
    max?: number;
    min?: number;
    now?: number;
    text?: string;
  };
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityValue={accessibilityValue}
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      {children}
    </Pressable>
  );
}

function HomeWalletIcon({ color }: { color: string }) {
  return (
    <View style={[styles.walletIconOutline, { borderColor: color }]}>
      <View style={[styles.walletIconCard, { backgroundColor: color }]} />
    </View>
  );
}

function ContinueWatchingProgressBar({
  durationSeconds,
  positionSeconds,
}: {
  durationSeconds: number;
  positionSeconds: number;
}) {
  const targetPercent = Math.min(
    100,
    Math.max(0, durationSeconds > 0 ? (positionSeconds / durationSeconds) * 100 : 0),
  );

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${targetPercent}%` }]} />
    </View>
  );
}

function ContinueWatchingCard({
  entry,
  readMedia,
  resolveMedia,
  onPress,
  width,
  height,
}: {
  entry: ContinueWatchingEntry;
  readMedia: (mediaKey: string) => ContinueWatchingMediaCacheEntry | null;
  resolveMedia: (entry: ContinueWatchingEntry) => Promise<ContinueWatchingMediaCacheEntry | null>;
  onPress: () => void;
  width: number;
  height: number;
}) {
  const media = useContinueWatchingMedia(entry, readMedia, resolveMedia);
  const title = buildContinueWatchingPlaybackTitle(entry);
  const metaText = getContinueWatchingMeta(entry);
  const stillUrl = media?.status === "ok" ? media.stillUrl : null;

  const accessibilityLabel =
    entry.contentType === "short_film"
      ? `Resume ${title}`
      : `Resume ${title}, episode ${entry.episodeNumber ?? 0}`;

  return (
    <CinematicPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityValue={{
        max: 100,
        min: 0,
        now: Math.round(
          entry.durationSeconds > 0
            ? Math.min(100, Math.max(0, (entry.positionSeconds / entry.durationSeconds) * 100))
            : 0,
        ),
      }}
      onPress={onPress}
    >
      <View style={[styles.coverWrap, { width, height }]}>
        {stillUrl ? (
          <Image
            accessibilityLabel={`${title} still`}
            accessible
            alt=""
            fadeDuration={180}
            source={{ uri: resolveMediaUrl(stillUrl)! }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.previewFallback} />
        )}
        <View style={styles.progressOverlay}>
          <ContinueWatchingProgressBar
            durationSeconds={entry.durationSeconds}
            positionSeconds={entry.positionSeconds}
          />
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.metaText} numberOfLines={1}>
          {metaText}
        </Text>
      </View>
    </CinematicPressable>
  );
}

function SpotlightPosterItem({
  spotlight,
  spotlightWidth,
  spotlightHeight,
  onTap,
}: {
  spotlight: HomeSpotlight;
  spotlightWidth: number;
  spotlightHeight: number;
  onTap: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open details for ${spotlight.title}`}
      accessibilityRole="button"
      onPress={onTap}
      style={({ pressed }) => [
        styles.spotlightPosterCard,
        { width: spotlightWidth, height: spotlightHeight },
        pressed && styles.spotlightPosterPressed,
      ]}
    >
      {hasValidPoster(spotlight.poster ?? undefined) ? (
        <Image
          accessibilityLabel={`${spotlight.title} spotlight poster`}
          accessible
          alt=""
          fadeDuration={180}
          source={{ uri: resolveMediaUrl(spotlight.poster)! }}
          style={styles.spotlightImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.coverFallback}>
          <Text style={styles.coverTitle} numberOfLines={2}>
            {spotlight.title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}


function ContinueWatchingSeparator() {
  return <View style={styles.continueWatchingSeparator} />;
}

function LoadingCard({
  height,
  width,
}: {
  height: number;
  width: number;
}) {
  return <View style={[styles.loadingCard, { height, width }]} />;
}

function HomeLoadingState({
  spotlightHeight,
  spotlightWidth,
  posterCardHeight,
  posterCardWidth,
  resumeCardHeight,
  resumeCardWidth,
}: {
  spotlightHeight: number;
  spotlightWidth: number;
  posterCardHeight: number;
  posterCardWidth: number;
  resumeCardHeight: number;
  resumeCardWidth: number;
}) {
  return (
    <>
      {/* Brand mark skeleton */}
      <View style={styles.headerRow}>
        <View style={styles.brandSkeleton} />
      </View>

      {/* Spotlight skeleton */}
      <View style={styles.spotlightSection}>
        <View style={styles.spotlightSectionLabelSkeleton} />
        <View style={[styles.spotlightSkeleton, { width: spotlightWidth, height: spotlightHeight }]} />
        <View style={styles.spotlightActiveFooter}>
          <View style={styles.spotlightCtaSkeleton} />
        </View>
      </View>

      {/* Continue Watching row skeleton */}
      <View style={styles.section}>
        <View style={styles.sectionTitleSkeleton} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          <LoadingCard height={resumeCardHeight} width={resumeCardWidth} />
          <LoadingCard height={resumeCardHeight} width={resumeCardWidth} />
        </ScrollView>
      </View>

      {/* Discovery row skeleton #1 */}
      <View style={styles.section}>
        <View style={styles.sectionTitleSkeleton} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
        </ScrollView>
      </View>

      {/* Discovery row skeleton #2 */}
      <View style={styles.section}>
        <View style={styles.sectionTitleSkeleton} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
        </ScrollView>
      </View>
    </>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { t } = useAppLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const accessToken = session?.access_token;
  const showWalletAffordance = Boolean(session?.user?.id);
  const resource = useDiscoveryCatalog(session, true);
  const { catalog, shortFilms } = resource;
  const progress = resource.progress;
  const { isLoading, error, hasHydrated, reload: reloadHome } = resource;
  const homeState = resource.data?.home ?? null;
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  // Tracks whether the first catalog/home fetch has conclusively resolved
  // (success or failure). Virgin structural headings must never render from
  // the transient unhydrated [] default state — only once this is true AND
  // the resolved catalog is genuinely empty.
  const usableWidth = Math.max(0, windowWidth - 32);
  const spotlightWidth = Math.round(Math.min(260, Math.max(220, usableWidth * 0.67)));
  const spotlightHeight = Math.round(spotlightWidth / (9 / 16));
  const [activeSpotlightIndex, setActiveSpotlightIndex] = useState(0);
  const [viewportSignal, setViewportSignal] = useState(0);
  const servedCollectionsRef = useRef(new Set<string>());
  const submittedDecisionIdsRef = useRef(new Set<string>());
  const discoveryPosterWidth = Math.round(
    Math.min(HOME_POSTER_MAX_WIDTH, Math.max(HOME_POSTER_MIN_WIDTH, (usableWidth - 12) / 2.5)),
  );
  const discoveryPosterHeight = Math.round(discoveryPosterWidth / (9 / 16));
  const resumeCardWidth = Math.round(
    Math.min(HOME_RESUME_MAX_WIDTH, Math.max(HOME_RESUME_MIN_WIDTH, usableWidth / 1.85)),
  );
  const resumeCardHeight = Math.round(resumeCardWidth / (9 / 16));
  const mediaScope = useMemo(() => ({
    owner: createScreenRequestOwner({ accessToken, userId: session?.user.id }),
    cache: new Map<string, ContinueWatchingMediaCacheEntry>(),
    inFlight: new Map<string, Promise<ContinueWatchingMediaCacheEntry | null>>(),
  }), [accessToken, session?.user.id]);
  useFocusEffect(useCallback(() => () => {
    mediaScope.owner.invalidate();
    mediaScope.inFlight.clear();
  }, [mediaScope]));
  // Content that the playback authorization endpoint has proven is no longer
  // consumer-visible (e.g. an episode reverted to draft after a stale history
  // record was created). These keys are pulled from the rendered shelf below
  // instead of being shown with a dark fallback still, since the CONTENT
  // itself — not just its still image — no longer resolves.
  const [unresolvableContinueWatchingKeys, setUnresolvableContinueWatchingKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());

  useEffect(() => {
    perfMark("HOME_MOUNT");
  }, []);

  const markContinueWatchingUnresolvable = useCallback((mediaKey: string) => {
    setUnresolvableContinueWatchingKeys((previous) => {
      if (previous.has(mediaKey)) {
        return previous;
      }

      const next = new Set(previous);
      next.add(mediaKey);
      return next;
    });
  }, []);

  useEffect(() => {
    mediaScope.cache.clear();
    mediaScope.inFlight.clear();
    const timeoutId = setTimeout(() => {
      setUnresolvableContinueWatchingKeys(new Set());
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [mediaScope]);

  const readContinueWatchingMedia = useCallback(
    (mediaKey: string) => {
      const cached = mediaScope.cache.get(mediaKey);

      if (!cached) {
        return null;
      }

      if (cached.status === "ok" && Date.parse(cached.expiresAt) <= Date.now()) {
        mediaScope.cache.delete(mediaKey);
        return null;
      }

      return cached;
    },
    [mediaScope],
  );

  const resolveContinueWatchingMedia = useCallback(
    async (entry: ContinueWatchingEntry) => {
      const mediaKey = getContinueWatchingKey(entry);
      const cached = readContinueWatchingMedia(mediaKey);

      if (cached) {
        return cached;
      }

      const inFlight = mediaScope.inFlight.get(mediaKey);

      if (inFlight) {
        return inFlight;
      }

      const isCurrent = mediaScope.owner.capture();
      const request = (async () => {
        const auth = await getPlaybackAuthorizationCredentials(session);
        const response = await authorizePlayback(session?.access_token ?? null, {
          ...buildContinueWatchingPlaybackRequest(entry),
          guestCredential: auth.guestCredential ?? null,
          parentalSessionToken: auth.parentalSessionToken ?? null,
          stillAtSeconds: entry.positionSeconds,
        });

        if (!isCurrent()) return null;

        if (response.status === "ok") {
          const record: ContinueWatchingMediaCacheEntry = {
            expiresAt: response.expiresAt,
            stillUrl: response.stillUrl ?? null,
            status: "ok",
          };

          mediaScope.cache.set(mediaKey, record);
          return record;
        }

        if (response.status === "not_found") {
          // The content itself no longer resolves (e.g. reverted to draft or
          // removed) — this is an expected stale-history condition, not a
          // still/media-only gap, so the card is dropped from the shelf below.
          markContinueWatchingUnresolvable(mediaKey);
        }

        const record: ContinueWatchingMediaCacheEntry = {
          expiresAt: null,
          stillUrl: null,
          status: response.status,
        };

        mediaScope.cache.set(mediaKey, record);
        return record;
      })().catch((error) => {
        if (!isCurrent()) return null;
        const isExpectedContentNotFound =
          error instanceof ApiError && error.status === 404 && error.code === "not_found";

        if (isExpectedContentNotFound) {
          // Stale Continue Watching entries pointing at unpublished/removed
          // content are expected, not an application error — log at info
          // level (dev only) instead of spamming error logs, and drop the
          // card instead of showing it with a dark fallback still.
          if (__DEV__) {
            console.info("[0nya HOME continue-watching media] stale entry not found", {
              mediaKey,
            });
          }

          markContinueWatchingUnresolvable(mediaKey);

          const record: ContinueWatchingMediaCacheEntry = {
            expiresAt: null,
            stillUrl: null,
            status: "not_found",
          };

          mediaScope.cache.set(mediaKey, record);
          return record;
        }

        console.error(
          "[0nya HOME continue-watching media]",
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error.stack : undefined,
        );

        const record: ContinueWatchingMediaCacheEntry = {
          expiresAt: null,
          stillUrl: null,
          status: "playback_unavailable",
        };

        mediaScope.cache.set(mediaKey, record);
        return record;
      });

      mediaScope.inFlight.set(mediaKey, request);

      return request.finally(() => {
        if (mediaScope.inFlight.get(mediaKey) === request) mediaScope.inFlight.delete(mediaKey);
      });
    },
    [markContinueWatchingUnresolvable, mediaScope, readContinueWatchingMedia, session],
  );

  // Collapse multiple qualifying episode rows into one resume target per series,
  // while keeping each short film as its own entry.
  const continueWatching = useMemo<ContinueWatchingEntry[]>(() => {
    const seenSeries = new Set<string>();
    const entries = progress
      .filter(isQualifyingProgress)
      .sort(
        (first, second) =>
          new Date(second.lastWatchedAt).getTime() - new Date(first.lastWatchedAt).getTime(),
      )
      .reduce<ContinueWatchingEntry[]>((selected, item) => {
        if (item.contentType === "short_film") {
          const shortFilm = shortFilms.find((candidate) => candidate.slug === item.shortFilmSlug);

          if (shortFilm) {
            selected.push({ ...item, shortFilm });
          }

          return selected;
        }

        if (!item.seriesSlug || seenSeries.has(item.seriesSlug)) {
          return selected;
        }

        const series = catalog.find((candidate) => candidate.slug === item.seriesSlug);
        const episode = series?.episodes.find((candidate) => candidate.number === item.episodeNumber);

        if (series && episode) {
          seenSeries.add(item.seriesSlug);
          selected.push({ ...item, series });
        }

        return selected;
      }, []);

    if (__DEV__) {
      console.info("[0nya HOME continue-watching audit]", {
        visibleCount: entries.length,
        sample: progress.map((item) => summarizeContinueWatchingCandidate(item, catalog, shortFilms)),
      });
    }

    return entries;
  }, [catalog, progress, shortFilms]);

  // Cards whose playback authorization proved the underlying content no
  // longer resolves (draft/removed) are excluded from the rendered shelf.
  // This never mutates watch history — it only affects what Home renders.
  const visibleContinueWatching = useMemo(
    () =>
      continueWatching.filter(
        (entry) => !unresolvableContinueWatchingKeys.has(getContinueWatchingKey(entry)),
      ),
    [continueWatching, unresolvableContinueWatchingKeys],
  );
  // Multi-spotlight: prefer homeState.spotlights (array), fall back to wrapping homeState.spotlight
  // for backward compatibility. Zero catalog fallback — no fake cards.
  const spotlights: HomeSpotlight[] = useMemo(() => {
    if (homeState?.spotlights && homeState.spotlights.length > 0) {
      return homeState.spotlights;
    }
    if (homeState?.spotlight) {
      return [homeState.spotlight];
    }
    return [];
  }, [homeState]);

  // Active spotlight (derived from activeSpotlightIndex, clamped to array bounds)
  const activeSpotlight = spotlights[Math.min(activeSpotlightIndex, Math.max(0, spotlights.length - 1))] ?? null;
  const spotlightRowId = homeState?.spotlightRowId ?? null;
  const visibleHomeRows = useMemo(
    () => homeState?.rows.filter((row) => row.enabled && row.items.length > 0 && row.role !== "spotlight") ?? [],
    [homeState],
  );
  const homeCollectionContext = useMemo(
    () => `home:${homeState?.spotlightRankingDecisionId ?? "none"}:${spotlights.map((item) => item.id).join(",")}:${visibleContinueWatching.map(getContinueWatchingKey).join(",")}:${visibleHomeRows.map((row) => `${row.id}:${row.rankingDecisionId}:${row.items.map((item) => item.id).join(",")}`).join("|")}`,
    [homeState?.spotlightRankingDecisionId, spotlights, visibleContinueWatching, visibleHomeRows],
  );
  const continueWatchingDecision = useMemo(
    () => createContinueWatchingRankingDecision(
      visibleContinueWatching.map((item) => ({
        contentId: getContinueWatchingKey(item),
        contentType: item.contentType === "series_episode" ? "SERIES_EPISODE" as const : "SHORT_FILM" as const,
      })),
    ),
    [visibleContinueWatching],
  );

  useEffect(() => {
    if (isLoading || error || submittedDecisionIdsRef.current.has(continueWatchingDecision.rankingDecisionId)) return;
    submittedDecisionIdsRef.current.add(continueWatchingDecision.rankingDecisionId);
    runRankingDecisionEvidenceFailOpen(recordRankingDecision(accessToken, continueWatchingDecision));
  }, [accessToken, continueWatchingDecision, error, isLoading]);

  useEffect(() => {
    if (isLoading || error) return;
    if (!markCollectionServed(servedCollectionsRef.current, homeCollectionContext)) return;
    spotlights.forEach((item, index) => emitBehaviorEvidence(accessToken, {
      eventType: "content_served", contentId: item.id,
      contentType: item.contentType === "series" ? "MICRO_DRAMA" : "SHORT_FILM",
      sourceSurface: "home", rowId: spotlightRowId, position: index + 1,
      rankingDecisionId: homeState?.spotlightRankingDecisionId ?? null,
      recommendationReason: "EDITORIAL",
    }));
    visibleHomeRows.forEach((row) => row.items.forEach((item, index) => emitBehaviorEvidence(accessToken, {
      eventType: "content_served", contentId: item.id,
      contentType: item.contentType === "series" ? "MICRO_DRAMA" : "SHORT_FILM",
      sourceSurface: "home", rowId: row.id, position: index + 1,
      rankingDecisionId: row.rankingDecisionId,
      recommendationReason: getHomeRowRecommendationReason(row),
    })));
    visibleContinueWatching.forEach((item, index) => emitBehaviorEvidence(accessToken, {
      eventType: "content_served", contentId: getContinueWatchingKey(item),
      contentType: item.contentType === "series_episode" ? "SERIES_EPISODE" : "SHORT_FILM",
      sourceSurface: "continue_watching", rowId: null, position: index + 1,
      rankingDecisionId: continueWatchingDecision.rankingDecisionId,
      recommendationReason: "CONTINUE_WATCHING",
    }));
  }, [accessToken, continueWatchingDecision.rankingDecisionId, error, homeCollectionContext, homeState?.spotlightRankingDecisionId, isLoading, spotlightRowId, spotlights, visibleContinueWatching, visibleHomeRows]);

  // Trailing inset for the horizontal poster rail so the last real card
  // can snap to the same left anchor as card 1. The content inset is the
  // remaining viewport width after one card + the left rail inset.
  const spotlightTrailingInset = Math.max(
    0,
    windowWidth - SPOTLIGHT_RAIL_LEFT_INSET - spotlightWidth,
  );
  // One rail step: poster width + gap. snapToOffsets and the active-index
  // helper both consume this array, so snap targets and index math are the
  // same coordinate system by construction. No looping: the array ends at the
  // last poster, and the trailing inset above makes that final offset the
  // natural end-of-rail stop (the rail simply stops after the last poster).
  const spotlightItemStride = spotlightWidth + SPOTLIGHT_RAIL_GAP;
  const spotlightSnapOffsets = useMemo(
    () => spotlights.map((_, index) => index * spotlightItemStride),
    [spotlights, spotlightItemStride],
  );

  const hasEverWatched = progress.length > 0;
  const isVirginCatalog =
    hasHydrated &&
    catalog.length === 0 &&
    shortFilms.length === 0 &&
    (!homeState || homeState.rows.every((r) => r.items.length === 0));

  const VIRGIN_HOME_HEADINGS = [
    "Start Here",
    "Trending Now",
    "New Releases",
    "Micro Dramas",
    "Vertical Short Films",
    "Staff Picks",
  ] as const;

  async function openSpotlight(target: HomeSpotlight) {
    const key = `spotlight-${target.contentType}-${target.slug}`;

    if (resolvingKey) {
      return;
    }

    perfMark("CONTENT_TAP", {
      content_type: target.contentType,
      source: "HOME_SPOTLIGHT",
    });
    setResolvingKey(key);
    const position = spotlights.findIndex((item) => item.id === target.id) + 1;
    const searchContext: DiscoveryContext = { contentId: target.id, contentSlug: target.slug, contentType: target.contentType === "series" ? "MICRO_DRAMA" : "SHORT_FILM", position, rowId: spotlightRowId, sourceSurface: "home", rankingDecisionId: homeState?.spotlightRankingDecisionId ?? null, recommendationReason: "EDITORIAL" };
    emitBehaviorEvidence(accessToken, { eventType: "content_open", contentId: target.id, contentType: searchContext.contentType, sourceSurface: "home", rowId: spotlightRowId, position, rankingDecisionId: searchContext.rankingDecisionId, recommendationReason: searchContext.recommendationReason });

    if (target.contentType === "short_film") {
      const match = progress.find(
        (item) => item.contentType === "short_film" && item.shortFilmSlug === target.slug,
      );
      const resumePositionSeconds =
        match && isContinueWatchingProgress(match)
          ? match.positionSeconds
          : 0;

      navigation.navigate("ShortFilmPlayback", {
        resumeAtSeconds: resumePositionSeconds,
        slug: target.slug,
        searchContext,
      });
      setResolvingKey(null);
      return;
    }

    const series = catalog.find((candidate) => candidate.slug === target.slug);

    if (series) {
      void openSeriesPlayback(series, searchContext);
    } else {
      navigation.navigate("Series", { searchContext, slug: target.slug });
    }
    setResolvingKey(null);
  }

  function openSpotlightInfo(target: HomeSpotlight) {
    if (resolvingKey) {
      return;
    }

    perfMark("CONTENT_TAP", {
      content_type: target.contentType,
      source: "HOME_SPOTLIGHT_INFO",
    });

    const position = spotlights.findIndex((item) => item.id === target.id) + 1;
    const searchContext: DiscoveryContext = { contentId: target.id, contentSlug: target.slug, contentType: target.contentType === "series" ? "MICRO_DRAMA" : "SHORT_FILM", position, rowId: spotlightRowId, sourceSurface: "home", rankingDecisionId: homeState?.spotlightRankingDecisionId ?? null, recommendationReason: "EDITORIAL" };
    emitBehaviorEvidence(accessToken, { eventType: "content_open", contentId: target.id, contentType: searchContext.contentType, sourceSurface: "home", rowId: spotlightRowId, position, rankingDecisionId: searchContext.rankingDecisionId, recommendationReason: searchContext.recommendationReason });
    if (target.contentType === "short_film") {
      navigation.navigate("ShortFilm", { searchContext, slug: target.slug });
    } else {
      navigation.navigate("Series", { searchContext, slug: target.slug });
    }
  }


  async function openContinueWatching(entry: ContinueWatchingEntry) {
    const key =
      entry.contentType === "short_film"
        ? `short-${entry.shortFilmSlug}`
        : `${entry.seriesSlug}-${entry.episodeNumber}`;

    if (resolvingKey) {
      return;
    }

    perfMark("CONTENT_TAP", {
      content_type: entry.contentType,
      episode_number: entry.episodeNumber,
      source: "HOME_CONTINUE_WATCHING",
    });
    setResolvingKey(key);
    const position = visibleContinueWatching.findIndex((item) => getContinueWatchingKey(item) === getContinueWatchingKey(entry)) + 1;
    const searchContext: DiscoveryContext = {
      contentId: getContinueWatchingKey(entry),
      contentSlug: entry.contentType === "short_film" ? entry.shortFilmSlug ?? "" : entry.seriesSlug ?? "",
      contentType: entry.contentType === "short_film" ? "SHORT_FILM" : "MICRO_DRAMA",
      position, rowId: null, sourceSurface: "continue_watching",
      rankingDecisionId: continueWatchingDecision.rankingDecisionId,
      recommendationReason: "CONTINUE_WATCHING",
    };
    emitBehaviorEvidence(accessToken, { eventType: "content_open", contentId: getContinueWatchingKey(entry), contentType: entry.contentType === "short_film" ? "SHORT_FILM" : "SERIES_EPISODE", sourceSurface: "continue_watching", position, rankingDecisionId: continueWatchingDecision.rankingDecisionId, recommendationReason: "CONTINUE_WATCHING" });

    if (entry.contentType === "short_film") {
      navigation.navigate("ShortFilmPlayback", {
        resumeAtSeconds: entry.positionSeconds,
        slug: entry.shortFilmSlug ?? "",
        searchContext,
      });
      setResolvingKey(null);
      return;
    }

    if (!entry.seriesSlug || typeof entry.episodeNumber !== "number") {
      setResolvingKey(null);
      return;
    }

    void getSeries(entry.seriesSlug, session?.access_token).catch(() => undefined);
    navigation.navigate("Watch", {
      episodeNumber: entry.episodeNumber,
      resumeAtSeconds: entry.positionSeconds,
      seriesSlug: entry.seriesSlug,
      searchContext,
    });
    setResolvingKey(null);
  }

  async function openSeriesPlayback(series: ApiSeries, searchContext?: DiscoveryContext) {
    const key = `series-${series.slug}`;

    if (resolvingKey) {
      return;
    }

    perfMark("CONTENT_TAP", {
      content_type: "series_episode",
      series_slug: series.slug,
      source: "HOME",
    });
    setResolvingKey(key);

    const seriesProgress = progress
      .filter((item) => item.contentType === "series_episode" && item.seriesSlug === series.slug)
      .sort(
        (first, second) =>
          new Date(second.lastWatchedAt).getTime() - new Date(first.lastWatchedAt).getTime(),
      );
    const resumeProgress = seriesProgress.find(isContinueWatchingProgress);
    const resumeEpisode = resumeProgress
      ? series.episodes.find((episode) => episode.number === resumeProgress.episodeNumber)
      : undefined;
    const targetEpisode = resumeEpisode ?? findStartEpisode(series.episodes);

    if (targetEpisode) {
      void getSeries(series.slug, session?.access_token).catch(() => undefined);
      navigation.navigate("Watch", {
        episodeNumber: targetEpisode.number,
        resumeAtSeconds: resumeProgress?.positionSeconds ?? undefined,
        seriesSlug: series.slug,
        searchContext,
      });
      setResolvingKey(null);
      return;
    }

    navigation.navigate("Series", { searchContext, slug: series.slug });
    setResolvingKey(null);
  }

  if (isLoading) {
    return (
      <Screen>
        <HomeLoadingState
          posterCardHeight={discoveryPosterHeight}
          posterCardWidth={discoveryPosterWidth}
          resumeCardHeight={resumeCardHeight}
          resumeCardWidth={resumeCardWidth}
          spotlightHeight={spotlightHeight}
          spotlightWidth={spotlightWidth}
        />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen scroll={false}>
        <RecoveryState
          body={error.body}
          onPrimaryAction={() => void reloadHome()}
          primaryActionLabel="Retry"
          variant="cinematic"
          title={error.title}
        />
      </Screen>
    );
  }

  return (
    <Screen onScroll={() => setViewportSignal((value) => value + 1)}>
      {/* 1. 0nya Header */}
      <View style={styles.headerRow}>
        <Image
          accessibilityLabel="0nya"
          accessible
          alt="0nya"
          resizeMode="contain"
          source={BRAND_LOGO_IMAGE}
          style={styles.brandLogo}
        />
        {showWalletAffordance ? (
          <Pressable
            accessibilityLabel={t("home.wallet", "Wallet")}
            accessibilityRole="button"
            onPress={() => {
              perfMark("WALLET_TAP", { source: "HOME" });
              navigation.navigate("Wallet");
            }}
            style={({ pressed }) => [
              styles.walletAffordance,
              pressed && styles.walletAffordancePressed,
            ]}
          >
            <HomeWalletIcon color={colors.accent} />
          </Pressable>
        ) : null}
      </View>

      {resource.historyStatus === "error" ? (
        <View style={styles.cardInfo}>
          <Text style={styles.metaText}>{"Watch history couldn't refresh."}</Text>
          <Button accessibilityLabel="Retry watch history" onPress={() => void reloadHome()} variant="secondary">Retry history</Button>
        </View>
      ) : null}

      {/* 2. Multi-Spotlight Poster Rail */}
      {spotlights.length > 0 ? (
        <View style={styles.spotlightSection}>
          {/* Section label */}
          <Text style={styles.spotlightSectionLabel}>{t("home.spotlight", "Spotlight")}</Text>

          {/* Horizontal poster rail — posters only, no controls */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToOffsets={spotlightSnapOffsets}
            contentContainerStyle={[
              styles.spotlightRail,
              { paddingRight: spotlightTrailingInset },
            ]}
            style={styles.spotlightRailScroll}
            onMomentumScrollEnd={(event) => {
              setViewportSignal((value) => value + 1);
              const offsetX = event.nativeEvent.contentOffset.x;
              const nearestIndex = getNearestSpotlightIndex(
                offsetX,
                spotlightSnapOffsets,
              );
              setActiveSpotlightIndex(
                Math.max(0, Math.min(nearestIndex, spotlights.length - 1)),
              );
            }}
          >
            {spotlights.map((item, index) => (
              <BehaviorImpression
                key={item.id}
                accessToken={accessToken}
                collectionContext={homeCollectionContext}
                evidence={{ contentId: item.id, contentType: item.contentType === "series" ? "MICRO_DRAMA" : "SHORT_FILM", sourceSurface: "home", rowId: spotlightRowId, position: index + 1, rankingDecisionId: homeState?.spotlightRankingDecisionId ?? null, recommendationReason: "EDITORIAL" }}
                scrollSignal={viewportSignal}
              >
                <SpotlightPosterItem spotlight={item} spotlightWidth={spotlightWidth} spotlightHeight={spotlightHeight} onTap={() => openSpotlightInfo(item)} />
              </BehaviorImpression>
            ))}
          </ScrollView>

          {/* Active-item footer: sits outside the rail so no controls on neighbors */}
          {activeSpotlight ? (
            <View style={styles.spotlightActiveFooter}>
              {activeSpotlight.showTitle ? (
                <Text style={styles.spotlightTitle} numberOfLines={1}>
                  {activeSpotlight.title}
                </Text>
              ) : null}
              <Button
                accessibilityLabel={`Watch ${activeSpotlight.title}`}
                disabled={resolvingKey === `spotlight-${activeSpotlight.contentType}-${activeSpotlight.slug}`}
                onPress={() => void openSpotlight(activeSpotlight)}
                style={styles.spotlightCta}
                variant="primary"
              >
                {t("home.watch", "Watch")}
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 3. Continue Watching / History State */}
      {!hasEverWatched && resource.historyStatus === "resolved" ? (
        <View style={styles.noHistoryState}>
          <Text style={styles.noHistoryText}>{t("home.no_history", "Start watching to continue here.")}</Text>
        </View>
      ) : visibleContinueWatching.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("home.continue_watching", "Continue Watching")}</Text>
          <FlatList
            data={visibleContinueWatching}
            horizontal
            keyExtractor={getContinueWatchingKey}
            onScroll={() => setViewportSignal((value) => value + 1)}
            scrollEventThrottle={100}
            renderItem={({ item, index }) => (
              <BehaviorImpression
                accessToken={accessToken}
                collectionContext={homeCollectionContext}
                evidence={{ contentId: getContinueWatchingKey(item), contentType: item.contentType === "series_episode" ? "SERIES_EPISODE" : "SHORT_FILM", sourceSurface: "continue_watching", rowId: null, position: index + 1, rankingDecisionId: continueWatchingDecision.rankingDecisionId, recommendationReason: "CONTINUE_WATCHING" }}
                scrollSignal={viewportSignal}
              >
              <ContinueWatchingCard
                entry={item}
                height={resumeCardHeight}
                readMedia={readContinueWatchingMedia}
                onPress={() => openContinueWatching(item)}
                resolveMedia={resolveContinueWatchingMedia}
                width={resumeCardWidth}
              />
              </BehaviorImpression>
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ItemSeparatorComponent={ContinueWatchingSeparator}
          />
        </View>
      ) : null}

      {/* 4. CMS Dynamic Rows / Consumer-Virgin Structural Headings */}
      {isVirginCatalog ? (
        <View style={styles.virginSectionsContainer}>
          {VIRGIN_HOME_HEADINGS.map((heading) => (
            <View key={heading} style={styles.virginSection}>
              <Text style={styles.virginHeadingText}>{heading}</Text>
            </View>
          ))}
        </View>
      ) : (
        visibleHomeRows
          .map((row) => (
            <View key={row.id} style={styles.section}>
              <Text style={styles.sectionTitle}>{row.title}</Text>
              <ScrollView
                horizontal
                onScroll={() => setViewportSignal((value) => value + 1)}
                scrollEventThrottle={100}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {row.items.map((item, index) => {
                  const isSeries = item.contentType === "series";
                  const isBusy = resolvingKey === `${item.contentType}-${item.slug}`;
                  const posterSource = hasValidPoster(item.poster ?? undefined)
                    ? resolveMediaUrl(item.poster)
                    : null;

                  if (isSeries) {
                    return (
                      <BehaviorImpression
                        key={`${row.id}-${item.slug}`}
                        accessToken={accessToken}
                        collectionContext={homeCollectionContext}
                        evidence={{ contentId: item.id, contentType: "MICRO_DRAMA", sourceSurface: "home", rowId: row.id, position: index + 1, rankingDecisionId: row.rankingDecisionId, recommendationReason: getHomeRowRecommendationReason(row) }}
                        scrollSignal={viewportSignal}
                      >
                      <CinematicPressable
                        accessibilityLabel={`Open details for ${item.title}`}
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => {
                          const recommendationReason = getHomeRowRecommendationReason(row);
                          const searchContext: DiscoveryContext = { contentId: item.id, contentSlug: item.slug, contentType: "MICRO_DRAMA", position: index + 1, rowId: row.id, sourceSurface: "home", rankingDecisionId: row.rankingDecisionId, recommendationReason };
                          emitBehaviorEvidence(accessToken, { eventType: "content_open", contentId: item.id, contentType: "MICRO_DRAMA", sourceSurface: "home", rowId: row.id, position: index + 1, rankingDecisionId: row.rankingDecisionId, recommendationReason });
                          perfMark("CONTENT_TAP", {
                            content_type: "series",
                            series_slug: item.slug,
                            source: "HOME",
                          });
                          navigation.navigate("Series", { searchContext, slug: item.slug });
                        }}
                        style={[
                          styles.posterCard,
                          { width: discoveryPosterWidth },
                          isBusy && styles.cardPressableBusy,
                        ]}
                      >
                        <View
                          style={[
                            styles.coverWrap,
                            { width: discoveryPosterWidth, height: discoveryPosterHeight },
                          ]}
                        >
                          {posterSource ? (
                            <Image
                              accessibilityLabel={`${item.title} poster`}
                              accessible
                              alt=""
                              fadeDuration={180}
                              source={{ uri: posterSource }}
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
                        </View>
                        {item.showTitle !== false ? (
                          <View style={styles.cardInfo}>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={styles.metaText}>{t("home.micro_drama", "Micro Drama")}</Text>
                          </View>
                        ) : null}
                      </CinematicPressable>
                      </BehaviorImpression>
                    );
                  }

                  const shortFilm = shortFilms.find((candidate) => candidate.slug === item.slug);

                  return (
                    <BehaviorImpression
                      key={`${row.id}-${item.slug}`}
                      accessToken={accessToken}
                      collectionContext={homeCollectionContext}
                      evidence={{ contentId: item.id, contentType: "SHORT_FILM", sourceSurface: "home", rowId: row.id, position: index + 1, rankingDecisionId: row.rankingDecisionId, recommendationReason: getHomeRowRecommendationReason(row) }}
                      scrollSignal={viewportSignal}
                    >
                    <CinematicPressable
                      accessibilityLabel={`Open details for ${item.title}`}
                      accessibilityRole="button"
                      disabled={isBusy}
                      onPress={() => {
                        const recommendationReason = getHomeRowRecommendationReason(row);
                        const searchContext: DiscoveryContext = { contentId: item.id, contentSlug: item.slug, contentType: "SHORT_FILM", position: index + 1, rowId: row.id, sourceSurface: "home", rankingDecisionId: row.rankingDecisionId, recommendationReason };
                        emitBehaviorEvidence(accessToken, { eventType: "content_open", contentId: item.id, contentType: "SHORT_FILM", sourceSurface: "home", rowId: row.id, position: index + 1, rankingDecisionId: row.rankingDecisionId, recommendationReason });
                        perfMark("CONTENT_TAP", {
                          content_type: "short_film",
                          short_film_slug: item.slug,
                          source: "HOME",
                        });
                        navigation.navigate("ShortFilm", { searchContext, slug: item.slug });
                      }}
                      style={[
                        styles.posterCard,
                        { width: discoveryPosterWidth },
                        isBusy && styles.cardPressableBusy,
                      ]}
                    >
                      <View
                        style={[
                          styles.coverWrap,
                          { width: discoveryPosterWidth, height: discoveryPosterHeight },
                        ]}
                      >
                        {posterSource ? (
                          <Image
                            accessibilityLabel={`${item.title} poster`}
                            accessible
                            alt=""
                            fadeDuration={180}
                            source={{ uri: posterSource }}
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
                      </View>
                      {item.showTitle !== false ? (
                        <View style={styles.cardInfo}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.metaText}>{t("home.short_film", "Short Film")}</Text>
                        </View>
                      ) : null}
                    </CinematicPressable>
                    </BehaviorImpression>
                  );
                })}
              </ScrollView>
            </View>
          ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  mainScrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    gap: 24,
    paddingBottom: 40,
  },
  loadingContent: {
    gap: 24,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    marginTop: -8,
    marginBottom: -8,
  },
  brandLogo: {
    width: 96,
    height: 96,
    marginLeft: -26,
  },
  brand: {
    color: colors.text,
    fontSize: 26,
    fontWeight: Platform.select({ android: "400", ios: "300" }),
    fontFamily: Platform.select({ android: "serif", ios: "Cormorant Garamond" }),
    letterSpacing: 0.5,
  },
  brandAccent: {
    color: colors.accent,
  },
  brandText: {
    color: colors.text,
  },
  section: {
    gap: 10,
  },
  continueWatchingEmptySection: {
    gap: 4,
    marginBottom: -4,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.h3,
    letterSpacing: 0.3,
  },
  virginSectionsContainer: {
    gap: 22,
    marginTop: 18,
  },
  virginSection: {
    justifyContent: "center",
  },
  virginHeadingText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: "500",
    letterSpacing: 0.1,
    lineHeight: 22,
  },
  noHistoryState: {
    paddingVertical: 2,
    marginTop: -2,
  },
  noHistoryText: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitleSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    height: 18,
    width: 132,
  },
  horizontalList: {
    gap: 12,
    paddingHorizontal: 0,
    paddingBottom: 2,
  },
  continueWatchingSeparator: {
    width: 12,
  },
  posterCard: {
    gap: 8,
  },
  resumeCard: {
    gap: 8,
  },
  cardPressableBusy: {
    opacity: 0.6,
  },
  cardPressablePressed: {
    opacity: 0.82,
  },
  coverWrap: {
    position: "relative",
    backgroundColor: surfaces.s1,
    borderRadius: radii.poster,
    overflow: "hidden",
  },
  previewFallback: {
    flex: 1,
    backgroundColor: surfaces.s1,
  },
  previewLayer: {
    ...StyleSheet.absoluteFill,
  },
  previewVideo: {
    ...StyleSheet.absoluteFill,
  },
  progressOverlay: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
    position: "absolute",
    right: 0,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverFallback: {
    flex: 1,
    backgroundColor: surfaces.s1,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  coverTitle: {
    color: colors.text,
    ...typography.body,
    fontWeight: "600",
    textAlign: "center",
  },
  cardInfo: {
    paddingHorizontal: 2,
  },
  cardTitle: {
    color: colors.text,
    ...typography.homeCardTitle,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  metaText: {
    color: colors.textSecondary,
    ...typography.micro,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.borderSubtle,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.accent,
  },
  brandSkeleton: {
    backgroundColor: colors.surfacePressed,
    height: 24,
    width: 76,
  },
  loadingCard: {
    backgroundColor: colors.surfacePressed,
    borderRadius: radii.poster,
  },
  spotlightSection: {
    width: "100%",
    alignItems: "flex-start",
    gap: 10,
  },
  spotlightSectionLabel: {
    color: colors.textSecondary,
    ...typography.h3,
    letterSpacing: 0.3,
  },
  spotlightRailScroll: {
    // Bleed past the 16dp padding of Screen so the poster starts at screen left
    // and the rail reaches the screen right edge.
    marginHorizontal: -16,
  },
  spotlightRail: {
    // Padding mirrors the Screen horizontal padding so card 1 aligns left
    paddingLeft: 16,
    gap: 12,
    alignItems: "flex-start",
  },
  spotlightPosterCard: {
    borderRadius: radii.poster,
    overflow: "hidden",
    backgroundColor: surfaces.s1,
  },
  spotlightPosterPressed: {
    opacity: 0.88,
  },
  spotlightImage: {
    width: "100%",
    height: "100%",
  },
  spotlightActiveFooter: {
    width: "100%",
    gap: 10,
    alignItems: "flex-start",
  },
  spotlightTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  spotlightCta: {
    alignSelf: "flex-start",
    paddingHorizontal: 24,
  },
  spotlightSkeleton: {
    backgroundColor: colors.surfacePressed,
    borderRadius: radii.poster,
  },
  spotlightSectionLabelSkeleton: {
    backgroundColor: colors.surfacePressed,
    height: 16,
    width: 72,
    borderRadius: radii.xs,
  },
  spotlightCtaSkeleton: {
    backgroundColor: colors.surfacePressed,
    height: 48,
    borderRadius: radii.cta,
    alignSelf: "stretch",
  },
  walletAffordance: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 24,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
    padding: 10,
  },
  walletAffordancePressed: {
    backgroundColor: colors.surfaceSelected,
  },
  walletIconOutline: {
    height: 18,
    width: 26,
    borderRadius: 5,
    borderWidth: 1.5,
    position: "relative",
  },
  walletIconCard: {
    height: 8,
    left: 3,
    position: "absolute",
    top: 3,
    width: 12,
    borderRadius: 2,
  },
});
