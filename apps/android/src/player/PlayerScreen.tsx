import { useNavigation } from "@react-navigation/native";
import { VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDevelopmentPlaybackSource } from "./devSources";
import { PlayerControls } from "./PlayerControls";
import { useAutoHideControls } from "./useAutoHideControls";
import { usePlaybackController } from "./usePlaybackController";
import type { PlaybackContext, PlaybackEndedPayload } from "./types";

type PlayerScreenProps = {
  context: PlaybackContext;
  onEnded?: (payload: PlaybackEndedPayload) => void;
  onAdvanceToNext?: (
    nextEpisode: NonNullable<Extract<PlaybackContext, { type: "SERIES_EPISODE" }>["nextEpisode"]>,
  ) => void;
};

const DOUBLE_TAP_DELAY_MS = 280;
const SEEK_SECONDS = 10;
const HOLD_RATE = 1.5;
const NORMAL_RATE = 1;

export function PlayerScreen({ context, onAdvanceToNext, onEnded }: PlayerScreenProps) {
  const navigation = useNavigation();
  const source = useMemo(() => getDevelopmentPlaybackSource(context), [context]);
  const lastTapRef = useRef<{ side: "left" | "right"; timestamp: number } | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef(false);
  const transitionStartedRef = useRef(false);
  const contextKey =
    context.type === "SERIES_EPISODE"
      ? `${context.seriesSlug}:${context.episodeNumber}`
      : `film:${context.filmSlug}`;

  const handlePlaybackEnded = useCallback(
    (payload: PlaybackEndedPayload) => {
      if (
        context.type === "SERIES_EPISODE" &&
        context.nextEpisode &&
        !transitionStartedRef.current
      ) {
        transitionStartedRef.current = true;
        onAdvanceToNext?.(context.nextEpisode);
        return;
      }

      onEnded?.(payload);
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

  useEffect(() => {
    transitionStartedRef.current = false;
  }, [contextKey]);

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener("blur", () => {
      pause();
      setTemporaryRate(NORMAL_RATE);
    });

    return () => {
      unsubscribeBlur();
    };
  }, [navigation, pause, setTemporaryRate]);

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
          <VideoView
            allowsPictureInPicture={false}
            contentFit="contain"
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

            {controller.isBuffering ? (
              <View pointerEvents="none" style={styles.loadingOverlay}>
                <ActivityIndicator color="#00E5CC" />
              </View>
            ) : null}

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

            {controller.status === "error" ? (
              <View style={styles.errorPanel}>
                <Text style={styles.errorTitle}>Playback is unavailable</Text>
                <Text style={styles.errorBody}>
                  The video could not start. Check your connection and try again.
                </Text>
                <Pressable
                  accessibilityLabel="Retry video playback"
                  accessibilityRole="button"
                  onPress={controller.retry}
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
                isPlaying={controller.isPlaying}
                onPlayPause={controller.togglePlay}
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
  video: {
    ...StyleSheet.absoluteFill,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
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
