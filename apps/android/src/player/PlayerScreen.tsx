import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDevelopmentPlaybackSource } from "./devSources";
import { PlayerControls } from "./PlayerControls";
import { PlayerStatusOverlay } from "./PlayerStatusOverlay";
import { useAutoHideControls } from "./useAutoHideControls";
import { usePlaybackController } from "./usePlaybackController";
import { useWatchProgressSync } from "./useWatchProgressSync";
import { VerticalVideoSurface } from "./VerticalVideoSurface";
import type { PlaybackContext, PlaybackEndedPayload } from "./types";
import type { WatchProgressItem } from "../types/api";

type PlayerScreenProps = {
  accessToken?: string | null;
  context: PlaybackContext;
  onEnded?: (payload: PlaybackEndedPayload) => void;
  onAdvanceToNext?: (
    nextEpisode: NonNullable<Extract<PlaybackContext, { type: "SERIES_EPISODE" }>["nextEpisode"]>,
  ) => void;
  isProgressResolved?: boolean;
  savedProgress?: WatchProgressItem;
};

const DOUBLE_TAP_DELAY_MS = 280;
const SEEK_SECONDS = 10;
const HOLD_RATE = 1.5;
const NORMAL_RATE = 1;

export function PlayerScreen({
  accessToken,
  context,
  isProgressResolved = true,
  onAdvanceToNext,
  onEnded,
  savedProgress,
}: PlayerScreenProps) {
  const navigation = useNavigation();
  const source = useMemo(() => getDevelopmentPlaybackSource(context), [context]);
  const lastTapRef = useRef<{ side: "left" | "right"; timestamp: number } | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef(false);
  const transitionStartedRef = useRef(false);
  const resumeAppliedContextRef = useRef<string | null>(null);
  const progressSyncArmedRef = useRef(false);
  const progressSyncRef = useRef({
    saveFinal: () => Promise.resolve(),
    saveNow: () => Promise.resolve(),
  });
  const contextKey =
    context.type === "SERIES_EPISODE"
      ? `${context.seriesSlug}:${context.episodeNumber}`
      : `film:${context.filmSlug}`;

  const handlePlaybackEnded = useCallback(
    (payload: PlaybackEndedPayload) => {
      void (async () => {
        if (
          context.type === "SERIES_EPISODE" &&
          context.nextEpisode &&
          !transitionStartedRef.current
        ) {
          transitionStartedRef.current = true;
          await progressSyncRef.current.saveFinal();
          onAdvanceToNext?.(context.nextEpisode);
          return;
        }

        await progressSyncRef.current.saveFinal();
        onEnded?.(payload);
      })();
    },
    [context, onAdvanceToNext, onEnded],
  );

  const controller = usePlaybackController({
    context,
    onEnded: handlePlaybackEnded,
    source: source.source,
  });
  const { areControlsVisible, revealControls, toggleControls } = useAutoHideControls(
    controller.isPlaying,
  );
  const { pause, seekBy, setTemporaryRate } = controller;
  const progressSync = useWatchProgressSync({
    accessToken,
    context,
    currentTime: controller.currentTime,
    duration: controller.duration,
    isPlaying: controller.isPlaying,
    isSyncArmedRef: progressSyncArmedRef,
  });

  useEffect(() => {
    progressSyncRef.current = progressSync;
  }, [progressSync]);

  useEffect(() => {
    transitionStartedRef.current = false;
    resumeAppliedContextRef.current = null;
    progressSyncArmedRef.current = false;
  }, [contextKey]);

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener("blur", () => {
      void progressSync.saveNow();
      pause();
      setTemporaryRate(NORMAL_RATE);
    });

    return () => {
      unsubscribeBlur();
    };
  }, [navigation, pause, progressSync, setTemporaryRate]);

  useEffect(() => {
    const unsubscribeBeforeRemove = navigation.addListener("beforeRemove", () => {
      void progressSync.saveNow();
    });

    return () => {
      unsubscribeBeforeRemove();
      void progressSync.saveNow();
    };
  }, [navigation, progressSync]);

  useEffect(() => {
    if (
      context.type !== "SERIES_EPISODE" ||
      resumeAppliedContextRef.current === contextKey ||
      controller.sourceLoadCount === 0 ||
      !isProgressResolved
    ) {
      return;
    }

    const resumePosition = getResumePosition(savedProgress, controller.duration);

    if (resumePosition !== null) {
      controller.seekTo(resumePosition);
    }

    resumeAppliedContextRef.current = contextKey;
    progressSyncArmedRef.current = true;
  }, [
    context.type,
    context,
    contextKey,
    controller,
    controller.duration,
    controller.sourceLoadCount,
    isProgressResolved,
    savedProgress,
  ]);

  const handlePlayPause = useCallback(() => {
    if (controller.isPlaying) {
      void progressSync.saveNow();
    }

    controller.togglePlay();
  }, [controller, progressSync]);

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
    context.type === "SERIES_EPISODE"
      ? `${context.seriesTitle} - Episode ${context.episodeNumber}`
      : "Short Film";

  const title =
    context.type === "SERIES_EPISODE"
      ? context.episodeTitle
      : context.title;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.videoViewport}>
          <VerticalVideoSurface player={controller.player} />

          <View pointerEvents="box-none" style={styles.overlayLayer}>
            <View style={styles.touchLayer}>
              <Pressable
                accessibilityLabel="Seek backward 10 seconds or show controls"
                accessibilityRole="button"
                onLongPress={() => {
                  longPressRef.current = true;
                  controller.setTemporaryRate(HOLD_RATE);
                  revealControls();
                }}
                onPress={() => {
                  if (!longPressRef.current) {
                    handleSideTap("left");
                  }
                }}
                onPressOut={() => {
                  controller.setTemporaryRate(NORMAL_RATE);
                  longPressRef.current = false;
                }}
                style={styles.tapZone}
              />
              <Pressable
                accessibilityLabel="Seek forward 10 seconds or show controls"
                accessibilityRole="button"
                onLongPress={() => {
                  longPressRef.current = true;
                  controller.setTemporaryRate(HOLD_RATE);
                  revealControls();
                }}
                onPress={() => {
                  if (!longPressRef.current) {
                    handleSideTap("right");
                  }
                }}
                onPressOut={() => {
                  controller.setTemporaryRate(NORMAL_RATE);
                  longPressRef.current = false;
                }}
                style={styles.tapZone}
              />
            </View>

            <PlayerStatusOverlay
              isBuffering={controller.isBuffering}
              onExit={() => navigation.goBack()}
              onRetry={controller.retry}
              status={controller.status}
            />

            {controller.hasEnded && !shouldAutoAdvance(context) ? (
              <View pointerEvents="box-none" style={styles.endedOverlay}>
                <View pointerEvents="none" style={styles.endedTopScrim} />
                <View pointerEvents="none" style={styles.endedBottomScrim} />
                <View style={styles.endedContent}>
                  <Text style={styles.endedTitle}>
                    {getEndedTitle(context)}
                  </Text>
                  <Text style={styles.endedBody}>
                    {getEndedBody(context)}
                  </Text>
                  <View style={styles.endedActions}>
                    <Pressable
                      accessibilityLabel="Replay current video"
                      accessibilityRole="button"
                      onPress={controller.replay}
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

            {areControlsVisible && !controller.hasEnded ? (
              <PlayerControls
                bufferedPosition={controller.bufferedPosition}
                currentTime={controller.currentTime}
                duration={controller.duration}
                hasEnded={controller.hasEnded}
                isPlaying={controller.isPlaying}
                onPlayPause={handlePlayPause}
                onReplay={controller.replay}
                onSeekTo={controller.seekTo}
                subtitle={eyebrow}
                title={title}
              />
            ) : null}
          </View>
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
  pressed: {
    opacity: 0.78,
  },
});

function shouldAutoAdvance(context: PlaybackContext) {
  return context.type === "SERIES_EPISODE" && Boolean(context.nextEpisode);
}

function getEndedTitle(context: PlaybackContext) {
  if (context.type === "SHORT_FILM") {
    return "Playback complete";
  }

  if (context.hasLockedNextEpisode) {
    return "Next episode is locked";
  }

  return "Episode complete";
}

function getEndedBody(context: PlaybackContext) {
  if (context.type === "SHORT_FILM") {
    return "Replay now, or continue when Audience Chai and related films are ready.";
  }

  if (context.hasLockedNextEpisode) {
    return "Replay this episode, or unlock the next one from the series page.";
  }

  return "Replay this episode whenever you are ready.";
}

function getResumePosition(progress: WatchProgressItem | undefined, duration: number) {
  if (!progress || progress.completed || progress.positionSeconds <= 0) {
    return null;
  }

  const effectiveDuration = duration > 0 ? duration : progress.durationSeconds;

  if (effectiveDuration > 0 && effectiveDuration - progress.positionSeconds <= 5) {
    return null;
  }

  return Math.max(0, Math.min(progress.positionSeconds, effectiveDuration || progress.positionSeconds));
}
