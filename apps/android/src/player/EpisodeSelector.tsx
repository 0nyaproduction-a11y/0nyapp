import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PlaybackEpisodeSummary } from "./types";

type EpisodeSelectorProps = {
  currentEpisodeNumber: number;
  episodes: PlaybackEpisodeSummary[];
  onClose: () => void;
  onSelectEpisode: (episodeNumber: number) => void;
  visible: boolean;
};

// Presentation only: access/lock state comes entirely from server-derived
// PlaybackEpisodeSummary entries. No entitlement is calculated here.
export function EpisodeSelector({
  currentEpisodeNumber,
  episodes,
  onClose,
  onSelectEpisode,
  visible,
}: EpisodeSelectorProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable
        accessibilityLabel="Close episode list"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.backdrop}
      >
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Episodes</Text>
          <ScrollView contentContainerStyle={styles.list}>
            {episodes.map((item) => (
              <EpisodeRow
                current={item.number === currentEpisodeNumber}
                episode={item}
                key={item.number}
                onPress={() => {
                  if (item.number === currentEpisodeNumber) {
                    onClose();
                    return;
                  }

                  if (item.canWatch) {
                    onSelectEpisode(item.number);
                    onClose();
                  }
                }}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EpisodeRow({
  current,
  episode,
  onPress,
}: {
  current: boolean;
  episode: PlaybackEpisodeSummary;
  onPress: () => void;
}) {
  const locked = !episode.canWatch;

  return (
    <Pressable
      accessibilityLabel={`Episode ${episode.number}, ${episode.title}${
        locked ? ", locked" : current ? ", now playing" : ""
      }`}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked, selected: current }}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        current && styles.rowCurrent,
        locked && styles.rowLocked,
        pressed && !locked && styles.rowPressed,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>
          {episode.number}. {episode.title}
        </Text>
        <Text style={styles.rowMeta}>
          {[episode.runtime, current ? "Now playing" : episode.accessLabel]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      {locked ? <Text style={styles.lockBadge}>Locked</Text> : null}
    </Pressable>
  );
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
  row: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowCurrent: {
    backgroundColor: "rgba(0, 229, 204, 0.14)",
  },
  rowLocked: {
    opacity: 0.55,
  },
  rowPressed: {
    backgroundColor: "rgba(216, 237, 233, 0.1)",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: "#F4FFFD",
    fontSize: 14,
    fontWeight: "800",
  },
  rowMeta: {
    color: "#A8B9B6",
    fontSize: 12,
    fontWeight: "600",
  },
  lockBadge: {
    color: "#A8B9B6",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 12,
    textTransform: "uppercase",
  },
});
