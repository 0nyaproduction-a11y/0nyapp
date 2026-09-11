import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export type CompactAccountStatusProps = {
  isGuest?: boolean;
  isPlus?: boolean;
  style?: StyleProp<ViewStyle>;
};

// 0nya compact account status color palette
const COLOR_MUTED_GREY = "rgba(254, 253, 253, 0.50)";
const COLOR_TEAL = "#2B7E7D";
const COLOR_BRICK = "#955E61";
const COLOR_MUTED_NEUTRAL = "rgba(254, 253, 253, 0.40)";

export function CompactAccountStatus({
  isGuest = false,
  isPlus = false,
  style,
}: CompactAccountStatusProps) {
  const dotColor = isPlus ? COLOR_BRICK : isGuest ? "rgba(254, 253, 253, 0.35)" : COLOR_TEAL;
  const a11yLabel = isPlus
    ? "Account status: Plus, Active"
    : isGuest
      ? "Account status: Guest"
      : "Account status: Free";

  return (
    <View
      accessibilityLabel={a11yLabel}
      accessible
      style={[styles.container, style]}
    >
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      {isPlus ? (
        <Text style={styles.statusText}>
          <Text style={styles.plusBrand}>Plus</Text>
          <Text style={styles.separatorDot}>{" \u00B7 "}</Text>
          <Text style={styles.plusActive}>Active</Text>
        </Text>
      ) : (
        <Text
          style={[
            styles.statusText,
            { color: isGuest ? COLOR_MUTED_GREY : COLOR_TEAL },
          ]}
        >
          {isGuest ? "Guest" : "Free"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 2,
  },
  statusDot: {
    borderRadius: 999,
    height: 4,
    marginRight: 5,
    width: 4,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: 0.15,
    lineHeight: 15,
  },
  plusBrand: {
    color: COLOR_BRICK,
    fontWeight: "600",
  },
  separatorDot: {
    color: COLOR_MUTED_NEUTRAL,
    fontWeight: "400",
  },
  plusActive: {
    color: COLOR_TEAL,
    fontWeight: "600",
  },
});

