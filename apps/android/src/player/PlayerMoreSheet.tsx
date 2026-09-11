import { useMemo } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPlaybackSpeed, PLAYBACK_SPEED_OPTIONS } from "../lib/playbackSpeed";
import { colors } from "../theme/tokens";

// Keeps the effective tap target >= ~44dp for speed chips
const CHIP_HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

type PlayerMoreSheetProps = {
  captionsAvailable: boolean;
  captionsValue: string;
  currentPlaybackRate: number;
  isGuest?: boolean;
  isPlus?: boolean;
  onClose: () => void;
  onNavigateToPlus?: () => void;
  onOpenCaptions: () => void;
  onSelectPlaybackRate: (playbackRate: number) => void;
  onTogglePictureInPicture?: (enabled: boolean) => void;
  pictureInPictureEnabled?: boolean;
};

// 0nya cinema palette matching EpisodeListSheet & SeriesEpisodeTray
const SHEET_SURFACE = "#0B0F0E";
const SHEET_TOP_BORDER = "rgba(43, 126, 125, 0.30)";
const SHEET_TOP_RADIUS = 24;
const BACKDROP_COLOR = "rgba(0, 0, 0, 0.60)";
const CHIP_SURFACE = "#070A09";
const CHIP_BORDER = "rgba(254, 253, 253, 0.08)";
const SELECTED_CHIP_FILL = "rgba(43, 126, 125, 0.18)";
const SELECTED_CHIP_BORDER = "#2B7E7D";
const SELECTED_NUMBER = "#FEFDFD";

export function PlayerMoreSheet({
  captionsAvailable,
  captionsValue,
  currentPlaybackRate,
  isGuest = false,
  isPlus = false,
  onClose,
  onNavigateToPlus,
  onOpenCaptions,
  onSelectPlaybackRate,
  onTogglePictureInPicture,
  pictureInPictureEnabled = true,
}: PlayerMoreSheetProps) {
  const insets = useSafeAreaInsets();

  // Account status badge directly next to title, identical to EpisodeListSheet
  const { statusDotColor, statusLabel, statusTextColor } = useMemo(() => {
    if (isPlus) {
      return {
        statusDotColor: "#B91825",
        statusLabel: "Plus",
        statusTextColor: "#FEFDFD",
      };
    }
    if (isGuest) {
      return {
        statusDotColor: "rgba(254, 253, 253, 0.40)",
        statusLabel: "Guest",
        statusTextColor: "rgba(254, 253, 253, 0.72)",
      };
    }
    return {
      statusDotColor: "#2B7E7D",
      statusLabel: "Free",
      statusTextColor: "#2B7E7D",
    };
  }, [isGuest, isPlus]);

  return (
    <View pointerEvents="auto" style={styles.backdrop}>
      <Pressable
        accessibilityLabel="Close playback settings"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.scrimArea}
      />

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
        <View style={styles.handleBar} />

        {/* Header: Title + Status Pill (left) · Circular Close (right) */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Playback settings</Text>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
              <Text style={styles.statusPillText}>
                {"Status - "}<Text style={[styles.statusPillValue, { color: statusTextColor }]}>{statusLabel}</Text>
              </Text>
            </View>
          </View>

          <View style={styles.headerSideRight}>
            <Pressable
              accessibilityLabel="Close playback settings"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onClose}
              style={({ pressed }) => [styles.closeCircle, pressed && styles.pressed]}
            >
              <CloseIcon />
            </Pressable>
          </View>
        </View>

        {/* Subtle hairline divider under header */}
        <View style={styles.headerDivider} />

        {/* PLAYBACK SPEED (AVAILABLE TO EVERYONE) */}
        <View style={styles.speedSection}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Playback speed</Text>
            <Text style={styles.rowValueActive}>{formatPlaybackSpeed(currentPlaybackRate)}</Text>
          </View>
          <View style={styles.speedChips}>
            {PLAYBACK_SPEED_OPTIONS.map((option) => {
              const isSelected = Math.abs(currentPlaybackRate - option) < 0.001;

              return (
                <Pressable
                  key={option}
                  accessibilityLabel={`Set playback speed to ${formatPlaybackSpeed(option)}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  hitSlop={CHIP_HIT_SLOP}
                  onPress={() => onSelectPlaybackRate(option)}
                  style={({ pressed }) => [
                    styles.speedChip,
                    isSelected && styles.speedChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.speedChipLabel,
                      isSelected && styles.speedChipLabelSelected,
                    ]}
                  >
                    {formatPlaybackSpeed(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* QUALITY */}
        <View style={styles.sectionDivider} />
        {isPlus ? (
          <View style={styles.rowItem}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Quality</Text>
              <Text style={styles.rowValue}>2K · Auto</Text>
            </View>
            <Text style={styles.rowNote}>Adaptive streaming up to 2K</Text>
          </View>
        ) : (
          <Pressable
            accessibilityLabel="Quality. Up to 2K with 0nya Plus. Tap to upgrade."
            accessibilityRole="button"
            disabled={!onNavigateToPlus}
            onPress={onNavigateToPlus}
            style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
          >
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Quality</Text>
              <View style={styles.upgradePill}>
                <Text style={styles.upgradePillText}>Upgrade</Text>
                <Text style={styles.upgradePillChevron}>{"\u203A"}</Text>
              </View>
            </View>
            <Text style={styles.rowNote}>Adaptive streaming (up to 720p) · 2K with 0nya Plus</Text>
          </Pressable>
        )}

        {/* PICTURE IN PICTURE */}
        <View style={styles.sectionDivider} />
        {isPlus ? (
          <View style={styles.rowItem}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Picture in Picture</Text>
              <Switch
                accessibilityLabel="Picture in Picture"
                onValueChange={onTogglePictureInPicture}
                thumbColor={pictureInPictureEnabled ? colors.accent : "rgba(254, 253, 253, 0.4)"}
                trackColor={{ false: "rgba(254, 253, 253, 0.12)", true: "rgba(43, 126, 125, 0.45)" }}
                value={pictureInPictureEnabled}
              />
            </View>
            <Text style={styles.rowNote}>Play outside 0nya</Text>
          </View>
        ) : (
          <Pressable
            accessibilityLabel="Picture in Picture. Play outside 0nya. Tap to upgrade to 0nya Plus."
            accessibilityRole="button"
            disabled={!onNavigateToPlus}
            onPress={onNavigateToPlus}
            style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
          >
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Picture in Picture</Text>
              <View style={styles.upgradePill}>
                <Text style={styles.upgradePillText}>Upgrade</Text>
                <Text style={styles.upgradePillChevron}>{"\u203A"}</Text>
              </View>
            </View>
            <Text style={styles.rowNote}>Play outside 0nya (0nya Plus feature)</Text>
          </Pressable>
        )}

        {/* CAPTIONS (WHEN AVAILABLE) */}
        {captionsAvailable ? (
          <>
            <View style={styles.sectionDivider} />
            <Pressable
              accessibilityLabel={`Captions, currently ${captionsValue}`}
              accessibilityRole="button"
              onPress={onOpenCaptions}
              style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
            >
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Captions</Text>
                <View style={styles.badgeGroup}>
                  <Text style={styles.rowValue}>{captionsValue}</Text>
                  <Text style={styles.rowChevron}>{"\u203A"}</Text>
                </View>
              </View>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
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
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  scrimArea: {
    backgroundColor: BACKDROP_COLOR,
    flex: 1,
  },
  sheet: {
    backgroundColor: SHEET_SURFACE,
    borderTopColor: SHEET_TOP_BORDER,
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
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
    alignItems: "center",
    flexDirection: "row",
    height: 36,
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
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
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: "rgba(254, 253, 253, 0.05)",
    borderColor: "rgba(254, 253, 253, 0.10)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: {
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  statusPillText: {
    color: "rgba(254, 253, 253, 0.50)",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  statusPillValue: {
    fontWeight: "700",
  },
  closeCircle: {
    alignItems: "center",
    backgroundColor: CHIP_SURFACE,
    borderColor: CHIP_BORDER,
    borderRadius: 9999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  headerDivider: {
    backgroundColor: "rgba(254, 253, 253, 0.06)",
    height: 1,
    marginBottom: 14,
  },
  speedSection: {
    marginTop: 2,
  },
  speedChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  speedChip: {
    alignItems: "center",
    backgroundColor: CHIP_SURFACE,
    borderColor: CHIP_BORDER,
    borderRadius: 9999,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingVertical: 7,
  },
  speedChipSelected: {
    backgroundColor: SELECTED_CHIP_FILL,
    borderColor: SELECTED_CHIP_BORDER,
    borderWidth: 1.5,
  },
  speedChipLabel: {
    color: "rgba(254, 253, 253, 0.72)",
    fontSize: 13,
    fontWeight: "600",
  },
  speedChipLabelSelected: {
    color: SELECTED_NUMBER,
    fontWeight: "700",
  },
  sectionDivider: {
    backgroundColor: "rgba(254, 253, 253, 0.06)",
    height: 1,
    marginVertical: 14,
  },
  rowItem: {
    justifyContent: "center",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 34,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "600",
  },
  rowValue: {
    color: colors.textSecondary,
    fontSize: 13.5,
    fontWeight: "600",
  },
  rowValueActive: {
    color: colors.accent,
    fontSize: 13.5,
    fontWeight: "700",
  },
  rowNote: {
    color: "rgba(254, 253, 253, 0.45)",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  badgeGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  rowChevron: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
  },
  upgradePill: {
    alignItems: "center",
    backgroundColor: "rgba(43, 126, 125, 0.12)",
    borderColor: "rgba(43, 126, 125, 0.28)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  upgradePillText: {
    color: "#2B7E7D",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  upgradePillChevron: {
    color: "#2B7E7D",
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.78,
  },
});
