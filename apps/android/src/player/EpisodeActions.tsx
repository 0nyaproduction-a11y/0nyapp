import { Pressable, StyleSheet, Text, View } from "react-native";

type EpisodeActionsProps = {
  onEpisodesPress?: () => void;
};

// Right-side vertical action rail. Presentation only: no like/comment/share
// backend logic exists yet, so those actions stay disabled placeholders.
export function EpisodeActions({ onEpisodesPress }: EpisodeActionsProps) {
  return (
    <View pointerEvents="box-none" style={styles.rail}>
      <PlaceholderAction accessibilityLabel="Like - coming soon" glyph="♡" label="Like" />
      <PlaceholderAction accessibilityLabel="Comment - coming soon" glyph="💬" label="Comment" />
      <PlaceholderAction accessibilityLabel="Share - coming soon" glyph="↗" label="Share" />
      {onEpisodesPress ? (
        <Pressable
          accessibilityLabel="Open episode list"
          accessibilityRole="button"
          onPress={onEpisodesPress}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.glyph}>☰</Text>
          <Text style={styles.label}>Episodes</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PlaceholderAction({
  accessibilityLabel,
  glyph,
  label,
}: {
  accessibilityLabel: string;
  glyph: string;
  label: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      disabled
      style={[styles.action, styles.actionDisabled]}
    >
      <Text style={styles.glyph}>{glyph}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.soon}>Soon</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    alignItems: "center",
    bottom: 132,
    gap: 22,
    position: "absolute",
    right: 12,
  },
  action: {
    alignItems: "center",
    gap: 4,
    minHeight: 48,
    minWidth: 56,
    justifyContent: "center",
  },
  actionDisabled: {
    opacity: 0.55,
  },
  actionPressed: {
    opacity: 0.78,
  },
  glyph: {
    color: "#F4FFFD",
    fontSize: 22,
    fontWeight: "700",
  },
  label: {
    color: "#D8EDE9",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  soon: {
    color: "#A8B9B6",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
