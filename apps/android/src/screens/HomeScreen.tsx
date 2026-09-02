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
import { BrandWordmark, RecoveryState } from "../components/ui";
import {
  ApiError,
  authorizePlayback,
  getCatalog,
  getRequestRecoveryCopy,
  getSeries,
  type RecoveryCopy,
} from "../lib/api";
import { resolveMediaUrl } from "../lib/media";
import { loadWatchHistory } from "../lib/playbackHistory";
import { getPlaybackAuthorizationCredentials } from "../lib/parentalControls";
import { perfMark, perfNow } from "../lib/perf";
import { useAuth } from "../lib/authContext";
import { findStartEpisode } from "../lib/seriesPlayback";
import { useAppLanguage } from "../lib/appLanguage";
import type { MainTabScreenProps } from "../navigation/types";
import type {
  ApiSeries,
  ApiShortFilm,
  HomeSpotlight,
  HomeState,
  PlaybackAuthorizationResponse,
  WatchProgressItem,
} from "../types/api";
import { colors, typography } from "../theme/tokens";

type Props = MainTabScreenProps<"Home">;

// Product default per Product Bible §6 (Continue Watching entry rule:
// "watched >= 5 seconds"). The current watch-progress API does not expose a
// backend/CMS-configurable threshold, so this is isolated as the single
// temporary product-default constant rather than a magic number inline.
const CONTINUE_WATCHING_MIN_SECONDS = 5;

const HOME_POSTER_MIN_WIDTH = 120;
const HOME_POSTER_MAX_WIDTH = 160;
// Continue Watching: compact enough to show the edge of the next card on screen.
// 150–200dp shows ~1.4 cards on a 360dp device, making horizontal scroll obvious.
const HOME_RESUME_MIN_WIDTH = 150;
const HOME_RESUME_MAX_WIDTH = 200;

const BRAND_LOGO_IMAGE = require("../../assets/brand/0nya-trans-400.png");

type ContinueWatchingEntry = WatchProgressItem & {
  series?: ApiSeries;
  shortFilm?: ApiShortFilm;
};

function hasValidPoster(poster?: string) {
  return typeof poster === "string" && poster.trim().length > 0;
}

function isQualifyingProgress(item: WatchProgressItem) {
  return (
    !item.completed &&
    item.positionSeconds >= CONTINUE_WATCHING_MIN_SECONDS
  );
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
    exclusionReason: item.completed
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
  const [catalog, setCatalog] = useState<ApiSeries[]>([]);
  const [homeState, setHomeState] = useState<HomeState | null>(null);
  const [shortFilms, setShortFilms] = useState<ApiShortFilm[]>([]);
  const [progress, setProgress] = useState<WatchProgressItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<RecoveryCopy | null>(null);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  // Tracks whether the first catalog/home fetch has conclusively resolved
  // (success or failure). Virgin structural headings must never render from
  // the transient unhydrated [] default state — only once this is true AND
  // the resolved catalog is genuinely empty.
  const [hasHydrated, setHasHydrated] = useState(false);
  const usableWidth = Math.max(0, windowWidth - 32);
  const spotlightWidth = Math.round(Math.min(260, Math.max(220, usableWidth * 0.67)));
  const spotlightHeight = Math.round(spotlightWidth / (9 / 16));
  const [activeSpotlightIndex, setActiveSpotlightIndex] = useState(0);
  const discoveryPosterWidth = Math.round(
    Math.min(HOME_POSTER_MAX_WIDTH, Math.max(HOME_POSTER_MIN_WIDTH, (usableWidth - 12) / 2.5)),
  );
  const discoveryPosterHeight = Math.round(discoveryPosterWidth / (9 / 16));
  const resumeCardWidth = Math.round(
    Math.min(HOME_RESUME_MAX_WIDTH, Math.max(HOME_RESUME_MIN_WIDTH, usableWidth / 1.85)),
  );
  const resumeCardHeight = Math.round(resumeCardWidth / (9 / 16));
  const continueWatchingMediaCacheRef = useRef<
    Map<string, ContinueWatchingMediaCacheEntry>
  >(new Map());
  const continueWatchingMediaInFlightRef = useRef<
    Map<string, Promise<ContinueWatchingMediaCacheEntry | null>>
  >(new Map());
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
    continueWatchingMediaCacheRef.current.clear();
    continueWatchingMediaInFlightRef.current.clear();
    const timeoutId = setTimeout(() => {
      setUnresolvableContinueWatchingKeys(new Set());
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [session?.user?.id]);

  const readContinueWatchingMedia = useCallback(
    (mediaKey: string) => {
      const cached = continueWatchingMediaCacheRef.current.get(mediaKey);

      if (!cached) {
        return null;
      }

      if (cached.status === "ok" && Date.parse(cached.expiresAt) <= Date.now()) {
        continueWatchingMediaCacheRef.current.delete(mediaKey);
        return null;
      }

      return cached;
    },
    [],
  );

  const resolveContinueWatchingMedia = useCallback(
    async (entry: ContinueWatchingEntry) => {
      const mediaKey = getContinueWatchingKey(entry);
      const cached = readContinueWatchingMedia(mediaKey);

      if (cached) {
        return cached;
      }

      const inFlight = continueWatchingMediaInFlightRef.current.get(mediaKey);

      if (inFlight) {
        return inFlight;
      }

      const request = (async () => {
        const auth = await getPlaybackAuthorizationCredentials(session);
        const response = await authorizePlayback(session?.access_token ?? null, {
          ...buildContinueWatchingPlaybackRequest(entry),
          guestCredential: auth.guestCredential ?? null,
          parentalSessionToken: auth.parentalSessionToken ?? null,
          stillAtSeconds: entry.positionSeconds,
        });

        if (response.status === "ok") {
          const record: ContinueWatchingMediaCacheEntry = {
            expiresAt: response.expiresAt,
            stillUrl: response.stillUrl ?? null,
            status: "ok",
          };

          continueWatchingMediaCacheRef.current.set(mediaKey, record);
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

        continueWatchingMediaCacheRef.current.set(mediaKey, record);
        return record;
      })().catch((error) => {
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

          continueWatchingMediaCacheRef.current.set(mediaKey, record);
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

        continueWatchingMediaCacheRef.current.set(mediaKey, record);
        return record;
      });

      continueWatchingMediaInFlightRef.current.set(mediaKey, request);

      return request.finally(() => {
        continueWatchingMediaInFlightRef.current.delete(mediaKey);
      });
    },
    [markContinueWatchingUnresolvable, readContinueWatchingMedia, session],
  );

  const loadHome = useCallback(async () => {
    const startedAt = perfNow();
    perfMark("HOME_REQUEST_START");
    if (__DEV__) {
      console.info("[0nya catalog HOME fetch start]");
    }

    const [catalogData, progressData] = await Promise.all([
      getCatalog(accessToken),
      loadWatchHistory(session),
    ]);

    console.log("[0nya HOME LOADED]", JSON.stringify({
      hasHome: Boolean(catalogData.home),
      hasSpotlight: Boolean(catalogData.home?.spotlight),
      rows: catalogData.home?.rows?.map((r) => ({ title: r.title, count: r.items?.length })),
      catalogCount: catalogData.catalog?.length,
      shortFilmsCount: catalogData.shortFilms?.length,
    }));

    if (__DEV__) {
      console.info("[0nya catalog HOME fetch received]", {
        catalogLength: catalogData.catalog.length,
        shortFilmsLength: catalogData.shortFilms.length,
      });
    }

    const nextCatalog = catalogData.catalog;
    const nextHomeState = catalogData.home ?? null;
    const nextShortFilms = catalogData.shortFilms;
    const nextProgress = progressData;

    if (__DEV__) {
      console.info("[0nya catalog HOME mapping complete]", {
        catalogLength: nextCatalog.length,
        homeRowsLength: nextHomeState?.rows.length ?? 0,
        shortFilmsLength: nextShortFilms.length,
        progressLength: nextProgress.length,
      });
    }

    setCatalog(nextCatalog);
    setHomeState(nextHomeState);
    setShortFilms(nextShortFilms);
    setProgress(nextProgress);
    setError(null);

    perfMark("HOME_DATA_READY", {
      duration_ms: Math.max(0, perfNow() - startedAt).toFixed(1),
    });

    return {
      catalog: nextCatalog,
      homeState: nextHomeState,
      shortFilms: nextShortFilms,
      progress: nextProgress,
    };
  }, [accessToken, session]);

  const reloadHome = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await loadHome();
      setCatalog(data.catalog);
      setHomeState(data.homeState);
      setShortFilms(data.shortFilms);
      setProgress(data.progress);
      setError(null);
    } catch (err) {
      setError(
        getRequestRecoveryCopy(err, {
          body: "Please try again.",
          title: "We couldn't load this right now.",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadHome]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const runLoad = async () => {
        try {
          const data = await loadHome();
          if (!isMounted) {
            return;
          }
          setCatalog(data.catalog);
          setHomeState(data.homeState);
          setShortFilms(data.shortFilms);
          setProgress(data.progress);
          setError(null);
        } catch (err) {
          if (!isMounted) {
            return;
          }
          setError(
            getRequestRecoveryCopy(err, {
              body: "Please try again.",
              title: "We couldn't load this right now.",
            }),
          );
        } finally {
          if (isMounted) {
            setHasHydrated(true);
            setIsLoading(false);
          }
        }
      };

      void runLoad();

      return () => {
        isMounted = false;
      };
    }, [loadHome]),
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

  // Trailing inset for the horizontal poster rail so the last real card
  // can snap to the same left anchor as card 1. The content inset is the
  // remaining viewport width after one card + left pad + gap.
  const spotlightTrailingInset = Math.max(0, windowWidth - 16 - spotlightWidth);

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

    if (target.contentType === "short_film") {
      const match = progress.find(
        (item) => item.contentType === "short_film" && item.shortFilmSlug === target.slug,
      );
      const resumePositionSeconds =
        match && !match.completed && match.positionSeconds >= CONTINUE_WATCHING_MIN_SECONDS
          ? match.positionSeconds
          : 0;

      navigation.navigate("ShortFilmPlayback", {
        resumeAtSeconds: resumePositionSeconds,
        slug: target.slug,
      });
      setResolvingKey(null);
      return;
    }

    const series = catalog.find((candidate) => candidate.slug === target.slug);

    if (series) {
      void openSeriesPlayback(series);
    } else {
      navigation.navigate("Series", { slug: target.slug });
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

    if (target.contentType === "short_film") {
      navigation.navigate("ShortFilm", { slug: target.slug });
    } else {
      navigation.navigate("Series", { slug: target.slug });
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

    if (entry.contentType === "short_film") {
      navigation.navigate("ShortFilmPlayback", {
        resumeAtSeconds: entry.positionSeconds,
        slug: entry.shortFilmSlug ?? "",
      });
      setResolvingKey(null);
      return;
    }

    if (!entry.seriesSlug || typeof entry.episodeNumber !== "number") {
      setResolvingKey(null);
      return;
    }

    void getSeries(entry.seriesSlug, session?.access_token);
    navigation.navigate("Watch", {
      episodeNumber: entry.episodeNumber,
      resumeAtSeconds: entry.positionSeconds,
      seriesSlug: entry.seriesSlug,
    });
    setResolvingKey(null);
  }

  async function openSeriesPlayback(series: ApiSeries) {
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
    const resumeProgress = seriesProgress.find((item) => !item.completed && item.positionSeconds >= CONTINUE_WATCHING_MIN_SECONDS);
    const resumeEpisode = resumeProgress
      ? series.episodes.find((episode) => episode.number === resumeProgress.episodeNumber)
      : undefined;
    const targetEpisode = resumeEpisode ?? findStartEpisode(series.episodes);

    if (targetEpisode) {
      void getSeries(series.slug, session?.access_token);
      navigation.navigate("Watch", {
        episodeNumber: targetEpisode.number,
        resumeAtSeconds: resumeProgress?.positionSeconds ?? undefined,
        seriesSlug: series.slug,
      });
      setResolvingKey(null);
      return;
    }

    navigation.navigate("Series", { slug: series.slug });
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
    <Screen>
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
            snapToInterval={spotlightWidth + 12}
            snapToAlignment="start"
            contentContainerStyle={[
              styles.spotlightRail,
              { paddingRight: spotlightTrailingInset },
            ]}
            style={styles.spotlightRailScroll}
            onMomentumScrollEnd={(event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const newIndex = Math.round(offsetX / (spotlightWidth + 12));
              setActiveSpotlightIndex(Math.max(0, Math.min(newIndex, spotlights.length - 1)));
            }}
          >
            {spotlights.map((item) => (
              <SpotlightPosterItem
                key={item.id}
                spotlight={item}
                spotlightWidth={spotlightWidth}
                spotlightHeight={spotlightHeight}
                onTap={() => openSpotlightInfo(item)}
              />
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
              <Pressable
                accessibilityLabel={`Watch ${activeSpotlight.title}`}
                accessibilityRole="button"
                disabled={resolvingKey === `spotlight-${activeSpotlight.contentType}-${activeSpotlight.slug}`}
                onPress={() => void openSpotlight(activeSpotlight)}
                style={({ pressed }) => [
                  styles.spotlightCta,
                  pressed && styles.spotlightCtaPressed,
                  resolvingKey === `spotlight-${activeSpotlight.contentType}-${activeSpotlight.slug}` && styles.cardPressableBusy,
                ]}
              >
                <Text style={styles.spotlightCtaText}>{t("home.watch", "Watch")}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 3. Continue Watching / History State */}
      {!hasEverWatched ? (
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
            renderItem={({ item }) => (
              <ContinueWatchingCard
                entry={item}
                height={resumeCardHeight}
                readMedia={readContinueWatchingMedia}
                onPress={() => openContinueWatching(item)}
                resolveMedia={resolveContinueWatchingMedia}
                width={resumeCardWidth}
              />
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
        homeState?.rows
          ?.filter((row) => row.enabled && row.items.length > 0 && row.role !== "spotlight")
          .map((row) => (
            <View key={row.id} style={styles.section}>
              <Text style={styles.sectionTitle}>{row.title}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {row.items.map((item) => {
                  const isSeries = item.contentType === "series";
                  const isBusy = resolvingKey === `${item.contentType}-${item.slug}`;
                  const posterSource = hasValidPoster(item.poster ?? undefined)
                    ? resolveMediaUrl(item.poster)
                    : null;

                  if (isSeries) {
                    return (
                      <CinematicPressable
                        key={`${row.id}-${item.slug}`}
                        accessibilityLabel={`Open details for ${item.title}`}
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => {
                          perfMark("CONTENT_TAP", {
                            content_type: "series",
                            series_slug: item.slug,
                            source: "HOME",
                          });
                          navigation.navigate("Series", { slug: item.slug });
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
                    );
                  }

                  const shortFilm = shortFilms.find((candidate) => candidate.slug === item.slug);

                  return (
                    <CinematicPressable
                      key={`${row.id}-${item.slug}`}
                      accessibilityLabel={`Open details for ${item.title}`}
                      accessibilityRole="button"
                      disabled={isBusy}
                      onPress={() => {
                        perfMark("CONTENT_TAP", {
                          content_type: "short_film",
                          short_film_slug: item.slug,
                          source: "HOME",
                        });
                        navigation.navigate("ShortFilm", { slug: item.slug });
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
    color: colors.textMuted,
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
    backgroundColor: colors.surface,
    borderRadius: 10,
    overflow: "hidden",
  },
  previewFallback: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
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
    backgroundColor: colors.surface,
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
    color: colors.muted,
    ...typography.micro,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(232, 228, 218, 0.14)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.accent,
  },
  brandSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    height: 24,
    width: 76,
  },
  loadingCard: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    borderRadius: 10,
  },
  spotlightSection: {
    width: "100%",
    alignItems: "flex-start",
    gap: 10,
  },
  spotlightSectionLabel: {
    color: colors.textMuted,
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
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.surface,
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
    backgroundColor: colors.accent,
    borderRadius: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  spotlightCtaPressed: {
    opacity: 0.85,
  },
  spotlightCtaText: {
    color: colors.accentOnPrimary,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  spotlightSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    borderRadius: 10,
  },
  spotlightSectionLabelSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    height: 16,
    width: 72,
    borderRadius: 4,
  },
  spotlightCtaSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    height: 48,
    borderRadius: 6,
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
