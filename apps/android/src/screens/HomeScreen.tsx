import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Screen } from "../components/Screen";
import { RecoveryState } from "../components/ui";
import {
  ApiError,
  authorizePlayback,
  getCatalog,
  getRequestRecoveryCopy,
  getSeries,
  getWallet,
  type RecoveryCopy,
} from "../lib/api";
import { loadWatchHistory } from "../lib/playbackHistory";
import { getPlaybackAuthorizationCredentials } from "../lib/parentalControls";
import { useAuth } from "../lib/authContext";
import { findResumeEpisode, findStartEpisode } from "../lib/seriesPlayback";
import type { MainTabScreenProps, RootStackParamList } from "../navigation/types";
import type { ApiSeries, ApiShortFilm, PlaybackAuthorizationResponse, WatchProgressItem } from "../types/api";
import { borders, colors, typography } from "../theme/tokens";

type Props = MainTabScreenProps<"Home">;

// Product default per Product Bible §6 (Continue Watching entry rule:
// "watched >= 5 seconds"). The current watch-progress API does not expose a
// backend/CMS-configurable threshold, so this is isolated as the single
// temporary product-default constant rather than a magic number inline.
const CONTINUE_WATCHING_MIN_SECONDS = 5;

const HOME_POSTER_MIN_WIDTH = 112;
const HOME_POSTER_MAX_WIDTH = 132;
const HOME_DISCOVERY_POSTER_ASPECT_RATIO = 9 / 16;
const HOME_RESUME_MIN_WIDTH = 150;
const HOME_RESUME_MAX_WIDTH = 176;

type ContinueWatchingEntry = WatchProgressItem & {
  series?: ApiSeries;
  shortFilm?: ApiShortFilm;
};

function hasValidPoster(poster?: string) {
  return typeof poster === "string" && poster.trim().length > 0 && !poster.startsWith("/");
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
      : catalog.some((candidate) => candidate.slug === item.seriesSlug);

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
    <Pressable
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
      style={[styles.resumeCard, { width }]}
    >
      <View style={[styles.coverWrap, { width, height }]}>
        {stillUrl ? (
          <Image
            accessibilityLabel={`${title} still`}
            accessible
            alt=""
            source={{ uri: stillUrl }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.previewFallback} />
        )}
        <View style={styles.progressOverlay}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    100,
                    Math.max(0, entry.durationSeconds > 0 ? (entry.positionSeconds / entry.durationSeconds) * 100 : 0),
                  )}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.metaText} numberOfLines={1}>
        {metaText}
      </Text>
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

function InfoGlyph() {
  return (
    <View style={styles.infoGlyph}>
      <Text style={styles.infoGlyphText}>i</Text>
    </View>
  );
}

function WalletMark() {
  return (
    <View accessible={false} style={styles.walletMark}>
      <View style={styles.walletMarkBody}>
        <View style={styles.walletMarkFlap} />
      </View>
      <View style={styles.walletMarkPocket} />
    </View>
  );
}

function HomeLoadingState({
  posterCardHeight,
  posterCardWidth,
  resumeCardHeight,
  resumeCardWidth,
}: {
  posterCardHeight: number;
  posterCardWidth: number;
  resumeCardHeight: number;
  resumeCardWidth: number;
}) {
  return (
    <ScrollView contentContainerStyle={styles.loadingContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={styles.brandSkeleton} />
      </View>

      <View style={styles.heroSkeleton}>
        <View style={styles.heroArtworkSkeleton} />
        <View style={styles.heroMetaSkeleton}>
          <View style={styles.heroTitleSkeleton} />
          <View style={styles.heroLineSkeleton} />
          <View style={styles.heroLineShortSkeleton} />
          <View style={styles.heroButtonRowSkeleton}>
            <View style={styles.heroPrimaryButtonSkeleton} />
            <View style={styles.heroSecondaryButtonSkeleton} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleSkeleton} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          <LoadingCard height={resumeCardHeight} width={resumeCardWidth} />
          <LoadingCard height={resumeCardHeight} width={resumeCardWidth} />
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleSkeleton} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleSkeleton} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
          <LoadingCard height={posterCardHeight} width={posterCardWidth} />
        </ScrollView>
      </View>
    </ScrollView>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const accessToken = session?.access_token;
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<ApiSeries[]>([]);
  const [shortFilms, setShortFilms] = useState<ApiShortFilm[]>([]);
  const [progress, setProgress] = useState<WatchProgressItem[]>([]);
  const [error, setError] = useState<RecoveryCopy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const hasHydratedRef = useRef(false);
  const discoveryPosterWidth = Math.round(
    Math.min(
      HOME_POSTER_MAX_WIDTH,
      Math.max(HOME_POSTER_MIN_WIDTH, (windowWidth - 56) / 2.55),
    ),
  );
  const discoveryPosterHeight = Math.round(discoveryPosterWidth / HOME_DISCOVERY_POSTER_ASPECT_RATIO);
  const resumeCardWidth = Math.round(
    Math.min(HOME_RESUME_MAX_WIDTH, Math.max(HOME_RESUME_MIN_WIDTH, windowWidth * 0.41)),
  );
  const resumeCardHeight = Math.round((resumeCardWidth * 16) / 9);
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

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      if (!accessToken) {
        setWalletBalance(null);
        return undefined;
      }

      void getWallet(accessToken)
        .then((wallet) => {
          if (isActive) {
            setWalletBalance(wallet.balance);
          }
        })
        .catch((error) => {
          if (__DEV__) {
            console.info(
              "[0nya HOME wallet refresh]",
              error instanceof Error ? error.message : String(error),
              error instanceof Error ? error.stack : undefined,
            );
          }
        });

      return () => {
        isActive = false;
      };
    }, [accessToken]),
  );

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
    if (__DEV__) {
      console.info("[0nya catalog HOME fetch start]");
    }

    const [catalogData, progressData] = await Promise.all([
      getCatalog(accessToken),
      loadWatchHistory(session),
    ]);

    if (__DEV__) {
      console.info("[0nya catalog HOME fetch received]", {
        catalogLength: catalogData.catalog.length,
        shortFilmsLength: catalogData.shortFilms.length,
      });
    }

    const nextCatalog = catalogData.catalog;
    const nextShortFilms = catalogData.shortFilms;
    const nextProgress = progressData;

    if (__DEV__) {
      console.info("[0nya catalog HOME mapping complete]", {
        catalogLength: nextCatalog.length,
        shortFilmsLength: nextShortFilms.length,
        progressLength: nextProgress.length,
      });
    }

    return {
      catalog: nextCatalog,
      shortFilms: nextShortFilms,
      progress: nextProgress,
    };
  }, [accessToken, session]);

  useFocusEffect(
    useCallback(() => {
      if (!hasHydratedRef.current) {
        return undefined;
      }

      let isActive = true;

      void loadWatchHistory(session)
        .then((progressData) => {
          if (isActive) {
            setProgress(progressData);
          }
        })
        .catch((error) => {
          console.error(
            "[0nya catalog HOME history refresh]",
            error instanceof Error ? error.message : String(error),
            error instanceof Error ? error.stack : undefined,
          );
        });

      return () => {
        isActive = false;
      };
    }, [session]),
  );

  const reloadHome = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await loadHome();
      if (__DEV__) {
        console.info("[0nya catalog HOME state committed]", {
          catalogLength: data.catalog.length,
          shortFilmsLength: data.shortFilms.length,
          progressLength: data.progress.length,
        });
      }
      setCatalog(data.catalog);
      setShortFilms(data.shortFilms);
      setProgress(data.progress);
      setError(null);
    } catch (error) {
      console.error(
        "[0nya catalog HOME reload]",
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : undefined,
      );
      setError(
        getRequestRecoveryCopy(error, {
          body: "Please try again.",
          title: "We couldn't load this right now.",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadHome]);

  useEffect(() => {
    let isMounted = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load state marks the current fetch lifecycle.
    setIsLoading(true);

    void loadHome()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        if (__DEV__) {
          console.info("[0nya catalog HOME continue-watching merge complete]", {
            catalogLength: data.catalog.length,
            shortFilmsLength: data.shortFilms.length,
            progressLength: data.progress.length,
          });
        }

        setCatalog(data.catalog);
        setShortFilms(data.shortFilms);
        setProgress(data.progress);
        setError(null);
      })
      .catch((error) => {
        console.error(
          "[0nya catalog HOME initial]",
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error.stack : undefined,
        );
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
  }, [loadHome]);

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

        if (series) {
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

  async function openContinueWatching(entry: ContinueWatchingEntry) {
    const key =
      entry.contentType === "short_film"
        ? `short-${entry.shortFilmSlug}`
        : `${entry.seriesSlug}-${entry.episodeNumber}`;

    if (resolvingKey) {
      return;
    }

    setResolvingKey(key);

    try {
      // Reuses the existing Series-detail API/access-resolution contract (the
      // same one SeriesScreen uses) so the exact saved episode's resolved
      // access is respected before entering the player.
      if (entry.contentType === "short_film") {
        navigation.navigate("ShortFilmPlayback", {
          resumeAtSeconds: entry.positionSeconds,
          slug: entry.shortFilmSlug ?? "",
        });
        return;
      }

      const seriesSlug = entry.seriesSlug;

      if (!seriesSlug) {
        return;
      }

      const seriesData = await getSeries(seriesSlug, accessToken);
      const episode = seriesData.series.episodes.find(
        (candidate) => candidate.number === entry.episodeNumber,
      );
      const access = seriesData.episodeAccess[String(entry.episodeNumber)];

      if (episode && access) {
        navigation.navigate("Watch", {
          access,
          episode,
          episodeAccess: seriesData.episodeAccess,
          series: seriesData.series,
        });
        return;
      }
    } catch {
      // Fall through to the existing Series detail entry point below.
    } finally {
      setResolvingKey(null);
    }

    if (entry.seriesSlug) {
      navigation.navigate("Series", { slug: entry.seriesSlug });
    }
  }

  async function openSeriesPlayback(series: ApiSeries) {
    const key = `series-${series.slug}`;

    if (resolvingKey) {
      return;
    }

    setResolvingKey(key);

    try {
      const seriesData = await getSeries(series.slug, accessToken);
      const resumeEpisode = findResumeEpisode(
        progress,
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
      // Fall back to the deliberate details route below.
    } finally {
      setResolvingKey(null);
    }

    navigation.navigate("Series", { slug: series.slug });
  }

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <HomeLoadingState
          posterCardHeight={discoveryPosterHeight}
          posterCardWidth={discoveryPosterWidth}
          resumeCardHeight={resumeCardHeight}
          resumeCardWidth={resumeCardWidth}
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.brand} allowFontScaling>
            <Text style={styles.brandAccent}>0</Text>
            <Text style={styles.brandText}>nya</Text>
          </Text>
          {accessToken && walletBalance !== null ? (
            <Pressable
              accessibilityLabel={`Wallet balance ${walletBalance} coins`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => rootNavigation?.navigate("Wallet")}
              style={({ pressed }) => [styles.walletChip, pressed && styles.walletChipPressed]}
            >
              <WalletMark />
              <Text style={styles.walletChipValue}>{walletBalance}</Text>
            </Pressable>
          ) : null}
        </View>

        {visibleContinueWatching.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Watching</Text>
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

        {catalog.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Micro Dramas</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {catalog.map((series) => {
                const isBusy = resolvingKey === `series-${series.slug}`;

                return (
                  <View key={series.slug} style={[styles.posterCard, { width: discoveryPosterWidth }]}>
                    <Pressable
                      accessibilityLabel={`Play or resume ${series.title}`}
                      accessibilityRole="button"
                      disabled={isBusy}
                      onPress={() => void openSeriesPlayback(series)}
                      style={({ pressed }) => [
                        styles.cardMainPressable,
                        isBusy && styles.cardPressableBusy,
                        pressed && styles.cardPressablePressed,
                      ]}
                    >
                      <View style={[styles.coverWrap, { width: discoveryPosterWidth, height: discoveryPosterHeight }]}>
                        {hasValidPoster(series.poster) ? (
                          <Image
                            accessibilityLabel={`${series.title} poster`}
                            accessible
                            alt=""
                            source={{ uri: series.poster }}
                            style={styles.coverImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.coverFallback}>
                            <Text style={styles.coverTitle} numberOfLines={2}>
                              {series.title}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>

                    <View style={styles.cardTitleRow}>
                      <Pressable
                        accessibilityLabel={`Play or resume ${series.title}`}
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => void openSeriesPlayback(series)}
                        style={({ pressed }) => [
                          styles.cardTitlePressable,
                          isBusy && styles.cardPressableBusy,
                          pressed && styles.cardPressablePressed,
                        ]}
                      >
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {series.title}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Open details for ${series.title}`}
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => navigation.navigate("Series", { slug: series.slug })}
                        style={({ pressed }) => [styles.infoButton, pressed && styles.infoButtonPressed]}
                      >
                        <InfoGlyph />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {shortFilms.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Short Films</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {shortFilms.map((shortFilm) => {
                const isBusy = resolvingKey === `short-${shortFilm.slug}`;
                const posterSource = hasValidPoster(shortFilm.poster) ? shortFilm.poster : null;

                return (
                  <Pressable
                    key={shortFilm.slug}
                    accessibilityLabel={`Open details for ${shortFilm.title}`}
                    accessibilityRole="button"
                    disabled={isBusy}
                    onPress={() => {
                      if (isBusy) {
                        return;
                      }

                      setResolvingKey(`short-${shortFilm.slug}`);
                      navigation.navigate("ShortFilm", { slug: shortFilm.slug });
                      setResolvingKey(null);
                    }}
                    style={[styles.posterCard, { width: discoveryPosterWidth }, isBusy && styles.cardPressableBusy]}
                  >
                    <View style={[styles.coverWrap, { width: discoveryPosterWidth, height: discoveryPosterHeight }]}>
                      {posterSource ? (
                        <Image
                          accessibilityLabel={`${shortFilm.title} poster`}
                          accessible
                          alt=""
                          source={{ uri: posterSource }}
                          style={styles.coverImage}
                          resizeMode="cover"
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
                    <Text style={styles.metaText} numberOfLines={1}>
                      {shortFilm.durationLabel}
                      {shortFilm.language ? ` • ${shortFilm.language}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: 18,
    paddingBottom: 24,
  },
  loadingContent: {
    gap: 18,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  walletChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(232, 228, 218, 0.04)",
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  walletChipPressed: {
    backgroundColor: "rgba(13, 209, 188, 0.08)",
    borderColor: "rgba(13, 209, 188, 0.22)",
  },
  walletMark: {
    height: 18,
    justifyContent: "center",
    position: "relative",
    width: 20,
  },
  walletMarkBody: {
    borderColor: colors.accent,
    borderRadius: 4,
    borderWidth: 1.4,
    height: 13,
    justifyContent: "center",
    left: 1,
    position: "absolute",
    top: 2.5,
    width: 16,
  },
  walletMarkFlap: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 1.4,
    left: 3,
    position: "absolute",
    top: 2.5,
    width: 7,
  },
  walletMarkPocket: {
    borderColor: colors.accent,
    borderRadius: 2.5,
    borderWidth: 1.2,
    height: 7.5,
    position: "absolute",
    right: 1.5,
    top: 5.2,
    width: 4.5,
  },
  walletChipValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  brand: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.2,
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
  sectionTitle: {
    color: colors.text,
    ...typography.homeSectionTitle,
  },
  sectionTitleSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    height: 18,
    width: 132,
  },
  horizontalList: {
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  continueWatchingSeparator: {
    width: 10,
  },
  posterCard: {
    gap: 8,
  },
  resumeCard: {
    gap: 7,
  },
  cardMainPressable: {
    gap: 6,
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
    borderColor: borders.color,
    borderWidth: 0,
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
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  cardTitle: {
    color: colors.text,
    ...typography.homeCardTitle,
  },
  metaText: {
    color: colors.muted,
    ...typography.homeCardMeta,
    textTransform: "none",
  },
  pressed: {
    opacity: 0.82,
  },
  cardFooterRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardFooterSpacer: {
    flex: 1,
  },
  cardTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitlePressable: {
    flex: 1,
  },
  infoButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  infoButtonPressed: {
    opacity: 0.72,
  },
  infoGlyph: {
    alignItems: "center",
    borderColor: "rgba(232, 228, 218, 0.30)",
    borderRadius: 999,
    borderWidth: 1,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  infoGlyphText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    marginTop: -1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(232, 228, 218, 0.14)",
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.accent,
  },
  brandSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    height: 24,
    width: 76,
  },
  heroSkeleton: {
    gap: 14,
  },
  heroArtworkSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    borderColor: borders.color,
    borderWidth: 1,
    aspectRatio: 16 / 9,
    overflow: "hidden",
  },
  heroMetaSkeleton: {
    gap: 10,
  },
  heroTitleSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    height: 26,
    width: "72%",
  },
  heroLineSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    height: 14,
    width: "92%",
  },
  heroLineShortSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    height: 14,
    width: "68%",
  },
  heroButtonRowSkeleton: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  heroPrimaryButtonSkeleton: {
    backgroundColor: "rgba(13, 209, 188, 0.20)",
    height: 48,
    width: 126,
  },
  heroSecondaryButtonSkeleton: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    height: 48,
    width: 92,
  },
  loadingCard: {
    backgroundColor: "rgba(232, 228, 218, 0.08)",
    borderColor: borders.color,
    borderWidth: 1,
  },
});
