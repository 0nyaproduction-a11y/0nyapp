import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ApiEpisode, EpisodeAccess } from "../types/api";
import { borders, colors } from "../theme/tokens";

type SeriesEpisodeTrayProps = {
  currentEpisodeNumber?: number;
  episodeAccess: Record<string, EpisodeAccess>;
  episodes: ApiEpisode[];
  onClose: () => void;
  onSelectEpisode: (episode: ApiEpisode) => void;
  seriesTitle: string;
};

const RANGE_SIZE = 25;
const SHEET_HORIZONTAL_PADDING = 16;
const GRID_GAP = 6;
const TOUCH_TARGET_MIN = 44;
const TOUCH_TARGET_MAX = 48;
const MIN_COLUMNS = 5;
const MAX_COLUMNS = 7;
const TRAY_HEIGHT_RATIO = 0.4;
const SHEET_TOP_PADDING = 14;
// Chrome block heights below mirror the actual style values used for those
// rows (see styles below) so the JS height budget matches what really lays
// out on-device instead of guessing.
const HEADER_ROW_HEIGHT = 48;
const SERIES_TITLE_BLOCK_HEIGHT = 20;
const RANGE_STRIP_HEIGHT = 48;
const GRID_VERTICAL_PADDING = 6;
// Real-device font scaling / metrics can nudge the chrome rows a few dp
// taller than the estimate above — pad the budget so the first grid row is
// never clipped.
const CHROME_SAFETY_MARGIN = 12;

function buildRanges(totalEpisodes: number, rangeSize: number) {
  const ranges: { end: number; start: number }[] = [];
  for (let start = 1; start <= totalEpisodes; start += rangeSize) {
    ranges.push({ start, end: Math.min(totalEpisodes, start + rangeSize - 1) });
  }
  return ranges;
}

function getRangeStartForEpisode(episodeNumber: number, totalEpisodes: number) {
  const boundedEpisodeNumber = Math.min(Math.max(1, episodeNumber), totalEpisodes || 1);
  return Math.floor((boundedEpisodeNumber - 1) / RANGE_SIZE) * RANGE_SIZE + 1;
}

// Picks the densest column count (7..5) whose resulting cell still clears the
// minimum accessible touch target, so the grid never clips on narrow phones.
function getColumnsForWidth(width: number) {
  const availableWidth = width - SHEET_HORIZONTAL_PADDING * 2;

  for (let columns = MAX_COLUMNS; columns >= MIN_COLUMNS; columns -= 1) {
    const cellSize = Math.floor((availableWidth - (columns - 1) * GRID_GAP) / columns);
    if (cellSize >= TOUCH_TARGET_MIN) {
      return columns;
    }
  }

  return MIN_COLUMNS;
}

function LockGlyph({ color }: { color: string }) {
  return (
    <View style={styles.lockGlyph}>
      <View style={[styles.lockShackle, { borderColor: color }]} />
      <View style={[styles.lockBody, { backgroundColor: color }]} />
    </View>
  );
}

export function SeriesEpisodeTray({
  currentEpisodeNumber,
  episodeAccess,
  episodes,
  onClose,
  onSelectEpisode,
  seriesTitle,
}: SeriesEpisodeTrayProps) {
  const { height: windowHeight, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columns = useMemo(() => getColumnsForWidth(width), [width]);
  const cellOuterSize = Math.floor(
    (width - SHEET_HORIZONTAL_PADDING * 2 - (columns - 1) * GRID_GAP) / columns,
  );
  const cellVisualSize = Math.max(28, Math.min(TOUCH_TARGET_MAX - 8, cellOuterSize - 10));
  const maxTrayHeight = Math.round(windowHeight * TRAY_HEIGHT_RATIO);
  const sheetBottomPadding = Math.max(20, insets.bottom + 12);

  // Published episodes are the ONLY grid source. episodeAccess is looked up
  // per-episode below purely for the lock/current visual — it never filters
  // or shortens this list.
  const ranges = useMemo(() => buildRanges(episodes.length, RANGE_SIZE), [episodes.length]);
  const [selectedRangeStart, setSelectedRangeStart] = useState(() =>
    getRangeStartForEpisode(currentEpisodeNumber ?? 1, episodes.length),
  );

  const visibleEpisodes = useMemo(() => {
    const startIndex = Math.max(0, selectedRangeStart - 1);
    return episodes.slice(startIndex, startIndex + RANGE_SIZE);
  }, [episodes, selectedRangeStart]);

  // FlatList/ScrollView are given a definite (numeric) parent height so they
  // lay out and virtualize predictably on Android, rather than relying on
  // `maxHeight` + `flexShrink` alone. Every grid row (including the last)
  // carries a trailing margin (see cellTouchArea), so row height budget is
  // `cellOuterSize + GRID_GAP` per row, plus a safety margin for on-device
  // font-metric variance — this guarantees at least one full row is visible.
  const rows = Math.max(1, Math.ceil(visibleEpisodes.length / columns));
  const gridContentHeight = rows * (cellOuterSize + GRID_GAP) + GRID_VERTICAL_PADDING;
  const chromeHeight =
    SHEET_TOP_PADDING +
    HEADER_ROW_HEIGHT +
    SERIES_TITLE_BLOCK_HEIGHT +
    (ranges.length > 1 ? RANGE_STRIP_HEIGHT : 0) +
    sheetBottomPadding +
    CHROME_SAFETY_MARGIN;
  const sheetHeight = Math.min(maxTrayHeight, chromeHeight + gridContentHeight);

  return (
    <View pointerEvents="auto" style={styles.backdrop}>
      <Pressable
        accessibilityLabel="Close episode tray"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.scrimArea}
      />

      <View style={[styles.sheet, { height: sheetHeight, paddingBottom: sheetBottomPadding }]}>
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
            style={styles.rangeStrip}
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
          key={columns}
          contentContainerStyle={styles.grid}
          data={visibleEpisodes}
          keyExtractor={(episode) => String(episode.number)}
          numColumns={columns}
          showsVerticalScrollIndicator={false}
          style={styles.gridList}
          renderItem={({ item }) => {
            const access = episodeAccess[String(item.number)];
            const isCurrent = item.number === currentEpisodeNumber;
            const isLocked = !access?.canWatch;

            return (
              <Pressable
                accessibilityLabel={`Episode ${item.number}${isLocked ? ", locked" : ""}${
                  isCurrent ? ", current episode" : ""
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent }}
                onPress={() => onSelectEpisode(item)}
                style={({ pressed }) => [
                  styles.cellTouchArea,
                  { height: cellOuterSize, width: cellOuterSize },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.cell,
                    { height: cellVisualSize, width: cellVisualSize },
                    isCurrent && styles.cellCurrent,
                  ]}
                >
                  <Text style={[styles.cellNumber, isCurrent && styles.cellNumberCurrent]}>
                    {item.number}
                  </Text>
                  {isLocked ? <LockGlyph color={colors.muted} /> : null}
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    bottom: 0,
    flexDirection: "column",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  scrimArea: {
    backgroundColor: "rgba(3, 6, 6, 0.72)",
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.background,
    borderColor: borders.color,
    borderTopWidth: borders.width,
    paddingHorizontal: SHEET_HORIZONTAL_PADDING,
    paddingTop: SHEET_TOP_PADDING,
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
  rangeStrip: {
    maxHeight: RANGE_STRIP_HEIGHT,
  },
  rangeRow: {
    gap: 8,
    paddingBottom: 6,
    paddingTop: 10,
  },
  rangeChip: {
    alignItems: "center",
    borderColor: borders.color,
    borderWidth: borders.width,
    justifyContent: "center",
    minHeight: 32,
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
  gridList: {
    flex: 1,
  },
  grid: {
    paddingBottom: 4,
    paddingTop: 2,
  },
  cellTouchArea: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: GRID_GAP,
    marginRight: GRID_GAP,
  },
  cell: {
    alignItems: "center",
    borderColor: borders.color,
    borderRadius: 6,
    borderWidth: borders.width,
    justifyContent: "center",
  },
  cellCurrent: {
    borderColor: colors.accent,
  },
  cellNumber: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  cellNumberCurrent: {
    color: colors.accent,
  },
  lockGlyph: {
    alignItems: "center",
    marginTop: 2,
  },
  lockShackle: {
    borderRadius: 2,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderWidth: 1,
    borderBottomWidth: 0,
    height: 3,
    width: 5,
  },
  lockBody: {
    borderRadius: 1,
    height: 4,
    marginTop: -1,
    width: 7,
  },
});
