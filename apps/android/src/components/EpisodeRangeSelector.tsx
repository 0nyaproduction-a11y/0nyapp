import { Pressable, ScrollView, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import type { EpisodeRange } from "../lib/episodeRanges";
import { radii } from "../theme/tokens";

type EpisodeRangeSelectorProps = {
  activeRangeStart: number | null;
  onSelectRange: (start: number) => void;
  ranges: EpisodeRange[];
  style?: StyleProp<ViewStyle>;
};

export function EpisodeRangeSelector({
  activeRangeStart,
  onSelectRange,
  ranges,
  style,
}: EpisodeRangeSelectorProps) {
  if (ranges.length <= 1) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.rangeStrip, style]}
      contentContainerStyle={styles.rangeRow}
    >
      {ranges.map((range) => {
        const isSelected = range.start === activeRangeStart;

        return (
          <Pressable
            accessibilityLabel={`Show episodes ${range.start} to ${range.end}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={`${range.start}-${range.end}`}
            onPress={() => onSelectRange(range.start)}
            style={({ pressed }) => [
              styles.rangeChip,
              isSelected && styles.rangeChipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.rangeText, isSelected && styles.rangeTextSelected]}>
              {`${range.start}–${range.end}`}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rangeStrip: {
    backgroundColor: "rgba(0, 0, 0, 0.40)",
    borderRadius: radii.pill,
    marginBottom: 16,
    maxHeight: 44,
  },
  rangeRow: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  rangeChip: {
    alignItems: "center",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 16,
  },
  rangeChipSelected: {
    backgroundColor: "#367B79",
  },
  rangeText: {
    color: "rgba(254, 253, 253, 0.55)",
    fontSize: 13,
    fontWeight: "600",
  },
  rangeTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.78,
  },
});
