import type { VideoPlayerStatus } from "expo-video";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

type PlayerStatusOverlayProps = {
  isBuffering: boolean;
  onExit: () => void;
  onRetry: () => void;
  status: VideoPlayerStatus;
};

// Sanitized, user-facing only; never surfaces the underlying PlayerError/source details.
export function PlayerStatusOverlay({ isBuffering, onExit, onRetry, status }: PlayerStatusOverlayProps) {
  if (status === "error") {
    return (
      <View style={styles.errorPanel}>
        <Text style={styles.errorTitle}>Playback is unavailable</Text>
        <Text style={styles.errorBody}>
          The video could not start. Check your connection and try again.
        </Text>
        <Pressable
          accessibilityLabel="Retry video playback"
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Exit video player"
          accessibilityRole="button"
          onPress={onExit}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (isBuffering) {
    return (
      <View pointerEvents="none" style={styles.loadingOverlay}>
        <ActivityIndicator color="#00E5CC" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
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
