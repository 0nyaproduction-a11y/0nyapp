import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LockIcon } from "./ui";
import type { EpisodeAccessDisplay } from "../lib/episodeAccessDisplay";

export type EpisodeAccessMarkersProps = {
  accessDisplay: EpisodeAccessDisplay;
  style?: StyleProp<ViewStyle>;
};

export function EpisodeAccessMarkers({
  accessDisplay,
  style,
}: EpisodeAccessMarkersProps) {
  if (!accessDisplay.isLocked) {
    return null;
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.markerRow, style]}
    >
      <LockIcon color="rgba(254, 253, 253, 0.45)" size={9} />
      <LockIcon color="#E5A93C" size={8.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  markerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 1,
  },
});
