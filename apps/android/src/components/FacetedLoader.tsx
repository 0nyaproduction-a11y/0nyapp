import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, motion } from "../theme/tokens";

type FacetedLoaderProps = {
  color?: string;
  periodMs?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
  variant?: "indeterminate" | "complete";
};

const NUM_FACETS = 16;
const ANGLE_STEP = 360 / NUM_FACETS; // 22.5 deg

export function FacetedLoader({
  color = colors.accent,
  periodMs = motion.loaderPeriod,
  size = 28,
  style,
  variant = "indeterminate",
}: FacetedLoaderProps) {
  const rotationAnim = useMemo(() => new Animated.Value(0), []);
  // Stay static until the platform preference has resolved.
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      changed = true;
      if (active) setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active && !changed) setReduceMotion(enabled);
    }).catch(() => { /* Keep the static accessible state if preference lookup fails. */ });
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (variant === "complete" || reduceMotion) {
      rotationAnim.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.timing(rotationAnim, {
        duration: periodMs,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => animation.stop();
  }, [periodMs, reduceMotion, rotationAnim, variant]);

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const radius = size / 2;
  // Chord length slightly less than arc to leave a discrete ~4.5° facet gap
  const chordLength = Math.max(3, 2 * radius * Math.sin((Math.PI / NUM_FACETS)) * 0.88);
  const chordThickness = Math.max(1.8, Math.round(size * 0.08));

  return (
    <View
      accessibilityLabel={variant === "complete" ? "Complete" : "Loading"}
      accessibilityRole="progressbar"
      style={[styles.container, { height: size, width: size }, style]}
    >
      <Animated.View
        style={[
          styles.ring,
          { height: size, width: size },
          variant === "indeterminate" ? { transform: [{ rotate: spin }] } : null,
        ]}
      >
        {Array.from({ length: NUM_FACETS }).map((_, index) => {
          const angleDeg = index * ANGLE_STEP;
          const angleRad = (angleDeg * Math.PI) / 180;
          // Center of the chord placed on the perimeter circle
          const cx = radius + (radius - chordThickness) * Math.sin(angleRad);
          const cy = radius - (radius - chordThickness) * Math.cos(angleRad);

          let facetColor: string = colors.borderSubtle;
          let facetOpacity = 0.32;

          if (variant === "complete") {
            facetColor = color;
            facetOpacity = 1.0;
          } else if (index === 0) {
            // Active head facet
            facetColor = color;
            facetOpacity = 1.0;
          } else if (index === 1) {
            facetColor = colors.accentHighlight;
            facetOpacity = 0.85;
          } else if (index === 2) {
            facetColor = colors.accentHighlight;
            facetOpacity = 0.68;
          } else if (index === 3) {
            facetColor = colors.accentHighlight;
            facetOpacity = 0.52;
          }

          return (
            <View
              key={index}
              style={[
                styles.facet,
                {
                  backgroundColor: facetColor,
                  borderRadius: chordThickness / 2,
                  height: chordThickness,
                  left: cx - chordLength / 2,
                  opacity: facetOpacity,
                  top: cy - chordThickness / 2,
                  transform: [{ rotate: `${angleDeg + 90}deg` }],
                  width: chordLength,
                },
              ]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "relative",
  },
  facet: {
    position: "absolute",
  },
});
