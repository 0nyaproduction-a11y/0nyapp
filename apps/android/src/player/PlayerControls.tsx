import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  View,
} from "react-native";

type PlayerControlsProps = {
  bufferedPosition: number;
  currentTime: number;
  duration: number;
  hasEnded: boolean;
  isPlaying: boolean;
  onPlayPause: () => void;
  onReplay: () => void;
  onSeekTo: (seconds: number) => void;
  onSettingsPress?: () => void;
  title: string;
  subtitle?: string;
};

const DRAG_THRESHOLD = 6;
const THUMB_HOLD_RADIUS = 24;

type TrackMeasurement = {
  pageX: number;
  width: number;
};

export function PlayerControls({
  bufferedPosition,
  currentTime,
  duration,
  hasEnded,
  isPlaying,
  onPlayPause,
  onReplay,
  onSeekTo,
  onSettingsPress,
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
      <View style={styles.topBar}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onSettingsPress ? (
        <Pressable
          accessibilityLabel="Open playback settings"
          accessibilityRole="button"
          onPress={onSettingsPress}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
        >
          <Text style={styles.settingsGlyph}>⚙</Text>
        </Pressable>
      ) : null}

      <View style={styles.center}>
        <Pressable
          accessibilityLabel={hasEnded ? "Replay video" : isPlaying ? "Pause video" : "Play video"}
          accessibilityRole="button"
          onPress={hasEnded ? onReplay : onPlayPause}
          style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
        >
          <Text style={styles.playText}>{hasEnded ? "Replay" : isPlaying ? "Pause" : "Play"}</Text>
        </Pressable>
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
          <View pointerEvents="none" style={[styles.thumb, { left: `${progress * 100}%` }]} />
        </View>
      </View>
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
  const minutes = Math.floor(roundedSeconds / 60);
  const remainder = roundedSeconds % 60;

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    padding: 18,
  },
  topBar: {
    gap: 4,
    paddingRight: 56,
    paddingTop: 8,
  },
  settingsButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    position: "absolute",
    right: 12,
    top: 8,
  },
  settingsGlyph: {
    color: "#D8EDE9",
    fontSize: 20,
  },
  title: {
    color: "#F4FFFD",
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: "#A8B9B6",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    alignItems: "center",
    borderColor: "#00E5CC",
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(5, 10, 10, 0.78)",
    justifyContent: "center",
    minHeight: 56,
    minWidth: 112,
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.78,
  },
  playText: {
    color: "#00E5CC",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  bottomBar: {
    gap: 10,
    paddingBottom: 12,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    color: "#D8EDE9",
    fontSize: 12,
    fontWeight: "700",
  },
  track: {
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
  },
  bufferedTrack: {
    borderRadius: 999,
    backgroundColor: "rgba(216, 237, 233, 0.28)",
    height: 4,
    position: "absolute",
  },
  progressTrack: {
    borderRadius: 999,
    backgroundColor: "#00E5CC",
    height: 4,
    position: "absolute",
  },
  thumb: {
    backgroundColor: "#F4FFFD",
    borderColor: "#00E5CC",
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    marginLeft: -9,
    position: "absolute",
    width: 18,
  },
});
