import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import { StatusBar } from "expo-status-bar";
import { VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWallet } from "../lib/api";
import { createChaiIdempotencyKey, sendShortFilmChaiTip } from "../lib/chai";
import { EpisodeListSheet } from "./EpisodeListSheet";
import { PlayerControls } from "./PlayerControls";
import { PlayerMoreSheet } from "./PlayerMoreSheet";
import { SubtitleTrackSheet } from "./SubtitleTrackSheet";
import { buildEpisodeShareMessage, buildShortFilmShareMessage } from "../lib/content-links";
import {
  formatPlaybackSpeed,
  getPlaybackSpeedPreference,
  setPlaybackSpeedPreference,
} from "../lib/playbackSpeed";
import {
  getSubtitlePreference,
  getSubtitleTrackLabel,
  getSubtitleTrackSelectionKey,
  resolvePreferredSubtitleTrack,
  setSubtitlePreference,
  type SubtitlePreference,
} from "../lib/subtitles";
import { useAutoHideControls } from "./useAutoHideControls";
import { usePlaybackController } from "./usePlaybackController";
import { useWatchProgressSync } from "./useWatchProgressSync";
import { getResumePositionSeconds } from "./resumePosition";
import type { PlaybackContext, PlaybackEndedPayload, PlaybackMode } from "./types";
import type { RootStackParamList } from "../navigation/types";
import type {
  ApiEpisode,
  ApiShortFilm,
  EpisodeAccess,
  ShortFilmChaiAvailability,
  WatchProgressItem,
} from "../types/api";
import type { PlaybackSource } from "./types";

type PlayerScreenProps = {
  context: PlaybackContext;
  episodeAccess?: Record<string, EpisodeAccess>;
  episodes?: ApiEpisode[];
  onEnded?: (payload: PlaybackEndedPayload) => void;
  onAdvanceToNext?: (
    nextEpisode: NonNullable<Extract<PlaybackContext, { type: "SERIES_EPISODE" }>["nextEpisode"]>,
  ) => void;
  onSelectEpisode?: (episodeNumber: number) => void;
  onSeeOptions?: () => void;
  onRetryPlayback?: () => void;
  isProgressResolved?: boolean;
  initialSeekSeconds?: number | null;
  playbackMode?: PlaybackMode;
  previewSeconds?: number | null;
  savedProgress?: WatchProgressItem;
  session: Session | null;
  shortFilm?: ApiShortFilm | null;
  shortFilmChai?: ShortFilmChaiAvailability | null;
  source: PlaybackSource;
};

const DOUBLE_TAP_DELAY_MS = 280;
const SEEK_SECONDS = 10;
const HOLD_RATE = 1.5;
const TERMINAL_VISUAL_GUARD_SECONDS = 0.05;
const CHAI_REVEAL_FINAL_SECONDS = 10;

function isInChaiRevealWindow(duration: number, currentTime: number) {
  if (
    !Number.isFinite(duration) ||
    duration <= CHAI_REVEAL_FINAL_SECONDS ||
    !Number.isFinite(currentTime) ||
    currentTime < 0
  ) {
    return false;
  }

  const remaining = duration - currentTime;
  return Number.isFinite(remaining) && remaining > 0 && remaining <= CHAI_REVEAL_FINAL_SECONDS;
}

export function PlayerScreen({
  context,
  episodeAccess,
  episodes,
  isProgressResolved = true,
  onAdvanceToNext,
  onEnded,
  onSelectEpisode,
  onSeeOptions,
  onRetryPlayback,
  initialSeekSeconds,
  playbackMode = "full",
  previewSeconds,
  savedProgress,
  session,
  shortFilm,
  shortFilmChai,
  source,
}: PlayerScreenProps) {
  const isPreviewMode = playbackMode === "preview";
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const lastTapRef = useRef<{ side: "left" | "right"; timestamp: number } | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef(false);
  const transitionStartedRef = useRef(false);
  const seamlessTransitionRequestedRef = useRef(false);
  const seamlessTransitionQueuedRef = useRef(false);
  // Synchronous lock for the seamless auto-advance handoff. This ref is set
  // true before awaiting saveFinal() so competing playToEnd events cannot both
  // race into the same transition path.
  const autoNextActiveRef = useRef(false);
  const resumeAppliedContextRef = useRef<string | null>(null);
  const progressSyncArmedRef = useRef(false);
  const subtitlePreferenceLoadedRef = useRef(false);
  const lastAppliedSubtitleSourceLoadRef = useRef(0);
  const allowBeforeRemoveRef = useRef(false);
  const onAdvanceToNextRef = useRef(onAdvanceToNext);
  const progressSyncRef = useRef({
    saveFinal: () => Promise.resolve(),
    saveNow: () => Promise.resolve(),
  });
  const contextKey =
    context.type === "SERIES_EPISODE"
      ? `${context.seriesSlug}:${context.episodeNumber}`
      : `film:${context.filmSlug}`;
  // Tracks the most recently rendered contextKey so an in-flight saveFinal() can
  // detect that the episode/context changed underneath it before handing off
  // to the next episode (prevents a stale continuation from advancing an
  // episode the player has already left).
  const latestContextKeyRef = useRef(contextKey);
  const replayStartPendingRef = useRef(
    context.type === "SHORT_FILM" && initialSeekSeconds === 0,
  );
  // True for the brief window between a genuine completion and the next
  // episode actually mounting, so the Replay/Back ended-overlay does not
  // flash on screen during a seamless auto-advance.
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const [isTransitionRequested, setIsTransitionRequested] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [isSubtitleSheetOpen, setIsSubtitleSheetOpen] = useState(false);
  const [isHoldFastPlayActive, setIsHoldFastPlayActive] = useState(false);
  const [isChaiSheetOpen, setIsChaiSheetOpen] = useState(false);
  const [selectedChaiAmount, setSelectedChaiAmount] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isSubmittingChai, setIsSubmittingChai] = useState(false);
  const [chaiSubmitState, setChaiSubmitState] = useState<"idle" | "success" | "error">("idle");
  const [chaiError, setChaiError] = useState<string | null>(null);
  const [hasSentChai, setHasSentChai] = useState(false);
  const [subtitlePreference, setSubtitlePreferenceState] = useState<SubtitlePreference>({
    enabled: false,
    preferredLanguageCode: null,
  });
  const selectedPlaybackRateRef = useRef(1);
  const temporaryPlaybackRateRestoreRef = useRef<number | null>(null);

  /* eslint-disable react-hooks/immutability -- expo-video subtitle selection requires mutating the player property. */
  useEffect(() => {
    latestContextKeyRef.current = contextKey;
  }, [contextKey]);

  useEffect(() => {
    onAdvanceToNextRef.current = onAdvanceToNext;
  }, [onAdvanceToNext]);

  const advanceToNext = useCallback(() => {
    if (
      context.type !== "SERIES_EPISODE" ||
      !context.nextEpisode ||
      transitionStartedRef.current
    ) {
      // Keep the lock if a successful handoff already started; the incoming
      // contextKey effect clears it. Do not reopen the outgoing episode.
      if (!transitionStartedRef.current) {
        autoNextActiveRef.current = false;
        setIsAutoAdvancing(false);
      }
      return;
    }

    transitionStartedRef.current = true;
    setIsAutoAdvancing(true);
    onAdvanceToNextRef.current?.(context.nextEpisode);
  }, [context]);

  const handlePlaybackEnded = useCallback(
    (payload: PlaybackEndedPayload) => {
      if (isPreviewMode) {
        void (async () => {
          await progressSyncRef.current.saveFinal();

          onEnded?.(payload);
        })();
        return;
      }

      if (autoNextActiveRef.current || seamlessTransitionRequestedRef.current) {
        return;
      }

      if (
        context.type === "SERIES_EPISODE" &&
        context.nextEpisode &&
        !transitionStartedRef.current
      ) {
        seamlessTransitionRequestedRef.current = true;
        seamlessTransitionQueuedRef.current = true;
        setIsTransitionRequested(true);

        return;
      }

      if (context.type === "SHORT_FILM") {
        if (replayStartPendingRef.current) {
          return;
        }
        setIsChaiSheetOpen(false);
        setIsMoreSheetOpen(false);
        setIsSubtitleSheetOpen(false);
      }

      void (async () => {
        await progressSyncRef.current.saveFinal();

        onEnded?.(payload);
      })();
    },
    [context, isPreviewMode, onEnded],
  );

  const controller = usePlaybackController({
    context,
    onEnded: handlePlaybackEnded,
    playbackLimitSeconds: isPreviewMode ? previewSeconds ?? null : null,
    source: source.source,
  });
  useEffect(() => {
    if (!isTransitionRequested || seamlessTransitionQueuedRef.current === false) {
      return undefined;
    }

    let cancelled = false;

    void (async () => {
      autoNextActiveRef.current = true;

      await progressSyncRef.current.saveFinal();

      if (cancelled || transitionStartedRef.current || latestContextKeyRef.current !== contextKey) {
        autoNextActiveRef.current = false;
        setIsAutoAdvancing(false);
        setIsTransitionRequested(false);
        seamlessTransitionRequestedRef.current = false;
        seamlessTransitionQueuedRef.current = false;
        return;
      }

      setIsAutoAdvancing(true);
      advanceToNext();
      setIsTransitionRequested(false);
      seamlessTransitionRequestedRef.current = false;
      seamlessTransitionQueuedRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [advanceToNext, contextKey, isTransitionRequested]);
  const player = controller.player;
  const playbackRate = controller.playbackRate;
  const sourceLoadCount = controller.sourceLoadCount;
  const subtitleTrack = controller.subtitleTrack;
  const subtitleTracks = controller.subtitleTracks;
  const { areControlsVisible, revealControls, toggleControls } = useAutoHideControls(
    controller.isPlaying,
  );
  const { pause, play, seekBy, setPlaybackRate } = controller;
  const shouldShowTransitionCover = isTransitionRequested || isAutoAdvancing;
  const shouldShowTerminalGuard =
    !isPreviewMode &&
    context.type === "SERIES_EPISODE" &&
    Boolean(context.nextEpisode) &&
    !isTransitionRequested &&
    !isAutoAdvancing &&
    !controller.hasEnded &&
    !controller.isPlaying &&
    controller.duration > 0 &&
    controller.currentTime >= Math.max(0, controller.duration - TERMINAL_VISUAL_GUARD_SECONDS);
  const [isEpisodeListOpen, setIsEpisodeListOpen] = useState(false);
  const wasPlayingBeforeSheetRef = useRef(false);
  // Single truthful source: derived from expo-video's actual selected subtitleTrack.
  const isSubtitlesEnabled = subtitleTrack !== null;
  const subtitlesAvailable = subtitleTracks.length > 0;
  const showEpisodesControl =
    !isPreviewMode &&
    context.type === "SERIES_EPISODE" &&
    Boolean(episodes?.length) &&
    Boolean(episodeAccess) &&
    Boolean(onSelectEpisode);

  useEffect(() => {
    let active = true;

    void getPlaybackSpeedPreference()
      .then((preferredPlaybackRate) => {
        if (!active) {
          return;
        }

        selectedPlaybackRateRef.current = preferredPlaybackRate;
        setPlaybackRate(preferredPlaybackRate);
      })
      .catch(() => {
        console.warn("Unable to load playback speed preference.");
      });

    return () => {
      active = false;
    };
  }, [setPlaybackRate]);

  const progressSync = useWatchProgressSync({
    context,
    currentTime: controller.currentTime,
    duration: controller.duration,
    enabled: !isPreviewMode,
    isPlaying: controller.isPlaying,
    isSyncArmedRef: progressSyncArmedRef,
    session,
  });

  useEffect(() => {
    progressSyncRef.current = progressSync;
  }, [progressSync]);

  useEffect(() => {
    transitionStartedRef.current = false;
    autoNextActiveRef.current = false;
    resumeAppliedContextRef.current = null;
    progressSyncArmedRef.current = false;
    replayStartPendingRef.current =
      context.type === "SHORT_FILM" && initialSeekSeconds === 0;
    // A new episode/context means any in-flight auto-advance handoff from the
    // previous episode is no longer valid. Reset the rendered state in a microtask
    // so the state clears after the new context has mounted without forcing a
    // direct setState call during the effect body.
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setIsAutoAdvancing(false);
      }
    });

    return () => {
      active = false;
    };
  }, [context.type, contextKey, initialSeekSeconds]);

  const resetChaiPresentation = useCallback(() => {
    setHasSentChai(false);
    setIsChaiSheetOpen(false);
    setSelectedChaiAmount(null);
    setWalletBalance(null);
    setChaiSubmitState("idle");
    setChaiError(null);
  }, []);

  useEffect(() => {
    let active = true;

    void getSubtitlePreference().then((preference) => {
      if (!active) {
        return;
      }

      subtitlePreferenceLoadedRef.current = true;
      setSubtitlePreferenceState(preference);
    }).catch(() => {
      console.warn("Unable to load subtitle preference.");
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener("blur", () => {
      void progressSync.saveNow();
      pause();
      if (temporaryPlaybackRateRestoreRef.current !== null) {
        setPlaybackRate(temporaryPlaybackRateRestoreRef.current);
        temporaryPlaybackRateRestoreRef.current = null;
      } else {
        setPlaybackRate(selectedPlaybackRateRef.current);
      }
    });

    return () => {
      unsubscribeBlur();
    };
  }, [navigation, pause, progressSync, setPlaybackRate]);

  useEffect(() => {
    const unsubscribeBeforeRemove = navigation.addListener("beforeRemove", (event) => {
      if (allowBeforeRemoveRef.current) {
        allowBeforeRemoveRef.current = false;
        return;
      }

      // Wait for the latest progress write before allowing navigation away.
      event.preventDefault();
      void progressSync.saveNow().then(() => {
        allowBeforeRemoveRef.current = true;
        navigation.dispatch(event.data.action);
      });
    });

    return () => {
      unsubscribeBeforeRemove();
    };
  }, [navigation, progressSync]);

  useEffect(() => {
    if (
      isPreviewMode ||
      resumeAppliedContextRef.current === contextKey ||
      controller.sourceLoadCount === 0 ||
      !isProgressResolved
    ) {
      return;
    }

    const resumePosition =
      typeof initialSeekSeconds === "number"
        ? Math.max(0, Math.min(initialSeekSeconds, controller.duration || initialSeekSeconds))
        : getResumePositionSeconds(savedProgress, controller.duration);

    if (resumePosition !== null) {
      controller.seekTo(resumePosition);
    }

    resumeAppliedContextRef.current = contextKey;
    progressSyncArmedRef.current = true;
    if (replayStartPendingRef.current) {
      replayStartPendingRef.current = false;
    }
  }, [
    context.type,
    context,
    contextKey,
    controller,
    controller.duration,
    controller.sourceLoadCount,
    initialSeekSeconds,
    isProgressResolved,
    isPreviewMode,
    savedProgress,
  ]);

  const handlePlayPause = useCallback(() => {
    if (controller.isPlaying) {
      void progressSync.saveNow();
    }

    controller.togglePlay();
    revealControls();
  }, [controller, progressSync, revealControls]);

  const handleReplay = useCallback(() => {
    resetChaiPresentation();
    controller.replay();
  }, [controller, resetChaiPresentation]);

  const handleSeekTo = useCallback(
    (seconds: number) => {
      controller.seekTo(seconds);
      revealControls();
    },
    [controller, revealControls],
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleShare = useCallback(() => {
    const message =
      context.type === "SERIES_EPISODE"
        ? buildEpisodeShareMessage(
            context.seriesTitle,
            context.episodeNumber,
            context.episodeTitle,
            context.seriesSlug,
          )
        : buildShortFilmShareMessage(context.title, context.filmSlug);

    void Share.share({ message }).catch(() => undefined);
  }, [context]);

  const accessToken = session?.access_token;
  const allowedChaiAmounts = shortFilmChai?.allowedCoinAmounts ?? [];

  const openChaiSheet = useCallback(async () => {
    if (context.type !== "SHORT_FILM" || !shortFilm || !shortFilmChai) {
      return;
    }

    const nextAmount = shortFilmChai.allowedCoinAmounts[0] ?? null;
    setSelectedChaiAmount(nextAmount);
    setChaiSubmitState("idle");
    setChaiError(null);
    setIsChaiSheetOpen(true);

    if (!accessToken) {
      setWalletBalance(null);
      return;
    }

    try {
      const wallet = await getWallet(accessToken);
      setWalletBalance(wallet.balance);
    } catch {
      setWalletBalance(null);
    }
  }, [accessToken, context.type, shortFilm, shortFilmChai]);

  const handleChaiSubmit = useCallback(async () => {
    if (context.type !== "SHORT_FILM" || !shortFilm || !shortFilmChai || !selectedChaiAmount) {
      return;
    }

    if (!accessToken) {
      navigation.navigate("SignIn");
      return;
    }

    const nextAmount = selectedChaiAmount;
    const wallet = await getWallet(accessToken).catch(() => null);
    const currentBalance = wallet?.balance ?? walletBalance ?? 0;

    if (currentBalance < nextAmount) {
      setIsChaiSheetOpen(false);
      navigation.navigate("CoinPurchase", {
        returnToChai: {
          selectedAmount: nextAmount,
          shortFilm,
        },
      });
      return;
    }

    setIsSubmittingChai(true);
    setChaiError(null);
    setChaiSubmitState("idle");

    try {
      const idempotencyKey = createChaiIdempotencyKey();
      const result = await sendShortFilmChaiTip(
        accessToken,
        shortFilm.slug,
        nextAmount,
        idempotencyKey,
      );

      if (result.success || result.status === "already_processed" || result.status === "tip_success") {
        setHasSentChai(true);
        setChaiSubmitState("success");
        setWalletBalance(result.remainingBalance ?? Math.max((walletBalance ?? currentBalance) - nextAmount, 0));
        return;
      }

      if (result.status === "insufficient_balance") {
        setIsChaiSheetOpen(false);
        navigation.navigate("CoinPurchase", {
          returnToChai: {
            selectedAmount: nextAmount,
            shortFilm,
          },
        });
        return;
      }

      throw new Error("Chai send failed");
    } catch {
      setChaiSubmitState("error");
      setChaiError("We couldn't send this Chai right now.");
    } finally {
      setIsSubmittingChai(false);
    }
  }, [accessToken, context.type, navigation, selectedChaiAmount, shortFilm, shortFilmChai, walletBalance]);

  const handleOpenMore = useCallback(() => {
    setIsSubtitleSheetOpen(false);
    setIsEpisodeListOpen(false);
    setIsMoreSheetOpen(true);
    revealControls();
  }, [revealControls]);

  const handleSelectPlaybackRate = useCallback(
    async (rate: number) => {
      selectedPlaybackRateRef.current = rate;
      temporaryPlaybackRateRestoreRef.current = null;
      setPlaybackRate(rate);

      try {
        await setPlaybackSpeedPreference(rate);
      } catch {
        console.warn("Unable to persist playback speed preference.");
      }

      setIsMoreSheetOpen(false);
      revealControls();
    },
    [revealControls, setPlaybackRate],
  );

  useEffect(() => {
    if (
      !subtitlePreferenceLoadedRef.current ||
      sourceLoadCount === 0 ||
      lastAppliedSubtitleSourceLoadRef.current === sourceLoadCount
    ) {
      return;
    }

    if (subtitleTracks.length === 0) {
      if (subtitleTrack !== null) {
        player.subtitleTrack = null;
      }

      lastAppliedSubtitleSourceLoadRef.current = sourceLoadCount;
      return;
    }

    const nextTrack = resolvePreferredSubtitleTrack(subtitleTracks, subtitlePreference);
    const currentTrackId = subtitleTrack
      ? getSubtitleTrackSelectionKey(subtitleTrack)
      : null;
    const nextTrackId = nextTrack ? getSubtitleTrackSelectionKey(nextTrack) : null;

    if (currentTrackId === nextTrackId) {
      lastAppliedSubtitleSourceLoadRef.current = sourceLoadCount;
      return;
    }

    player.subtitleTrack = nextTrack ?? null;
    lastAppliedSubtitleSourceLoadRef.current = sourceLoadCount;
  }, [
    player,
    sourceLoadCount,
    subtitleTrack,
    subtitleTracks,
    subtitlePreference,
  ]);
  /* eslint-enable react-hooks/immutability */

  const handleOpenSubtitles = useCallback(() => {
    if (subtitleTracks.length === 0) {
      return;
    }

    setIsMoreSheetOpen(false);
    setIsSubtitleSheetOpen(true);
    revealControls();
  }, [revealControls, subtitleTracks.length]);

  /* eslint-disable react-hooks/immutability -- expo-video subtitle selection requires mutating the player property. */
  const handleSelectSubtitleTrack = useCallback(
    async (track: (typeof subtitleTracks)[number] | null) => {
      const nextPreference: SubtitlePreference = track
        ? {
            enabled: true,
            preferredLanguageCode: track.language,
          }
        : {
            enabled: false,
            preferredLanguageCode: subtitlePreference.preferredLanguageCode,
          };

      setSubtitlePreferenceState(nextPreference);
      try {
        await setSubtitlePreference(nextPreference);
      } catch {
        console.warn("Unable to persist subtitle preference.");
      }

      player.subtitleTrack = track;
      setIsSubtitleSheetOpen(false);
      revealControls();
    },
    [player, revealControls, subtitlePreference.preferredLanguageCode],
  );
  /* eslint-enable react-hooks/immutability */

  const handleOpenEpisodes = useCallback(() => {
    // Reuses the existing pause() lifecycle; matches how blur already pauses playback.
    wasPlayingBeforeSheetRef.current = controller.isPlaying;
    pause();
    setIsMoreSheetOpen(false);
    setIsEpisodeListOpen(true);
  }, [controller.isPlaying, pause]);

  const closeEpisodeSheet = useCallback(() => {
    setIsEpisodeListOpen(false);

    if (wasPlayingBeforeSheetRef.current) {
      play();
    }
  }, [play]);

  const handleCloseEpisodeList = useCallback(() => {
    closeEpisodeSheet();
  }, [closeEpisodeSheet]);

  const handleSelectEpisode = useCallback(
    (episodeNumber: number) => {
      if (context.type !== "SERIES_EPISODE" || episodeNumber === context.episodeNumber) {
        // Tapping the currently-playing episode is equivalent to closing the sheet.
        closeEpisodeSheet();
        return;
      }

      // Switching episodes does not restore the outgoing episode's play state;
      // the new player instance already autoplays via existing controller lifecycle.
      setIsEpisodeListOpen(false);
      // Reuses the existing progress-save path (same one blur/beforeRemove already use)
      // before handing off to the existing episode-switch mechanism.
      void progressSync.saveNow().then(() => {
        onSelectEpisode?.(episodeNumber);
      });
    },
    [closeEpisodeSheet, context, onSelectEpisode, progressSync],
  );

  useEffect(() => {
    if (!isEpisodeListOpen) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeEpisodeSheet();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [closeEpisodeSheet, isEpisodeListOpen]);

  const handleSideTap = (side: "left" | "right") => {
    const now = Date.now();
    const previousTap = lastTapRef.current;
    const isDoubleTap =
      previousTap?.side === side && now - previousTap.timestamp < DOUBLE_TAP_DELAY_MS;

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (isDoubleTap) {
      seekBy(side === "left" ? -SEEK_SECONDS : SEEK_SECONDS);
      revealControls();
      lastTapRef.current = null;
      return;
    }

    lastTapRef.current = { side, timestamp: now };
    singleTapTimerRef.current = setTimeout(() => {
      toggleControls();
      singleTapTimerRef.current = null;
    }, DOUBLE_TAP_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  const eyebrow =
    context.type === "SERIES_EPISODE" ? `Episode ${context.episodeNumber}` : "Short Film";

  const title = context.type === "SERIES_EPISODE" ? context.seriesTitle : context.title;
  const canOpenChaiSheet =
    context.type === "SHORT_FILM" &&
    !!shortFilm &&
    !!shortFilmChai &&
    shortFilmChai.available &&
    allowedChaiAmounts.length > 0 &&
    !hasSentChai &&
    !controller.hasEnded;
  const shouldRevealChai =
    canOpenChaiSheet &&
    isInChaiRevealWindow(controller.duration, controller.currentTime);

  const revealedChai = shouldRevealChai;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Reverts to the app-level status bar automatically on unmount. */}
      <StatusBar hidden />
      <View style={styles.shell}>
        <View style={styles.videoViewport}>
          {shouldShowTransitionCover || shouldShowTerminalGuard ? (
            <View pointerEvents="none" style={styles.autoAdvanceScrim} />
          ) : (
            <>
              <VideoView
                allowsPictureInPicture={false}
                contentFit="cover"
                nativeControls={false}
                player={controller.player}
                style={styles.video}
                surfaceType="textureView"
              />

              <View pointerEvents="box-none" style={styles.overlayLayer}>
                <View style={styles.touchLayer}>
                  <Pressable
                    accessibilityLabel="Seek backward 10 seconds or show controls"
                    accessibilityRole="button"
                    onPress={() => handleSideTap("left")}
                    style={styles.tapZone}
                  />
                  <Pressable
                    accessibilityLabel="Seek forward 10 seconds, or press and hold for 1.5x playback"
                    accessibilityRole="button"
                    onLongPress={() => {
                      // Holding while already at/above the hold rate would unexpectedly
                      // slow playback down on release; skip the temporary override then.
                      if (selectedPlaybackRateRef.current >= HOLD_RATE) {
                        return;
                      }

                      longPressRef.current = true;
                      temporaryPlaybackRateRestoreRef.current = selectedPlaybackRateRef.current;
                      controller.setTemporaryRate(HOLD_RATE);
                      setIsHoldFastPlayActive(true);
                      revealControls();
                    }}
                    onPress={() => {
                      if (!longPressRef.current) {
                        handleSideTap("right");
                      }
                    }}
                    onPressOut={() => {
                      if (temporaryPlaybackRateRestoreRef.current !== null) {
                        const restoreRate = temporaryPlaybackRateRestoreRef.current;
                        temporaryPlaybackRateRestoreRef.current = null;
                        setPlaybackRate(restoreRate);
                      }

                      setIsHoldFastPlayActive(false);
                      longPressRef.current = false;
                    }}
                    style={styles.tapZone}
                  />
                </View>

                {isHoldFastPlayActive ? (
                  <View pointerEvents="none" style={styles.fastPlayIndicatorWrapper}>
                    <View style={styles.fastPlayIndicator}>
                      <Text style={styles.fastPlayIndicatorText}>
                        {formatPlaybackSpeed(HOLD_RATE)} {"\u00BB"}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {controller.isBuffering ? (
                  <View pointerEvents="none" style={styles.loadingOverlay}>
                    <ActivityIndicator color="#00E5CC" />
                  </View>
                ) : null}

                {controller.hasEnded && isPreviewMode ? (
                  <View pointerEvents="box-none" style={styles.previewEndedOverlay}>
                    <View pointerEvents="none" style={styles.previewEndedScrim} />
                    <View style={styles.previewEndedContent}>
                      <Text style={styles.previewEndedTitle}>Preview ended</Text>
                      <Text style={styles.previewEndedBody}>
                        Locked options are still available for this episode.
                      </Text>
                      <Pressable
                        accessibilityLabel="See options"
                        accessibilityRole="button"
                        onPress={() => {
                          if (onSeeOptions) {
                            onSeeOptions();
                            return;
                          }

                          navigation.goBack();
                        }}
                        style={({ pressed }) => [styles.previewEndedButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.previewEndedButtonText}>See Options</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : controller.hasEnded && !isAutoAdvancing && context.type === "SERIES_EPISODE" ? (
                  <View pointerEvents="box-none" style={styles.endedOverlay}>
                    <View pointerEvents="none" style={styles.endedTopScrim} />
                    <View pointerEvents="none" style={styles.endedBottomScrim} />
                    <View style={styles.endedContent}>
                      <Text style={styles.endedTitle}>{getEndedTitle(context)}</Text>
                      <Text style={styles.endedBody}>{getEndedBody(context)}</Text>
                      <View style={styles.endedActions}>
                        <Pressable
                          accessibilityLabel="Replay current video"
                          accessibilityRole="button"
                          onPress={handleReplay}
                          style={({ pressed }) => [styles.endedButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.endedButtonText}>Replay</Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel="Exit video player"
                          accessibilityRole="button"
                          onPress={() => navigation.goBack()}
                          style={({ pressed }) => [styles.endedButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.endedButtonText}>Back</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ) : null}

                {canOpenChaiSheet && revealedChai ? (
                  <Pressable
                    accessibilityLabel="Send Chai"
                    accessibilityRole="button"
                    onPress={() => {
                      void openChaiSheet();
                    }}
                    style={({ pressed }) => [styles.chaiButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.chaiButtonText}>Send Chai</Text>
                  </Pressable>
                ) : null}

                {controller.status === "error" ? (
                  <View style={styles.errorPanel}>
                    <Text style={styles.errorTitle}>Playback is unavailable</Text>
                    <Text style={styles.errorBody}>
                      We couldn&apos;t play this right now. Try again.
                    </Text>
                    <Pressable
                      accessibilityLabel="Retry video playback"
                      accessibilityRole="button"
                      onPress={() => {
                        if (onRetryPlayback) {
                          onRetryPlayback();
                          return;
                        }

                        void controller.retry();
                      }}
                      style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.retryText}>Retry</Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel="Exit video player"
                      accessibilityRole="button"
                      onPress={() => navigation.goBack()}
                      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.secondaryText}>Back</Text>
                    </Pressable>
                  </View>
                ) : null}

                {areControlsVisible && !controller.hasEnded ? (
                  <PlayerControls
                    bufferedPosition={controller.bufferedPosition}
                    currentTime={controller.currentTime}
                    duration={controller.duration}
                    hasEnded={controller.hasEnded}
                    isFastPlayActive={isHoldFastPlayActive}
                    isPlaying={controller.isPlaying}
                    onBack={handleBack}
                    onOpenEpisodes={handleOpenEpisodes}
                    onOpenMore={handleOpenMore}
                    onPlayPause={handlePlayPause}
                    onReplay={controller.replay}
                    onSeekTo={handleSeekTo}
                    onShare={handleShare}
                    showEpisodesControl={showEpisodesControl}
                    subtitle={eyebrow}
                    title={title}
                  />
                ) : null}

                {isSubtitleSheetOpen && subtitleTracks.length > 0 ? (
                  <SubtitleTrackSheet
                    currentTrack={subtitleTrack}
                    onClose={() => setIsSubtitleSheetOpen(false)}
                    onSelectTrack={(track) => {
                      void handleSelectSubtitleTrack(track);
                    }}
                    tracks={subtitleTracks}
                  />
                ) : null}

                {isMoreSheetOpen ? (
                  <PlayerMoreSheet
                    captionsAvailable={subtitlesAvailable}
                    captionsValue={
                      isSubtitlesEnabled && subtitleTrack ? getSubtitleTrackLabel(subtitleTrack) : "Off"
                    }
                    currentPlaybackRate={playbackRate}
                    onClose={() => setIsMoreSheetOpen(false)}
                    onOpenCaptions={handleOpenSubtitles}
                    onSelectPlaybackRate={(rate) => {
                      void handleSelectPlaybackRate(rate);
                    }}
                  />
                ) : null}

                {isChaiSheetOpen && context.type === "SHORT_FILM" && shortFilm ? (
                  <Modal animationType="slide" transparent visible={isChaiSheetOpen}>
                    <Pressable
                      onPress={() => setIsChaiSheetOpen(false)}
                      style={styles.chaiSheetBackdrop}
                    >
                      <Pressable onPress={() => undefined} style={styles.chaiSheet}>
                        <View style={styles.chaiSheetHeader}>
                          <Text style={styles.chaiSheetTitle}>Send Chai</Text>
                          <Pressable
                            accessibilityLabel="Close Chai sheet"
                            accessibilityRole="button"
                            onPress={() => setIsChaiSheetOpen(false)}
                            style={styles.closeChaiButton}
                          >
                            <Text style={styles.closeChaiText}>Done</Text>
                          </Pressable>
                        </View>

                        {chaiSubmitState === "success" ? (
                          <View style={styles.chaiSuccessBlock}>
                            <Text style={styles.chaiSuccessTitle}>Chai sent</Text>
                            <Text style={styles.chaiSuccessBody}>
                              Your support is on the way to this creator.
                            </Text>
                            <Pressable
                              accessibilityLabel="Close Chai success"
                              accessibilityRole="button"
                              onPress={() => setIsChaiSheetOpen(false)}
                              style={({ pressed }) => [styles.primaryActionButton, pressed && styles.pressed]}
                            >
                              <Text style={styles.primaryActionText}>Back</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <>
                            <Text style={styles.chaiSheetBody}>
                              {walletBalance !== null
                                ? `Wallet: ${walletBalance} coins`
                                : "Choose the amount you want to send."}
                            </Text>
                            <View style={styles.chaiAmountGrid}>
                              {allowedChaiAmounts.map((amount) => (
                                <Pressable
                                  accessibilityLabel={`Select ${amount} coins`}
                                  accessibilityRole="button"
                                  key={amount}
                                  onPress={() => setSelectedChaiAmount(amount)}
                                  style={({ pressed }) => [
                                    styles.chaiAmountButton,
                                    selectedChaiAmount === amount && styles.chaiAmountButtonSelected,
                                    pressed && styles.pressed,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.chaiAmountText,
                                      selectedChaiAmount === amount && styles.chaiAmountTextSelected,
                                    ]}
                                  >
                                    {amount}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>

                            {chaiError ? <Text style={styles.chaiErrorText}>{chaiError}</Text> : null}

                            <Pressable
                              accessibilityLabel="Send selected Chai"
                              accessibilityRole="button"
                              disabled={isSubmittingChai || selectedChaiAmount === null}
                              onPress={() => {
                                void handleChaiSubmit();
                              }}
                              style={({ pressed }) => [
                                styles.primaryActionButton,
                                (isSubmittingChai || selectedChaiAmount === null) && styles.primaryActionButtonDisabled,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text style={styles.primaryActionText}>
                                {isSubmittingChai ? "Sending..." : `Send ${selectedChaiAmount ?? "Chai"}`}
                              </Text>
                            </Pressable>
                          </>
                        )}
                      </Pressable>
                    </Pressable>
                  </Modal>
                ) : null}

                {isEpisodeListOpen && context.type === "SERIES_EPISODE" && episodes && episodeAccess ? (
                  <EpisodeListSheet
                    key={`${context.seriesSlug}:${context.episodeNumber}`}
                    currentEpisodeNumber={context.episodeNumber}
                    episodeAccess={episodeAccess}
                    episodes={episodes}
                    onClose={handleCloseEpisodeList}
                    onSelectEpisode={handleSelectEpisode}
                    seriesTitle={context.seriesTitle}
                  />
                ) : null}
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050A0A",
  },
  shell: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#050A0A",
    justifyContent: "center",
  },
  videoViewport: {
    aspectRatio: 9 / 16,
    backgroundColor: "#000000",
    maxHeight: "100%",
    overflow: "hidden",
    width: "100%",
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  autoAdvanceScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#050505",
  },
  overlayLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  touchLayer: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
  },
  tapZone: {
    flex: 1,
  },
  fastPlayIndicatorWrapper: {
    alignItems: "flex-end",
    position: "absolute",
    right: 18,
    top: "28%",
  },
  fastPlayIndicator: {
    backgroundColor: "rgba(5, 10, 10, 0.55)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fastPlayIndicatorText: {
    color: "#00E5CC",
    fontSize: 13,
    fontWeight: "800",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  previewEndedOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 86,
    paddingHorizontal: 20,
  },
  previewEndedScrim: {
    backgroundColor: "rgba(5, 10, 10, 0.78)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  previewEndedContent: {
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  previewEndedTitle: {
    color: "#F4FFFD",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  previewEndedBody: {
    color: "#A8B9B6",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  previewEndedButton: {
    alignItems: "center",
    borderColor: "rgba(0, 229, 204, 0.72)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 132,
    paddingHorizontal: 16,
  },
  previewEndedButtonText: {
    color: "#00E5CC",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  endedOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 92,
    paddingHorizontal: 24,
  },
  endedTopScrim: {
    backgroundColor: "rgba(5, 10, 10, 0.24)",
    height: "42%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  endedBottomScrim: {
    backgroundColor: "rgba(5, 10, 10, 0.76)",
    bottom: 0,
    height: "58%",
    left: 0,
    position: "absolute",
    right: 0,
  },
  endedContent: {
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  endedTitle: {
    color: "#F4FFFD",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  endedBody: {
    color: "#A8B9B6",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  endedActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    paddingTop: 4,
  },
  endedButton: {
    alignItems: "center",
    borderColor: "rgba(0, 229, 204, 0.72)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 104,
    paddingHorizontal: 14,
  },
  endedButtonText: {
    color: "#00E5CC",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  chaiButton: {
    alignItems: "center",
    backgroundColor: "rgba(5, 10, 10, 0.7)",
    borderColor: "rgba(0, 229, 204, 0.35)",
    borderRadius: 14,
    borderWidth: 1,
    bottom: 98,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 10,
    position: "absolute",
  },
  chaiButtonText: {
    color: "#F4FFFD",
    fontSize: 13,
    fontWeight: "800",
  },
  chaiSheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(5, 10, 10, 0.58)",
    justifyContent: "flex-end",
  },
  chaiSheet: {
    backgroundColor: "#111414",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
  },
  chaiSheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  chaiSheetTitle: {
    color: "#F4FFFD",
    fontSize: 20,
    fontWeight: "900",
  },
  closeChaiButton: {
    paddingVertical: 4,
  },
  closeChaiText: {
    color: "#00E5CC",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  chaiSheetBody: {
    color: "#A8B9B6",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  chaiAmountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  chaiAmountButton: {
    alignItems: "center",
    backgroundColor: "#1A1F1F",
    borderColor: "rgba(0, 229, 204, 0.4)",
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: "30%",
    justifyContent: "center",
    minHeight: 54,
  },
  chaiAmountButtonSelected: {
    backgroundColor: "rgba(0, 229, 204, 0.12)",
    borderColor: "#00E5CC",
  },
  chaiAmountText: {
    color: "#F4FFFD",
    fontSize: 16,
    fontWeight: "800",
  },
  chaiAmountTextSelected: {
    color: "#00E5CC",
  },
  chaiErrorText: {
    color: "#FF8A8A",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  primaryActionButton: {
    alignItems: "center",
    backgroundColor: "#00E5CC",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryActionButtonDisabled: {
    opacity: 0.5,
  },
  primaryActionText: {
    color: "#050A0A",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  chaiSuccessBlock: {
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
  },
  chaiSuccessTitle: {
    color: "#F4FFFD",
    fontSize: 20,
    fontWeight: "900",
  },
  chaiSuccessBody: {
    color: "#A8B9B6",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  errorPanel: {
    flex: 1,
    alignItems: "center",
    gap: 16,
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    color: "#F4FFFD",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  errorBody: {
    color: "#A8B9B6",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#00E5CC",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 128,
    paddingHorizontal: 18,
  },
  retryText: {
    color: "#050A0A",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
  },
  secondaryText: {
    color: "#D8EDE9",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  pressed: {
    opacity: 0.78,
  },
});

function getEndedTitle(context: PlaybackContext) {
  if (context.type === "SHORT_FILM") {
    return "Playback complete";
  }

  if (context.hasUnreleasedNextEpisode) {
    return "More episodes coming soon";
  }

  if (context.hasLockedNextEpisode) {
    return "Next episode is locked";
  }

  return "Episode complete";
}

function getEndedBody(context: PlaybackContext) {
  if (context.type === "SHORT_FILM") {
    return "Replay now, or return when the short-film completion handoff is ready.";
  }

  if (context.hasUnreleasedNextEpisode) {
    return "The next episode isn't released yet. Replay this one, or check back soon.";
  }

  if (context.hasLockedNextEpisode) {
    return "Replay this episode, or unlock the next one from the series page.";
  }

  return "Replay this episode whenever you are ready.";
}
