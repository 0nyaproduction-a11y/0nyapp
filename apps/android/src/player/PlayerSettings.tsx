import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SubtitleTrack, VideoTrack } from "expo-video";

type PlayerSettingsProps = {
  currentSubtitleTrack: SubtitleTrack | null;
  currentVideoTrack: VideoTrack | null;
  onClose: () => void;
  onSelectSubtitleTrack: (track: SubtitleTrack | null) => void;
  subtitleTracks: SubtitleTrack[];
  visible: boolean;
};

// Presentation only: reflects the player's actual track state. Manual video
// quality selection is not offered because the installed expo-video version
// exposes `videoTrack` as read-only (no setter), so quality stays Auto/adaptive.
export function PlayerSettings({
  currentSubtitleTrack,
  currentVideoTrack,
  onClose,
  onSelectSubtitleTrack,
  subtitleTracks,
  visible,
}: PlayerSettingsProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable
        accessibilityLabel="Close playback settings"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.backdrop}
      >
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Playback Settings</Text>
          <ScrollView contentContainerStyle={styles.list}>
            <Text style={styles.sectionTitle}>Subtitles</Text>
            {subtitleTracks.length > 0 ? (
              <>
                <SettingsRow
                  accessibilityLabel="Subtitles off"
                  label="Off"
                  onPress={() => onSelectSubtitleTrack(null)}
                  selected={currentSubtitleTrack === null}
                />
                {subtitleTracks.map((track, index) => {
                  const label = getSubtitleDisplayLabel(track, index);
                  const selected =
                    currentSubtitleTrack !== null &&
                    isSameSubtitleTrack(currentSubtitleTrack, track);

                  return (
                    <SettingsRow
                      accessibilityLabel={`Subtitles ${label}`}
                      key={getSubtitleTrackKey(track, index)}
                      label={label}
                      onPress={() => onSelectSubtitleTrack(track)}
                      selected={selected}
                    />
                  );
                })}
              </>
            ) : (
              <Text style={styles.unavailableText}>Subtitles unavailable</Text>
            )}

            <Text style={styles.sectionTitle}>Quality</Text>
            <View style={styles.qualityRow}>
              <Text style={styles.qualityLabel}>Auto</Text>
              <Text style={styles.qualityMeta}>
                {getResolutionLabel(currentVideoTrack)
                  ? `Adaptive · currently ${getResolutionLabel(currentVideoTrack)}`
                  : "Adaptive · matches your connection"}
              </Text>
            </View>
            <Text style={styles.unavailableText}>
              Manual quality selection isn&apos;t available on this build.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SettingsRow({
  accessibilityLabel,
  label,
  onPress,
  selected,
}: {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      {selected ? <Text style={styles.rowCheck}>✓</Text> : null}
    </Pressable>
  );
}

function isSameSubtitleTrack(a: SubtitleTrack, b: SubtitleTrack) {
  if (a.id !== undefined || b.id !== undefined) {
    return a.id === b.id;
  }

  return a.language === b.language && a.label === b.label;
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function getSubtitleDisplayLabel(track: SubtitleTrack, index: number): string {
  const label = normalizeText(track.label);
  if (label) {
    return label;
  }

  const language = normalizeText(track.language);
  if (language) {
    return language;
  }

  return `Subtitle ${index + 1}`;
}

function getSubtitleTrackKey(track: SubtitleTrack, index: number): string {
  const trackId = normalizeText(track.id);
  if (trackId) {
    return `subtitle:${trackId}`;
  }

  const language = normalizeText(track.language).toLowerCase();
  const label = normalizeText(track.label).toLowerCase();
  const base = [language || "unknown", label || "untitled"].join("|");
  return `subtitle:${base}:${index + 1}`;
}

// Uses the shorter dimension so vertical tracks (e.g. 1080x1920) label
// correctly as "1080p" instead of being read as a 1920p landscape track.
function getResolutionLabel(track: VideoTrack | null): string | null {
  if (!track || !track.size) {
    return null;
  }

  const shortSide = Math.min(track.size.width, track.size.height);

  if (!Number.isFinite(shortSide) || shortSide <= 0) {
    return null;
  }

  return `${shortSide}p`;
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(5, 10, 10, 0.72)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0B1414",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "72%",
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "rgba(216, 237, 233, 0.32)",
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 40,
  },
  heading: {
    color: "#F4FFFD",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  list: {
    gap: 8,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: "#A8B9B6",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 12,
    textTransform: "uppercase",
  },
  row: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowSelected: {
    backgroundColor: "rgba(0, 229, 204, 0.14)",
  },
  rowPressed: {
    backgroundColor: "rgba(216, 237, 233, 0.1)",
  },
  rowLabel: {
    color: "#F4FFFD",
    fontSize: 14,
    fontWeight: "700",
  },
  rowCheck: {
    color: "#00E5CC",
    fontSize: 14,
    fontWeight: "900",
  },
  unavailableText: {
    color: "#A8B9B6",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  qualityRow: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  qualityLabel: {
    color: "#F4FFFD",
    fontSize: 14,
    fontWeight: "700",
  },
  qualityMeta: {
    color: "#A8B9B6",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});
