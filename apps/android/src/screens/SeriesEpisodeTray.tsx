import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CompactAccountStatus } from "../components/CompactAccountStatus";
import { EpisodeAccessMarkers } from "../components/EpisodeAccessMarkers";
import { EpisodeRangeSelector } from "../components/EpisodeRangeSelector";
import { getEpisodeAccessDisplay } from "../lib/episodeAccessDisplay";
import { useEpisodeRanges } from "../lib/episodeRanges";
import type { ApiEpisode, EpisodeAccess } from "../types/api";
import { colors } from "../theme/tokens";

type SeriesEpisodeTrayProps = {
  currentEpisodeNumber?: number;
  episodeAccess: Record<string, EpisodeAccess>;
  episodes: ApiEpisode[];
  isGuest?: boolean;
  isPlus?: boolean;
  onClose: () => void;
  onSelectEpisode: (episode: ApiEpisode) => void;
  seriesTitle: string;
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
const SCRIM_COLOR = "rgba(0, 0, 0, 0.60)";
const TRAY_SURFACE = "#0B0F0E";
const CIRCLE_SURFACE = "#070A09";
const CIRCLE_BORDER = "rgba(254, 253, 253, 0.08)";
const CIRCLE_LOCKED_SURFACE = "rgba(229, 169, 60, 0.04)";
const CIRCLE_LOCKED_BORDER = "rgba(229, 169, 60, 0.18)";
const SELECTED_CIRCLE_FILL = "rgba(43, 126, 125, 0.18)";
const SELECTED_CIRCLE_BORDER = "#2B7E7D";
const SELECTED_NUMBER = "#FEFDFD";
const TRAY_TOP_BORDER = "rgba(43, 126, 125, 0.30)";

function getColumnsForWidth(width: number): number {
  const available = width - SHEET_HORIZONTAL_PADDING * 2;
  for (let cols = 8; cols >= 4; cols--) {
    const gap = (available - cols * CIRCLE_SIZE) / (cols - 1);
    if (gap >= 10) return cols;
  }
  if (width >= 600) {
    return 8;
  }
  return 5;
}

export function SeriesEpisodeTray({
  currentEpisodeNumber,
  episodeAccess,
  episodes,
  isGuest,
  isPlus,
  onClose,
  onSelectEpisode,
  seriesTitle: _seriesTitle,
}: SeriesEpisodeTrayProps) {
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

  const horizontalGap = useMemo(() => {
    const available = width - SHEET_HORIZONTAL_PADDING * 2;
    const totalCircles = columns * CIRCLE_SIZE;
    return Math.max(8, Math.floor((available - totalCircles) / (columns - 1)));
  }, [width, columns]);

  const rows = Math.max(1, Math.ceil(visibleEpisodes.length / columns));
  const maxTrayHeight = Math.round(windowHeight * 0.72);
  const gridContentHeight =
    rows * CIRCLE_SIZE + Math.max(0, rows - 1) * GRID_GAP_VERTICAL;
  const chromeHeight =
    SHEET_TOP_PADDING +
    18 +
    HEADER_ROW_HEIGHT +
    HEADER_MARGIN_BOTTOM +
    DIVIDER_HEIGHT +
    DIVIDER_MARGIN_BOTTOM +
    (ranges.length > 1 ? RANGE_STRIP_HEIGHT : 0) +
    sheetBottomPadding;
  const naturalHeight = chromeHeight + gridContentHeight;
  const sheetHeight = Math.min(maxTrayHeight, naturalHeight);

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
      <Pressable
        accessibilityLabel="Close episode tray"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.scrimArea}
      />

      <View style={[styles.sheet, { height: sheetHeight, paddingBottom: sheetBottomPadding }]}>
        <View style={styles.handleBar} />

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
          keyExtractor={(item) => String(item.number)}
          numColumns={columns}
          renderItem={({ item, index }) => {
            const isCurrent = item.number === currentEpisodeNumber;
            const access = episodeAccess[String(item.number)];
            const accessDisplay = getEpisodeAccessDisplay(item, access, {
              isGuest: Boolean(isGuest),
              isPlus: isPlusUser,
            });
            const isLastRow = Math.floor(index / columns) === rows - 1;
            const isLocked = accessDisplay.isLocked && !isCurrent;

            return (
              <Pressable
                accessibilityLabel={
                  isCurrent
                    ? `Episode ${item.number}, currently playing`
                    : `Episode ${item.number}, ${accessDisplay.accessibilityLabel}`
                }
                accessibilityRole="button"
                onPress={() => onSelectEpisode(item)}
                style={({ pressed }) => [
                  styles.circle,
                  {
                    height: CIRCLE_SIZE,
                    marginBottom: isLastRow ? 0 : GRID_GAP_VERTICAL,
                    width: CIRCLE_SIZE,
                  },
                  isCurrent && styles.circleCurrent,
                  isLocked && styles.circleLocked,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.cellNumber,
                    isCurrent && styles.cellNumberCurrent,
                    isLocked && styles.cellNumberLocked,
                  ]}
                >
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

function CloseIcon() {
  return (
    <View style={styles.closeIconWrapper}>
      <View style={[styles.closeIconLine, styles.closeIconLineA]} />
      <View style={[styles.closeIconLine, styles.closeIconLineB]} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "transparent",
    bottom: 0,
    justifyContent: "flex-end",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  scrimArea: {
    backgroundColor: SCRIM_COLOR,
    flex: 1,
  },
  sheet: {
    backgroundColor: TRAY_SURFACE,
    borderTopColor: TRAY_TOP_BORDER,
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
  headerDivider: {
    backgroundColor: "rgba(254, 253, 253, 0.06)",
    height: DIVIDER_HEIGHT,
    marginBottom: DIVIDER_MARGIN_BOTTOM,
    marginHorizontal: SHEET_HORIZONTAL_PADDING,
  },
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
  gridList: {
    flex: 1,
  },
  grid: {
    paddingBottom: 0,
    paddingTop: 0,
  },
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
  circleCurrent: {
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
  cellNumberCurrent: {
    color: SELECTED_NUMBER,
    fontWeight: "700",
  },
  cellNumberLocked: {
    color: "rgba(254, 253, 253, 0.50)",
  },
  closeIconWrapper: {
    alignItems: "center",
    height: 14,
    justifyContent: "center",
    width: 14,
  },
  closeIconLine: {
    backgroundColor: "rgba(254, 253, 253, 0.75)",
    borderRadius: 1,
    height: 1.5,
    position: "absolute",
    width: 12,
  },
  closeIconLineA: {
    transform: [{ rotate: "45deg" }],
  },
  closeIconLineB: {
    transform: [{ rotate: "-45deg" }],
  },
});
