import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPlaybackSpeed, PLAYBACK_SPEED_OPTIONS } from "../lib/playbackSpeed";
import { borders, colors, radii } from "../theme/tokens";

// Keeps the effective tap target >= ~44dp for a slightly shorter visible chip.
const CHIP_HIT_SLOP = { top: 5, bottom: 5, left: 2, right: 2 };

type PlayerMoreSheetProps = {
  captionsAvailable: boolean;
  captionsValue: string;
  currentPlaybackRate: number;
  onClose: () => void;
  onOpenCaptions: () => void;
  onSelectPlaybackRate: (playbackRate: number) => void;
};

export function PlayerMoreSheet({
  captionsAvailable,
  captionsValue,
  currentPlaybackRate,
  onClose,
  onOpenCaptions,
  onSelectPlaybackRate,
}: PlayerMoreSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="auto" style={styles.backdrop}>
      <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Playback settings</Text>
          <Pressable
            accessibilityLabel="Close playback settings"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

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
                <Text style={[styles.speedChipLabel, isSelected && styles.speedChipLabelSelected]}>
                  {formatPlaybackSpeed(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Quality</Text>
          <Text style={styles.rowValue}>Auto</Text>
        </View>
        <Text style={styles.rowNote}>Adaptive streaming</Text>

        {captionsAvailable ? (
          <Pressable
            accessibilityLabel="Captions"
            accessibilityRole="button"
            onPress={onOpenCaptions}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.rowLabel}>Captions</Text>
            <View style={styles.rowValueGroup}>
              <Text style={styles.rowValue}>{captionsValue}</Text>
              <Text style={styles.rowChevron}>{"\u203A"}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
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
    backgroundColor: colors.surfaceElevated,
    borderTopColor: borders.color,
    borderTopWidth: borders.width,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: 16,
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
  rowLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    minHeight: 44,
  },
  rowValueGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  rowChevron: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
  },
  rowNote: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  speedChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  speedChip: {
    alignItems: "center",
    borderColor: borders.color,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 50,
    paddingHorizontal: 12,
  },
  speedChipSelected: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.accent,
  },
  speedChipLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  speedChipLabelSelected: {
    color: colors.accent,
  },
  pressed: {
    opacity: 0.78,
  },
});
