import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPlaybackSpeed, PLAYBACK_SPEED_OPTIONS } from "../lib/playbackSpeed";
import { colors, radii } from "../theme/tokens";

// Keeps the effective tap target >= ~44dp for a slightly shorter visible chip.
const CHIP_HIT_SLOP = { top: 5, bottom: 5, left: 2, right: 2 };

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

  return (
    <View pointerEvents="auto" style={styles.backdrop}>
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handleBar} />

        {/* HEADER ROW: Title (left) · Entitlement Status (center) · Circular Close (right) */}
        <View style={styles.header}>
          <View style={styles.headerSideLeft}>
            <Text style={styles.headerTitle}>Playback settings</Text>
          </View>

          {isPlus ? (
            <View style={styles.headerCenter}>
              <Text numberOfLines={1} style={styles.plusStatusText}>
                <Text style={styles.plusShunya}>{"Shunya "}</Text>
                <Text style={styles.plusBrand}>{"Plus"}</Text>
                <Text style={styles.plusDot}>{" · "}</Text>
                <Text style={styles.plusActive}>{"Active"}</Text>
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityLabel="Plus required. Tap to view plans."
              accessibilityRole="button"
              disabled={!onNavigateToPlus}
              onPress={onNavigateToPlus}
              style={({ pressed }) => [
                styles.headerCenter,
                pressed && onNavigateToPlus && styles.pressed,
              ]}
            >
              <Text numberOfLines={1} style={styles.plusRequiredText}>
                Plus required
              </Text>
            </Pressable>
          )}

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

        {/* PLAYBACK SPEED (AVAILABLE TO EVERYONE) */}
        <View style={styles.speedSection}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Playback speed</Text>
            <Text style={styles.rowValue}>{formatPlaybackSpeed(currentPlaybackRate)}</Text>
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
          </View>
        ) : (
          <Pressable
            accessibilityLabel="Quality. Up to 2K. Upgrade."
            accessibilityRole="button"
            disabled={!onNavigateToPlus}
            onPress={onNavigateToPlus}
            style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
          >
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Quality</Text>
              <Text style={styles.upgradeActionText}>{"Upgrade »"}</Text>
              <Text style={styles.upgradeActionText}>{"Upgrade \u203A"}</Text>
            </View>
            <Text style={styles.rowNote}>Up to 2K</Text>
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
                thumbColor={pictureInPictureEnabled ? colors.accent : colors.muted}
                trackColor={{ false: colors.borderStrong, true: "rgba(43, 126, 125, 0.4)" }}
                value={pictureInPictureEnabled}
              />
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityLabel="Picture in Picture. Play outside 0nya. Upgrade."
            accessibilityRole="button"
            disabled={!onNavigateToPlus}
            onPress={onNavigateToPlus}
            style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
          >
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Picture in Picture</Text>
              <Text style={styles.upgradeActionText}>{"Upgrade »"}</Text>
              <Text style={styles.upgradeActionText}>{"Upgrade \u203A"}</Text>
            </View>
            <Text style={styles.rowNote}>Play outside 0nya</Text>
          </Pressable>
        )}


        {/* CAPTIONS (WHEN AVAILABLE) */}
        {captionsAvailable ? (
          <>
            <View style={styles.sectionDivider} />
            <Pressable
              accessibilityLabel="Captions"
              accessibilityRole="button"
              onPress={onOpenCaptions}
              style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
            >
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Captions</Text>
                <View style={styles.badgeGroup}>
                  <Text style={styles.rowValue}>{captionsValue}</Text>
                  <Text style={styles.rowChevron}>{"»"}</Text>
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
    backgroundColor: "rgba(3, 5, 4, 0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#050505",
    borderTopColor: "rgba(254, 253, 253, 0.10)",
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handleBar: {
    alignSelf: "center",
    backgroundColor: "rgba(254, 253, 253, 0.22)",
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 38,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    height: 38,
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerSideLeft: {
    alignItems: "flex-start",
    flexShrink: 0,
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
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
  },
  plusStatusText: {
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.2,
    lineHeight: 16,
    textAlign: "center",
  },
  plusShunya: {
    color: colors.accent,
    fontWeight: "700",
  },
  plusBrand: {
    color: "#955E61",
    fontWeight: "700",
  },
  plusDot: {
    color: "rgba(254, 253, 253, 0.45)",
    fontWeight: "400",
  },
  plusActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  plusRequiredText: {
    color: "#955E61",
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.2,
    lineHeight: 16,
    textAlign: "center",
  },
  closeCircle: {
    alignItems: "center",
    backgroundColor: "#050505",
    borderColor: "rgba(254, 253, 253, 0.10)",
    borderRadius: 9999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  speedSection: {
    marginTop: 4,
  },
  speedChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  speedChip: {
    alignItems: "center",
    backgroundColor: "#050505",
    borderColor: "rgba(254, 253, 253, 0.10)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 34,
  },
  speedChipSelected: {
    backgroundColor: "rgba(43, 126, 125, 0.16)",
    borderColor: colors.accent,
  },
  speedChipLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  speedChipLabelSelected: {
    color: colors.accent,
    fontWeight: "700",
  },
  sectionDivider: {
    backgroundColor: "rgba(254, 253, 253, 0.08)",
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
    minHeight: 32,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  rowValue: {
    color: colors.textSecondary,
    fontSize: 13.5,
    fontWeight: "600",
  },
  rowNote: {
    color: "rgba(254, 253, 253, 0.45)",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  badgeGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  rowChevron: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
  },
  upgradeActionText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.78,
  },
});
