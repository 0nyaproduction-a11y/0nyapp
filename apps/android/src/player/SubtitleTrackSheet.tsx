import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SubtitleTrack } from "expo-video";
import { getSubtitleTrackLabel, getSubtitleTrackSelectionKey } from "../lib/subtitles";

type SubtitleTrackSheetProps = {
  currentTrack: SubtitleTrack | null;
  onClose: () => void;
  onSelectTrack: (track: SubtitleTrack | null) => void;
  tracks: SubtitleTrack[];
};

export function SubtitleTrackSheet({
  currentTrack,
  onClose,
  onSelectTrack,
  tracks,
}: SubtitleTrackSheetProps) {
  return (
    <View pointerEvents="auto" style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Subtitles</Text>
          <Pressable
            accessibilityLabel="Close subtitles"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <Text style={styles.description}>
          Choose a language or turn subtitles off for this video.
        </Text>

        <Pressable
          accessibilityLabel="Turn subtitles off"
          accessibilityRole="button"
          accessibilityState={{ selected: currentTrack === null }}
          onPress={() => onSelectTrack(null)}
          style={({ pressed }) => [
            styles.option,
            currentTrack === null && styles.optionSelected,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.optionText}>
            <Text style={[styles.optionLabel, currentTrack === null && styles.optionLabelSelected]}>
              Off
            </Text>
            <Text style={styles.optionDetail}>No subtitles</Text>
          </View>
        </Pressable>

        <View style={styles.optionsList}>
          {tracks.map((track) => {
            const isSelected =
              currentTrack !== null &&
              getSubtitleTrackSelectionKey(currentTrack) === getSubtitleTrackSelectionKey(track);
            const label = getSubtitleTrackLabel(track);

            return (
              <Pressable
                key={getSubtitleTrackSelectionKey(track)}
                accessibilityLabel={`Select subtitles ${label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelectTrack(track)}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {label}
                  </Text>
                  <Text style={styles.optionDetail}>
                    {track.language}
                    {track.isDefault ? " • default" : ""}
                    {track.autoSelect ? " • auto-select" : ""}
                  </Text>
                </View>
                <Text style={[styles.optionBadge, isSelected && styles.optionBadgeSelected]}>
                  {track.language}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(3, 6, 6, 0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "rgba(5, 10, 10, 0.98)",
    borderTopColor: "rgba(244, 255, 253, 0.14)",
    borderTopWidth: 1,
    maxHeight: "52%",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#F4FFFD",
    fontSize: 17,
    fontWeight: "800",
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 6,
  },
  closeText: {
    color: "#00E5CC",
    fontSize: 14,
    fontWeight: "700",
  },
  description: {
    color: "#A8B9B6",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  optionsList: {
    gap: 8,
    marginTop: 12,
  },
  option: {
    alignItems: "center",
    borderColor: "rgba(244, 255, 253, 0.12)",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionSelected: {
    backgroundColor: "rgba(0, 229, 204, 0.12)",
    borderColor: "#00E5CC",
  },
  optionText: {
    flex: 1,
    gap: 3,
  },
  optionLabel: {
    color: "#F4FFFD",
    fontSize: 15,
    fontWeight: "700",
  },
  optionLabelSelected: {
    color: "#00E5CC",
  },
  optionDetail: {
    color: "#A8B9B6",
    fontSize: 12,
    lineHeight: 16,
  },
  optionBadge: {
    color: "#A8B9B6",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 12,
    textTransform: "uppercase",
  },
  optionBadgeSelected: {
    color: "#00E5CC",
  },
  pressed: {
    opacity: 0.78,
  },
});
