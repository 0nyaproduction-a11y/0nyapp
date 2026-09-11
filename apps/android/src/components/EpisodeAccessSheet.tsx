import { BlurView } from "expo-blur";
import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WalletAccessPaywall } from "./WalletAccessPaywall";
import type { MicroDramaAccessContext } from "../navigation/types";
import type { ApiEpisode } from "../types/api";

type EpisodeAccessSheetProps = {
  microDramaAccess: MicroDramaAccessContext;
  onDismiss: () => void;
  onSuccess: (confirmedEpisode: ApiEpisode) => void;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SLIDE_DURATION = 260;
const FADE_DURATION = 220;

export function EpisodeAccessSheet({
  microDramaAccess,
  onDismiss,
  onSuccess,
}: EpisodeAccessSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // Entrance animation
  useEffect(() => {
    isClosingRef.current = false;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        duration: FADE_DURATION,
        easing: Easing.out(Easing.ease),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        damping: 24,
        mass: 0.8,
        stiffness: 220,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Smooth dismiss handler
  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }
    isClosingRef.current = true;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        duration: FADE_DURATION,
        easing: Easing.in(Easing.ease),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        duration: SLIDE_DURATION,
        easing: Easing.in(Easing.cubic),
        toValue: SCREEN_HEIGHT,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [fadeAnim, onDismiss, slideAnim]);

  // Handle Android hardware back press
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleDismiss();
        return true;
      },
    );

    return () => {
      backSubscription.remove();
    };
  }, [handleDismiss]);

  const bottomPadding = Math.max(24, insets.bottom + 16);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* 1. BLURRED + FADED BACKDROP */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          { opacity: fadeAnim },
        ]}
      >
        <BlurView
          intensity={25}
          style={StyleSheet.absoluteFill}
          tint="dark"
        />
        <Pressable
          accessibilityLabel="Dismiss episode unlock"
          accessibilityRole="button"
          onPress={handleDismiss}
          style={styles.backdropPressable}
        />
      </Animated.View>

      {/* 2. SLIDING BOTTOM SHEET */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.sheetContainer,
          {
            paddingBottom: bottomPadding,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.sheet}>
          <WalletAccessPaywall
            microDramaAccess={microDramaAccess}
            onDismiss={handleDismiss}
            onSuccess={(confirmed) => {
              onSuccess(confirmed);
              if (!isClosingRef.current) {
                isClosingRef.current = true;
                Animated.parallel([
                  Animated.timing(fadeAnim, {
                    duration: 180,
                    toValue: 0,
                    useNativeDriver: true,
                  }),
                  Animated.timing(slideAnim, {
                    duration: 200,
                    toValue: SCREEN_HEIGHT,
                    useNativeDriver: true,
                  }),
                ]).start();
              }
            }}
            variant="sheet"
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    zIndex: 50,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    zIndex: 51,
  },
  sheet: {
    backgroundColor: "#0C0F0E",
    borderColor: "rgba(254, 253, 253, 0.12)",
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    width: "100%",
  },
});
