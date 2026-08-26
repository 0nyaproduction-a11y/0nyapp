import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { getEpisodeAccessDisplay, type EpisodeAccessDisplay } from "../lib/episodeAccessDisplay";
import {
  buildEpisodeRanges,
  EPISODE_RANGE_SIZE,
  getEpisodesInRange,
  getInitialEpisodeRangeStart,
} from "../lib/episodeRanges";
import { borders, colors } from "../theme/tokens";
import type { ApiEpisode, EpisodeAccess } from "../types/api";

type EpisodeListSheetProps = {
  currentEpisodeNumber: number;
  episodeAccess: Record<string, EpisodeAccess>;
  episodes: ApiEpisode[];
  onClose: () => void;
  onSelectEpisode: (episodeNumber: number) => void;
  seriesTitle: string;
};

const GRID_GAP = 8;
const SHEET_HORIZONTAL_PADDING = 16;
const TOUCH_TARGET_MIN = 48;
const MIN_COLUMNS = 3;
const PREFERRED_COLUMNS = 5;

export function EpisodeListSheet({
  currentEpisodeNumber,
  episodeAccess,
  episodes,
  onClose,
  onSelectEpisode,
  seriesTitle,
}: EpisodeListSheetProps) {
  const { width } = useWindowDimensions();
  const columns = useMemo(() => getColumnsForWidth(width), [width]);
  const cellSize = Math.max(
    TOUCH_TARGET_MIN,
    Math.floor(
      (width - SHEET_HORIZONTAL_PADDING * 2 - (columns - 1) * GRID_GAP) / columns,
    ),
  );
  const ranges = useMemo(() => buildEpisodeRanges(episodes, EPISODE_RANGE_SIZE), [episodes]);
  const initialRangeStart = useMemo(
    () => getInitialEpisodeRangeStart(episodes, currentEpisodeNumber),
    [currentEpisodeNumber, episodes],
  );
  const [selectedRangeStart, setSelectedRangeStart] = useState<number | null>(null);
  const activeRangeStart =
    ranges.some((range) => range.start === selectedRangeStart)
      ? selectedRangeStart
      : initialRangeStart;
  const selectedRange =
    ranges.find((range) => range.start === activeRangeStart) ?? ranges[0];

  const visibleEpisodes = useMemo(() => {
    return getEpisodesInRange(episodes, selectedRange);
  }, [episodes, selectedRange]);

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
              const isSelected = range.start === activeRangeStart;

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
          key={columns}
          numColumns={columns}
          renderItem={({ index, item }) => {
            const access = episodeAccess[String(item.number)];
            const isPlaying = item.number === currentEpisodeNumber;
            const accessDisplay = getEpisodeAccessDisplay(item, access);

            return (
              <Pressable
                accessibilityLabel={buildEpisodeA11yLabel(item, accessDisplay.label, isPlaying)}
                accessibilityRole="button"
                accessibilityState={{ selected: isPlaying }}
                onPress={() => onSelectEpisode(item.number)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    height: cellSize,
                    marginRight: (index + 1) % columns === 0 ? 0 : GRID_GAP,
                    width: cellSize,
                  },
                  isPlaying && styles.cellPlaying,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.cellNumber, isPlaying && styles.cellNumberPlaying]}>
                  {item.number}
                </Text>
                {renderAccessMarkers(accessDisplay, isPlaying)}
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

function getColumnsForWidth(width: number) {
  const availableWidth = width - SHEET_HORIZONTAL_PADDING * 2;
  const preferredCellSize = Math.floor(
    (availableWidth - (PREFERRED_COLUMNS - 1) * GRID_GAP) / PREFERRED_COLUMNS,
  );

  if (preferredCellSize >= TOUCH_TARGET_MIN) {
    return PREFERRED_COLUMNS;
  }

  for (let columns = PREFERRED_COLUMNS - 1; columns >= MIN_COLUMNS; columns -= 1) {
    const cellSize = Math.floor((availableWidth - (columns - 1) * GRID_GAP) / columns);
    if (cellSize >= TOUCH_TARGET_MIN) {
      return columns;
    }
  }

  return MIN_COLUMNS;
}

function renderAccessMarkers(accessDisplay: EpisodeAccessDisplay, isCurrent: boolean) {
  return (
    <View style={styles.markerRow}>
      {accessDisplay.markers.map((marker) => (
        <View
          key={`${marker.label}-${marker.accessibilityLabel}`}
          style={[
            styles.marker,
            marker.tone === "available" && styles.markerAvailable,
            marker.tone === "locked" && styles.markerLocked,
            isCurrent && styles.markerCurrent,
          ]}
        >
          {marker.icon === "coin" ? <CoinGlyph color={isCurrent ? colors.accent : colors.text} /> : null}
          <Text
            numberOfLines={1}
            style={[
              styles.cellMeta,
              marker.tone === "available" && styles.cellMetaAvailable,
              marker.tone === "locked" && styles.cellMetaLocked,
              isCurrent && styles.cellMetaCurrent,
            ]}
          >
            {marker.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CoinGlyph({ color }: { color: string }) {
  return (
    <View style={[styles.coinGlyph, { borderColor: color }]}>
      <View style={[styles.coinGlyphInner, { backgroundColor: color }]} />
    </View>
  );
}

function buildEpisodeA11yLabel(
  episode: ApiEpisode,
  accessLabel: string,
  isPlaying: boolean,
) {
  return `Episode ${episode.number}: ${episode.title}. ${accessLabel}.${isPlaying ? " Now playing." : ""}`;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(3, 6, 6, 0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderColor: borders.color,
    borderTopWidth: borders.width,
    maxHeight: "46%",
    paddingBottom: 20,
    paddingHorizontal: SHEET_HORIZONTAL_PADDING,
    paddingTop: 14,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: colors.text,
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
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.78,
  },
  seriesTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  rangeRow: {
    gap: 8,
    paddingBottom: 10,
    paddingTop: 12,
  },
  rangeChip: {
    alignItems: "center",
    borderColor: borders.color,
    borderRadius: 6,
    borderWidth: borders.width,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
  },
  rangeChipSelected: {
    backgroundColor: "rgba(13, 209, 188, 0.12)",
    borderColor: colors.accent,
  },
  rangeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  rangeTextSelected: {
    color: colors.accent,
  },
  grid: {
    paddingBottom: 6,
  },
  cell: {
    alignItems: "center",
    borderColor: borders.color,
    borderRadius: 6,
    borderWidth: borders.width,
    justifyContent: "center",
    marginBottom: GRID_GAP,
    paddingHorizontal: 3,
  },
  cellPlaying: {
    backgroundColor: "rgba(13, 209, 188, 0.12)",
    borderColor: colors.accent,
  },
  cellNumber: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  cellNumberPlaying: {
    color: colors.accent,
  },
  markerRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    justifyContent: "center",
    marginTop: 3,
  },
  cellMeta: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
    textAlign: "center",
  },
  cellMetaAvailable: {
    color: colors.text,
  },
  cellMetaLocked: {
    color: colors.muted,
  },
  cellMetaCurrent: {
    color: colors.accent,
  },
  marker: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  markerAvailable: {},
  markerLocked: {},
  markerCurrent: {},
  coinGlyph: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1.3,
    height: 8,
    justifyContent: "center",
    width: 8,
  },
  coinGlyphInner: {
    borderRadius: 999,
    height: 2.5,
    width: 2.5,
  },
});
