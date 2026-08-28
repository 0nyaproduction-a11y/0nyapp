import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getEpisodeAccessDisplay, type EpisodeAccessDisplay } from "../lib/episodeAccessDisplay";
import {
  buildEpisodeRanges,
  EPISODE_RANGE_SIZE,
  getEpisodesInRange,
  getInitialEpisodeRangeStart,
} from "../lib/episodeRanges";
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

const SHEET_HORIZONTAL_PADDING = 16;
const GRID_GAP = 6;
const TOUCH_TARGET_MIN = 48;
const MIN_COLUMNS = 3;
const PREFERRED_COLUMNS = 5;
const PLUS_MARKER_COLOR = "#B91825";
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

// Keeps the normal-phone layout at five columns, then backs off on narrow
// widths so every cell still clears the minimum accessible touch target.
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
  const cellVisualSize = Math.max(TOUCH_TARGET_MIN, cellOuterSize);
  const maxTrayHeight = Math.round(windowHeight * TRAY_HEIGHT_RATIO);
  const sheetBottomPadding = Math.max(20, insets.bottom + 12);

  // Published episodes are the ONLY grid source. episodeAccess is looked up
  // per-episode below purely for the lock/current visual — it never filters
  // or shortens this list.
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
            const accessDisplay = getEpisodeAccessDisplay(item, access);

            return (
              <Pressable
                accessibilityLabel={`Episode ${item.number}, ${accessDisplay.accessibilityLabel}${
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
                  {renderAccessMarkers(accessDisplay, isCurrent)}
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
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
          {marker.icon === "coin" ? <CoinGlyph /> : null}
          <Text
            numberOfLines={1}
            style={[
              styles.cellAccessLabel,
              marker.tone === "available" && styles.cellAccessLabelAvailable,
              marker.tone === "locked" && styles.cellAccessLabelLocked,
              marker.variant === "plus" && styles.cellAccessLabelPlus,
              marker.variant === "ad" && styles.cellAccessLabelAd,
              marker.variant === "coin" && styles.cellAccessLabelCoin,
              isCurrent && styles.cellAccessLabelCurrent,
            ]}
          >
            {marker.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CoinGlyph() {
  return (
    <View style={styles.coinGlyph}>
      <View style={styles.coinGlyphInner} />
      <View style={styles.coinGlyphHighlight} />
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
    gap: 1,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cellCurrent: {
    backgroundColor: "rgba(13, 209, 188, 0.12)",
    borderColor: colors.accent,
  },
  cellNumber: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  cellNumberCurrent: {
    color: colors.accent,
  },
  markerRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    justifyContent: "center",
    marginTop: 2,
  },
  cellAccessLabel: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "700",
    lineHeight: 9,
    textAlign: "center",
  },
  cellAccessLabelAvailable: {
    color: colors.text,
  },
  cellAccessLabelAd: {
    color: colors.muted,
  },
  cellAccessLabelCoin: {
    color: colors.text,
  },
  cellAccessLabelLocked: {
    color: colors.muted,
  },
  cellAccessLabelPlus: {
    color: PLUS_MARKER_COLOR,
  },
  cellAccessLabelCurrent: {
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
    backgroundColor: "#F2B705",
    borderColor: "#F6DD63",
    borderRadius: 999,
    borderWidth: 1.2,
    height: 7,
    justifyContent: "center",
    width: 7,
  },
  coinGlyphInner: {
    backgroundColor: "#D89100",
    borderRadius: 999,
    height: 4,
    width: 4,
  },
  coinGlyphHighlight: {
    backgroundColor: "#FFF0A6",
    borderRadius: 999,
    height: 1.4,
    left: 1.8,
    position: "absolute",
    top: 1.3,
    width: 1.4,
  },
});
