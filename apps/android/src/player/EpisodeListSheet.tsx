import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ApiEpisode, EpisodeAccess } from "../types/api";

type EpisodeListSheetProps = {
  currentEpisodeNumber: number;
  episodeAccess: Record<string, EpisodeAccess>;
  episodes: ApiEpisode[];
  onClose: () => void;
  onSelectEpisode: (episodeNumber: number) => void;
  seriesTitle: string;
};

const RANGE_SIZE = 50;

export function EpisodeListSheet({
  currentEpisodeNumber,
  episodeAccess,
  episodes,
  onClose,
  onSelectEpisode,
  seriesTitle,
}: EpisodeListSheetProps) {
  const { width } = useWindowDimensions();
  const columns = width >= 420 ? 6 : 5;
  const cellSize = Math.floor((width - 36 - (columns - 1) * 8) / columns);
  const ranges = useMemo(() => chunkRanges(episodes.length, RANGE_SIZE), [episodes.length]);
  const [selectedRangeStart, setSelectedRangeStart] = useState(() =>
    getRangeStartForEpisode(currentEpisodeNumber),
  );

  const visibleEpisodes = useMemo(() => {
    const startIndex = Math.max(0, selectedRangeStart - 1);
    return episodes.slice(startIndex, startIndex + RANGE_SIZE);
  }, [episodes, selectedRangeStart]);

  return (
    <View pointerEvents="auto" style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Episodes</Text>
          <Pressable
            accessibilityLabel="Close episode list"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <Text numberOfLines={1} style={styles.seriesTitle}>
          {seriesTitle}
        </Text>

        {ranges.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rangeRow}
          >
            {ranges.map((range) => {
              const isSelected = range.start === selectedRangeStart;

              return (
                <Pressable
                  key={`${range.start}-${range.end}`}
                  accessibilityLabel={`Show episodes ${range.start} to ${range.end}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedRangeStart(range.start)}
                  style={({ pressed }) => [
                    styles.rangeChip,
                    isSelected && styles.rangeChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.rangeText, isSelected && styles.rangeTextSelected]}>
                    {`${range.start}-${range.end}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <FlatList
          contentContainerStyle={styles.grid}
          data={visibleEpisodes}
          keyExtractor={(episode) => String(episode.number)}
          numColumns={columns}
          renderItem={({ item }) => {
            const access = episodeAccess[String(item.number)];
            const isPlaying = item.number === currentEpisodeNumber;
            const isPlayable = access?.canWatch === true;
            const isLocked = !isPlayable;
            const coinLabel =
              item.coinUnlockEnabled && item.coinPrice > 0 ? `${item.coinPrice}` : null;

            return (
              <Pressable
                accessibilityLabel={buildEpisodeA11yLabel(item, access, isPlaying)}
                accessibilityRole="button"
                accessibilityState={{ selected: isPlaying, disabled: isLocked }}
                onPress={() => onSelectEpisode(item.number)}
                style={({ pressed }) => [
                  styles.cell,
                  { height: cellSize, width: cellSize },
                  isPlaying && styles.cellPlaying,
                  isLocked && styles.cellLocked,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.cellNumber, isPlaying && styles.cellNumberPlaying]}>
                  {item.number}
                </Text>
                {isLocked ? (
                  <Text style={styles.cellMeta}>
                    {coinLabel ? `${coinLabel} coins` : "Locked"}
                  </Text>
                ) : (
                  <Text style={styles.cellMeta}>{access?.label ?? "Playable"}</Text>
                )}
                {coinLabel && isLocked ? <Text style={styles.coinPill}>{coinLabel}</Text> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

function chunkRanges(total: number, size: number) {
  const ranges: { start: number; end: number }[] = [];

  for (let start = 1; start <= total; start += size) {
    ranges.push({ start, end: Math.min(total, start + size - 1) });
  }

  return ranges;
}

function getRangeStartForEpisode(episodeNumber: number) {
  return Math.floor((Math.max(1, episodeNumber) - 1) / RANGE_SIZE) * RANGE_SIZE + 1;
}

function buildEpisodeA11yLabel(
  episode: ApiEpisode,
  access: EpisodeAccess | undefined,
  isPlaying: boolean,
) {
  const status = access?.label ?? "Locked";
  const coinText =
    episode.coinUnlockEnabled && episode.coinPrice > 0 ? ` Unlock with ${episode.coinPrice} coins.` : "";

  return `Episode ${episode.number}: ${episode.title}. ${status}.${isPlaying ? " Now playing." : ""}${coinText}`;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(3, 6, 6, 0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "rgba(5, 10, 10, 0.98)",
    borderColor: "rgba(244, 255, 253, 0.14)",
    borderTopWidth: 1,
    maxHeight: "46%",
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
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
  pressed: {
    opacity: 0.78,
  },
  seriesTitle: {
    color: "#A8B9B6",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase",
  },
  rangeRow: {
    gap: 8,
    paddingBottom: 10,
    paddingTop: 12,
  },
  rangeChip: {
    alignItems: "center",
    borderColor: "rgba(244, 255, 253, 0.12)",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
  },
  rangeChipSelected: {
    backgroundColor: "rgba(0, 229, 204, 0.12)",
    borderColor: "#00E5CC",
  },
  rangeText: {
    color: "#A8B9B6",
    fontSize: 12,
    fontWeight: "700",
  },
  rangeTextSelected: {
    color: "#00E5CC",
  },
  grid: {
    gap: 8,
    paddingBottom: 6,
  },
  cell: {
    alignItems: "center",
    borderColor: "rgba(244, 255, 253, 0.12)",
    borderWidth: 1,
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },
  cellPlaying: {
    backgroundColor: "rgba(0, 229, 204, 0.12)",
    borderColor: "#00E5CC",
  },
  cellLocked: {
    opacity: 0.55,
  },
  cellNumber: {
    color: "#F4FFFD",
    fontSize: 18,
    fontWeight: "800",
  },
  cellNumberPlaying: {
    color: "#00E5CC",
  },
  cellMeta: {
    color: "#A8B9B6",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
    textTransform: "uppercase",
  },
  coinPill: {
    color: "#00E5CC",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
  },
});
