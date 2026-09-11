import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CompactAccountStatus } from "../components/CompactAccountStatus";
import { EpisodeAccessMarkers } from "../components/EpisodeAccessMarkers";
import { EpisodeRangeSelector } from "../components/EpisodeRangeSelector";
import { getEpisodeAccessDisplay } from "../lib/episodeAccessDisplay";
import { useEpisodeRanges } from "../lib/episodeRanges";
import { colors } from "../theme/tokens";
import type { ApiEpisode, EpisodeAccess } from "../types/api";

type EpisodeListSheetProps = {
  currentEpisodeNumber: number;
  episodeAccess: Record<string, EpisodeAccess>;
  episodes: ApiEpisode[];
  isGuest?: boolean;
  isPlus?: boolean;
  onClose: () => void;
  onSelectEpisode: (episodeNumber: number) => void;
  seriesTitle?: string;
};

// Layout constants — compact circular episode buttons filling width edge-to-edge
const CIRCLE_SIZE = 44;
const SHEET_HORIZONTAL_PADDING = 16;
const GRID_GAP_VERTICAL = 12;
const SHEET_TOP_PADDING = 10;
const HEADER_ROW_HEIGHT = 38;
const HEADER_MARGIN_BOTTOM = 10;
const DIVIDER_HEIGHT = 1;
const DIVIDER_MARGIN_BOTTOM = 14;
const RANGE_STRIP_HEIGHT = 44;
const SAFE_BOTTOM_BREATHING_ROOM = 10;
const MIN_BOTTOM_PADDING = 14;
const SHEET_TOP_RADIUS = 24;

// Color theme — 0nya cinema palette with smarter tonal depth
const BACKDROP_COLOR = "rgba(0, 0, 0, 0.60)";
const SHEET_SURFACE = "#0B0F0E";
const CIRCLE_SURFACE = "#070A09";
const CIRCLE_BORDER = "rgba(254, 253, 253, 0.08)";
const CIRCLE_LOCKED_SURFACE = "rgba(229, 169, 60, 0.04)";
const CIRCLE_LOCKED_BORDER = "rgba(229, 169, 60, 0.18)";
const SELECTED_CIRCLE_FILL = "rgba(43, 126, 125, 0.18)";
const SELECTED_CIRCLE_BORDER = "#2B7E7D";
const SELECTED_NUMBER = "#FEFDFD";
const SHEET_TOP_BORDER = "rgba(43, 126, 125, 0.30)";

function getColumnsForWidth(width: number): number {
  const available = width - SHEET_HORIZONTAL_PADDING * 2;
  // Choose maximum columns that maintain at least 10dp breathing space between adjacent circles
  for (let cols = 8; cols >= 4; cols--) {
    const gap = (available - cols * CIRCLE_SIZE) / (cols - 1);
    if (gap >= 10) return cols;
  }
  if (width >= 600) {
    return 8;
  }
  return 5;
}

export function EpisodeListSheet({
  currentEpisodeNumber,
  episodeAccess,
  episodes,
  isGuest,
  isPlus,
  onClose,
  onSelectEpisode,
  seriesTitle: _seriesTitle,
}: EpisodeListSheetProps) {
  const isPlusUser =
    Boolean(isPlus) ||
    Object.values(episodeAccess).some(
      (access) => access?.kind === "subscription" && access?.canWatch,
    );
  const { height: windowHeight, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columns = useMemo(() => getColumnsForWidth(width), [width]);
  const sheetBottomPadding = Math.max(
    MIN_BOTTOM_PADDING,
    insets.bottom + SAFE_BOTTOM_BREATHING_ROOM,
    insets.bottom + 6,
  );
  const {
    activeRangeStart,
    onSelectRange,
    ranges,
    visibleEpisodes,
  } = useEpisodeRanges({
    currentEpisodeNumber,
    episodes,
  });


  // Calculate gap so circles span from left corner to right corner with no empty corner dead space
  const horizontalGap = useMemo(() => {
    const available = width - SHEET_HORIZONTAL_PADDING * 2;
    return Math.floor((available - columns * CIRCLE_SIZE) / (columns - 1));
  }, [width, columns]);

  const rows = Math.max(1, Math.ceil(visibleEpisodes.length / columns));
  const maxSheetHeight = Math.round(windowHeight * 0.72);
  const gridContentHeight =
    rows * CIRCLE_SIZE + Math.max(0, rows - 1) * GRID_GAP_VERTICAL;
  const chromeHeight =
    SHEET_TOP_PADDING +
    18 + // handle bar + margin
    HEADER_ROW_HEIGHT +
    HEADER_MARGIN_BOTTOM +
    DIVIDER_HEIGHT +
    DIVIDER_MARGIN_BOTTOM +
    (ranges.length > 1 ? RANGE_STRIP_HEIGHT : 0) +
    sheetBottomPadding;
  const naturalHeight = chromeHeight + gridContentHeight;
  const sheetHeight = Math.min(maxSheetHeight, naturalHeight);

  // Left-aligned with sheet padding so row 1 starts under "Episodes" and partial rows stay left-aligned
  const columnWrapperStyle = useMemo(
    () => ({
      gap: horizontalGap,
      justifyContent: "flex-start" as const,
      paddingHorizontal: SHEET_HORIZONTAL_PADDING,
    }),
    [horizontalGap],
  );

  return (
    <View pointerEvents="auto" style={styles.backdrop}>
      <View style={[styles.sheet, { height: sheetHeight, paddingBottom: sheetBottomPadding }]}>
        {/* Grab handle indicator */}
        <View style={styles.handleBar} />

        {/* Header — title + compact status below (left) · close button (top-right) */}
        <View style={styles.header}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>
              {"Episodes"}
              {episodes.length > 0 ? (
                <Text style={styles.headerCount}>{` (${episodes.length})`}</Text>
              ) : null}
            </Text>
            <CompactAccountStatus isGuest={isGuest} isPlus={isPlusUser} />
          </View>

          <View style={styles.headerSideRight}>
            <Pressable
              accessibilityLabel="Close episode list"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onClose}
              style={({ pressed }) => [styles.closeCircle, pressed && styles.pressed]}
            >
              <CloseIcon />
            </Pressable>
          </View>
        </View>

        {/* Subtle divider under header */}
        <View style={styles.headerDivider} />

        <EpisodeRangeSelector
          activeRangeStart={activeRangeStart}
          onSelectRange={onSelectRange}
          ranges={ranges}
          style={{ marginHorizontal: SHEET_HORIZONTAL_PADDING }}
        />

        <FlatList
          columnWrapperStyle={columnWrapperStyle}
          contentContainerStyle={styles.grid}
          data={visibleEpisodes}
          key={columns}
          keyExtractor={(episode) => String(episode.number)}
          numColumns={columns}
          renderItem={({ index, item }) => {
            const access = episodeAccess[String(item.number)];
            const isPlaying = item.number === currentEpisodeNumber;
            const accessDisplay = getEpisodeAccessDisplay(item, access, {
              isGuest,
              isPlus: isPlusUser,
            });
            const isLastRow = Math.floor(index / columns) === rows - 1;
            const isLocked = accessDisplay.isLocked && !isPlaying;

            return (
              <Pressable
                accessibilityLabel={buildEpisodeA11yLabel(item, accessDisplay.accessibilityLabel, isPlaying)}
                accessibilityRole="button"
                accessibilityState={{ selected: isPlaying }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => onSelectEpisode(item.number)}
                style={({ pressed }) => [
                  styles.circle,
                  {
                    height: CIRCLE_SIZE,
                    marginBottom: isLastRow ? 0 : GRID_GAP_VERTICAL,
                    width: CIRCLE_SIZE,
                  },
                  isPlaying && styles.circlePlaying,
                  isLocked && styles.circleLocked,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.cellNumber, isPlaying && styles.cellNumberPlaying, isLocked && styles.cellNumberLocked]}>
                  {item.number}
                </Text>
                <EpisodeAccessMarkers accessDisplay={accessDisplay} />
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
          style={styles.gridList}
        />
      </View>
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

function CloseIcon({
  color = "rgba(254, 253, 253, 0.72)",
  size = 11,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        height: size,
        justifyContent: "center",
        transform: [{ rotate: "45deg" }],
        width: size,
      }}
    >
      <View
        style={{
          backgroundColor: color,
          borderRadius: 1,
          height: 1.5,
          position: "absolute",
          width: size,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          borderRadius: 1,
          height: size,
          position: "absolute",
          width: 1.5,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BACKDROP_COLOR,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: SHEET_SURFACE,
    borderTopColor: SHEET_TOP_BORDER,
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    borderTopWidth: 1,
    paddingHorizontal: 0,
    paddingTop: SHEET_TOP_PADDING,
  },
  handleBar: {
    alignSelf: "center",
    backgroundColor: "rgba(254, 253, 253, 0.18)",
    borderRadius: 2,
    height: 3.5,
    marginBottom: 12,
    width: 36,
  },
  // ── Header ──────────────────────────────────────────────────
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    height: HEADER_ROW_HEIGHT,
    justifyContent: "space-between",
    marginBottom: HEADER_MARGIN_BOTTOM,
    paddingHorizontal: SHEET_HORIZONTAL_PADDING,
  },
  headerTitleBlock: {
    flex: 1,
    justifyContent: "center",
  },
  headerSideRight: {
    alignItems: "flex-end",
    flexShrink: 0,
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  headerCount: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  // ── Header divider ──────────────────────────────────────────
  headerDivider: {
    backgroundColor: "rgba(254, 253, 253, 0.06)",
    height: DIVIDER_HEIGHT,
    marginBottom: DIVIDER_MARGIN_BOTTOM,
    marginHorizontal: SHEET_HORIZONTAL_PADDING,
  },
  // ── Close button ────────────────────────────────────────────
  closeCircle: {
    alignItems: "center",
    backgroundColor: CIRCLE_SURFACE,
    borderColor: CIRCLE_BORDER,
    borderRadius: 9999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  pressed: {
    opacity: 0.78,
  },
  // ── Grid ────────────────────────────────────────────────────
  gridList: {
    flex: 1,
  },
  grid: {
    paddingBottom: 0,
    paddingTop: 0,
  },
  // ── Episode circles ─────────────────────────────────────────
  circle: {
    alignItems: "center",
    backgroundColor: CIRCLE_SURFACE,
    borderColor: CIRCLE_BORDER,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 1,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  circlePlaying: {
    backgroundColor: SELECTED_CIRCLE_FILL,
    borderColor: SELECTED_CIRCLE_BORDER,
    borderWidth: 1.5,
  },
  circleLocked: {
    backgroundColor: CIRCLE_LOCKED_SURFACE,
    borderColor: CIRCLE_LOCKED_BORDER,
  },
  cellNumber: {
    color: "rgba(254, 253, 253, 0.85)",
    fontSize: 13.5,
    fontWeight: "600",
  },
  cellNumberPlaying: {
    color: SELECTED_NUMBER,
    fontWeight: "700",
  },
  cellNumberLocked: {
    color: "rgba(254, 253, 253, 0.50)",
  },
});
