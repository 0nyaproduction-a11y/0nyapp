import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  View,
} from "react-native";
import { colors, radii, typography } from "../theme/tokens";
import { TOP_DOWN_SCRIM_GRADIENT_URI } from "./gradientAssets";

type PlayerControlsProps = {
  bufferedPosition: number;
  currentTime: number;
  duration: number;
  hasEnded: boolean;
  isFastPlayActive?: boolean;
  isPlaying: boolean;
  onBack: () => void;
  onOpenEpisodes?: () => void;
  onOpenMore?: () => void;
  onPlayPause: () => void;
  onReplay: () => void;
  onSeekTo: (seconds: number) => void;
  onShare: () => void;
  showEpisodesControl: boolean;
  title: string;
  subtitle?: string;
};

const DRAG_THRESHOLD = 6;
const THUMB_HOLD_RADIUS = 24;
// Keeps the effective touch target >= ~48dp for a ~38dp visible icon backing.
const ICON_HIT_SLOP = { top: 5, bottom: 5, left: 5, right: 5 };

type TrackMeasurement = {
  pageX: number;
  width: number;
};

export function PlayerControls({
  bufferedPosition,
  currentTime,
  duration,
  hasEnded,
  isFastPlayActive = false,
  isPlaying,
  onBack,
  onOpenEpisodes,
  onOpenMore,
  onPlayPause,
  onReplay,
  onSeekTo,
  onShare,
  showEpisodesControl,
  subtitle,
  title,
}: PlayerControlsProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const hasDraggedRef = useRef(false);
  const gestureStartRef = useRef<{
    startedOnThumb: boolean;
    track: TrackMeasurement;
  } | null>(null);
  const latestValuesRef = useRef({
    currentTime,
    duration,
    onSeekTo,
    trackWidth,
  });
  const trackRef = useRef<View>(null);
  const displayTime = isScrubbing ? scrubPosition : currentTime;
  const progress = duration > 0 ? clampProgress(displayTime / duration) : 0;
  const bufferedProgress = duration > 0 ? clampProgress(bufferedPosition / duration) : 0;

  useEffect(() => {
    latestValuesRef.current = {
      currentTime,
      duration,
      onSeekTo,
      trackWidth,
    };
  }, [currentTime, duration, onSeekTo, trackWidth]);

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(Math.max(event.nativeEvent.layout.width, 1));
  };

  const measureTrack = useCallback((fallbackWidth: number) => {
    return new Promise<TrackMeasurement>((resolve) => {
      trackRef.current?.measure((_x, _y, width, _height, pageX) => {
        const measuredWidth = Number.isFinite(width) && width > 0 ? width : fallbackWidth;
        resolve({
          pageX: Number.isFinite(pageX) ? pageX : 0,
          width: Math.max(measuredWidth, 1),
        });
      });
    });
  }, []);

  const updateScrubPosition = useCallback(
    (screenX: number) => {
      const activeGesture = gestureStartRef.current;
      const nextPosition = activeGesture
        ? getSeekTimeFromScreenX(screenX, activeGesture.track, latestValuesRef.current.duration)
        : null;

      if (nextPosition === null) {
        return null;
      }

      setScrubPosition(nextPosition);
      return nextPosition;
    },
    [],
  );

  const scrubberPanResponder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- PanResponder callbacks read refs during gestures, not during render.
      PanResponder.create({
        onStartShouldSetPanResponder: () => latestValuesRef.current.duration > 0,
        onMoveShouldSetPanResponder: () => latestValuesRef.current.duration > 0,
        onPanResponderGrant: (event) => {
          const {
            currentTime: latestCurrentTime,
            duration: latestDuration,
            trackWidth: latestTrackWidth,
          } = latestValuesRef.current;
          const startX = event.nativeEvent.pageX;

          if (!Number.isFinite(latestDuration) || latestDuration <= 0) {
            return;
          }

          hasDraggedRef.current = false;
          setScrubPosition(latestCurrentTime);
          setIsScrubbing(true);

          void measureTrack(latestTrackWidth).then((track) => {
            const currentProgress = clampProgress(latestCurrentTime / latestDuration);
            const thumbScreenX = track.pageX + currentProgress * track.width;

            gestureStartRef.current = {
              startedOnThumb: Math.abs(startX - thumbScreenX) <= THUMB_HOLD_RADIUS,
              track,
            };
          });
        },
        onPanResponderMove: (_event, gestureState: PanResponderGestureState) => {
          if (!gestureStartRef.current || Math.abs(gestureState.dx) < DRAG_THRESHOLD) {
            return;
          }

          hasDraggedRef.current = true;
          updateScrubPosition(gestureState.moveX);
        },
        onPanResponderRelease: (event, gestureState) => {
          const activeGesture = gestureStartRef.current;
          const { duration: latestDuration, onSeekTo: latestOnSeekTo } = latestValuesRef.current;
          const didDrag = hasDraggedRef.current;

          setIsScrubbing(false);
          hasDraggedRef.current = false;
          gestureStartRef.current = null;

          if (!activeGesture) {
            return;
          }

          if (didDrag) {
            const nextPosition = getSeekTimeFromScreenX(
              gestureState.moveX,
              activeGesture.track,
              latestDuration,
            );

            if (nextPosition !== null) {
              latestOnSeekTo(nextPosition);
            }

            return;
          }

          if (activeGesture.startedOnThumb) {
            return;
          }

          const nextPosition = getSeekTimeFromScreenX(
            event.nativeEvent.pageX,
            activeGesture.track,
            latestDuration,
          );

          if (nextPosition !== null) {
            latestOnSeekTo(nextPosition);
          }
        },
        onPanResponderTerminate: () => {
          setIsScrubbing(false);
          hasDraggedRef.current = false;
          gestureStartRef.current = null;
        },
      }),
    [measureTrack, updateScrubPosition],
  );

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View pointerEvents="none" style={styles.topScrim}>
        <Image resizeMode="stretch" source={{ uri: TOP_DOWN_SCRIM_GRADIENT_URI }} style={styles.scrimImage} />
      </View>
      <View pointerEvents="none" style={[styles.bottomScrim, styles.bottomScrimFlip]}>
        <Image resizeMode="stretch" source={{ uri: TOP_DOWN_SCRIM_GRADIENT_URI }} style={styles.scrimImage} />
      </View>

      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={ICON_HIT_SLOP}
          onPress={onBack}
          style={({ pressed }) => [styles.topIconButton, pressed && styles.pressed]}
        >
          <Text style={styles.backGlyph}>{"\u2039"}</Text>
        </Pressable>

        <View style={styles.topBarTitleColumn}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.topBarActions}>
          <Pressable
            accessibilityLabel="Share"
            accessibilityRole="button"
            hitSlop={ICON_HIT_SLOP}
            onPress={onShare}
            style={({ pressed }) => [styles.topIconButton, pressed && styles.pressed]}
          >
            <ShareGlyph color="#F4FFFD" />
          </Pressable>

          {onOpenMore ? (
            <Pressable
              accessibilityLabel="Playback settings"
              accessibilityRole="button"
              hitSlop={ICON_HIT_SLOP}
              onPress={onOpenMore}
              style={({ pressed }) => [styles.topIconButton, pressed && styles.pressed]}
            >
              <Text style={styles.gearGlyph}>{"\u2699"}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.center}>
        {isFastPlayActive ? null : (
          <Pressable
            accessibilityLabel={hasEnded ? "Replay video" : isPlaying ? "Pause video" : "Play video"}
            accessibilityRole="button"
            onPress={hasEnded ? onReplay : onPlayPause}
            style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
          >
            {hasEnded ? (
              <Text style={styles.replayGlyph}>{"\u21BA"}</Text>
            ) : isPlaying ? (
              <View style={styles.pauseGlyph}>
                <View style={styles.pauseBar} />
                <View style={styles.pauseBar} />
              </View>
            ) : (
              <View style={styles.playGlyph} />
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(displayTime)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
        <View
          {...scrubberPanResponder.panHandlers}
          accessibilityLabel="Seek video"
          accessibilityRole="adjustable"
          onLayout={handleTrackLayout}
          ref={trackRef}
          style={styles.track}
        >
          <View
            pointerEvents="none"
            style={[styles.bufferedTrack, { width: `${bufferedProgress * 100}%` }]}
          />
          <View
            pointerEvents="none"
            style={[styles.progressTrack, { width: `${progress * 100}%` }]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              isScrubbing && styles.thumbActive,
              { left: `${progress * 100}%` },
            ]}
          />
        </View>

        {showEpisodesControl ? (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityLabel="Episodes"
              accessibilityRole="button"
              hitSlop={ICON_HIT_SLOP}
              onPress={onOpenEpisodes}
              style={({ pressed }) => [styles.episodesButton, pressed && styles.pressed]}
            >
              <EpisodesGlyph color="#A8B9B6" />
              <Text style={styles.actionLabel}>Episodes</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function EpisodesGlyph({ color }: { color: string }) {
  return (
    <View style={styles.episodesGlyphBox}>
      <View style={[styles.episodesGlyphDot, styles.episodesGlyphDotTop, { backgroundColor: color }]} />
      <View
        style={[styles.episodesGlyphLine, styles.episodesGlyphLineTop, { backgroundColor: color }]}
      />
      <View
        style={[styles.episodesGlyphDot, styles.episodesGlyphDotMiddle, { backgroundColor: color }]}
      />
      <View
        style={[
          styles.episodesGlyphLine,
          styles.episodesGlyphLineMiddle,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[styles.episodesGlyphDot, styles.episodesGlyphDotBottom, { backgroundColor: color }]}
      />
      <View
        style={[
          styles.episodesGlyphLine,
          styles.episodesGlyphLineBottom,
          { backgroundColor: color },
        ]}
      />
    </View>
  );
}

function ShareGlyph({ color }: { color: string }) {
  return (
    <View style={styles.shareGlyphBox}>
      <View style={[styles.shareGlyphLine, styles.shareGlyphLineTop, { backgroundColor: color }]} />
      <View
        style={[styles.shareGlyphLine, styles.shareGlyphLineBottom, { backgroundColor: color }]}
      />
      <View style={[styles.shareGlyphNode, styles.shareGlyphNodeLeft, { borderColor: color }]} />
      <View
        style={[styles.shareGlyphNode, styles.shareGlyphNodeTopRight, { borderColor: color }]}
      />
      <View
        style={[styles.shareGlyphNode, styles.shareGlyphNodeBottomRight, { borderColor: color }]}
      />
    </View>
  );
}

function getSeekTimeFromScreenX(
  screenX: number,
  track: TrackMeasurement,
  duration: number,
) {
  if (!Number.isFinite(screenX) || !Number.isFinite(track.pageX) || track.width <= 0) {
    return null;
  }

  const relativeX = Math.max(0, Math.min(screenX - track.pageX, track.width));
  return clampSeekTime((relativeX / track.width) * duration, duration);
}

function clampSeekTime(value: number, duration: number) {
  if (!Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return Math.max(0, Math.min(value, duration));
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const roundedSeconds = Math.floor(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainder = roundedSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
  },
  topScrim: {
    height: 120,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  bottomScrim: {
    bottom: 0,
    height: 150,
    left: 0,
    position: "absolute",
    right: 0,
  },
  bottomScrimFlip: {
    transform: [{ scaleY: -1 }],
  },
  scrimImage: {
    height: "100%",
    width: "100%",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  topBarTitleColumn: {
    flex: 1,
    gap: 2,
  },
  topBarActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  topIconButton: {
    alignItems: "center",
    backgroundColor: "rgba(3, 5, 4, 0.45)",
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  backGlyph: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    alignItems: "center",
    backgroundColor: "rgba(3, 5, 4, 0.55)",
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  pressed: {
    opacity: 0.78,
  },
  playGlyph: {
    backgroundColor: "transparent",
    borderBottomColor: "transparent",
    borderBottomWidth: 14,
    borderLeftColor: colors.text,
    borderLeftWidth: 22,
    borderTopColor: "transparent",
    borderTopWidth: 14,
    height: 0,
    marginLeft: 4,
    width: 0,
  },
  pauseGlyph: {
    flexDirection: "row",
    gap: 7,
  },
  pauseBar: {
    backgroundColor: colors.text,
    borderRadius: 1,
    height: 26,
    width: 7,
  },
  replayGlyph: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
  },
  bottomBar: {
    gap: 12,
    paddingBottom: 30,
    paddingHorizontal: 18,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  track: {
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
  },
  bufferedTrack: {
    borderRadius: radii.pill,
    backgroundColor: "rgba(254, 253, 253, 0.22)",
    height: 3,
    position: "absolute",
  },
  progressTrack: {
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    height: 3,
    position: "absolute",
  },
  thumb: {
    backgroundColor: colors.text,
    borderColor: colors.accent,
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    marginLeft: -5,
    position: "absolute",
    width: 10,
  },
  thumbActive: {
    borderRadius: radii.sm,
    height: 16,
    marginLeft: -8,
    width: 16,
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  episodesButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  episodesGlyphBox: {
    height: 14,
    width: 16,
  },
  episodesGlyphDot: {
    borderRadius: 1.5,
    height: 3,
    left: 0,
    position: "absolute",
    width: 3,
  },
  episodesGlyphDotTop: {
    top: 0.5,
  },
  episodesGlyphDotMiddle: {
    top: 5.5,
  },
  episodesGlyphDotBottom: {
    top: 10.5,
  },
  episodesGlyphLine: {
    borderRadius: 1,
    height: 2,
    left: 6,
    position: "absolute",
    width: 10,
  },
  episodesGlyphLineTop: {
    top: 0,
  },
  episodesGlyphLineMiddle: {
    top: 5,
  },
  episodesGlyphLineBottom: {
    top: 10,
  },
  actionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  gearGlyph: {
    color: colors.text,
    fontSize: 21,
  },
  shareGlyphBox: {
    height: 22,
    width: 22,
  },
  shareGlyphLine: {
    height: 1.6,
    position: "absolute",
    width: 15.65,
  },
  shareGlyphLineTop: {
    left: 3.18,
    top: 6.7,
    transform: [{ rotate: "-26.565deg" }],
  },
  shareGlyphLineBottom: {
    left: 3.18,
    top: 13.7,
    transform: [{ rotate: "26.565deg" }],
  },
  shareGlyphNode: {
    backgroundColor: "transparent",
    borderRadius: 3,
    borderWidth: 1.4,
    height: 6,
    position: "absolute",
    width: 6,
  },
  shareGlyphNodeLeft: {
    left: 1,
    top: 8,
  },
  shareGlyphNodeTopRight: {
    left: 15,
    top: 1,
  },
  shareGlyphNodeBottomRight: {
    left: 15,
    top: 15,
  },
});
