import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExploreScreen } from "../screens/ExploreScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { borders, colors, typography } from "../theme/tokens";
import { ProfileStackNavigator } from "./ProfileStack";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabsNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: borders.color,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 62 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 10 + insets.bottom,
        },
        tabBarIconStyle: styles.iconWrap,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <HomeTabIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ color }) => <ExploreTabIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarIcon: ({ color }) => <ProfileTabIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function HomeTabIcon({ color }: { color: string }) {
  return (
    <View style={[styles.iconBase, { borderColor: color }]}>
      <View style={[styles.homeRoofLeft, { backgroundColor: color }]} />
      <View style={[styles.homeRoofRight, { backgroundColor: color }]} />
      <View style={[styles.homeBody, { borderColor: color }]} />
    </View>
  );
}

function ExploreTabIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconBase}>
      <View style={[styles.exploreRing, { borderColor: color }]} />
      <View style={[styles.exploreHandle, { backgroundColor: color }]} />
    </View>
  );
}

function ProfileTabIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconBase}>
      <View style={[styles.profileHead, { borderColor: color }]} />
      <View style={[styles.profileBody, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.navLabel,
    textTransform: "none",
  },
  iconWrap: {
    marginTop: 2,
    marginBottom: 0,
  },
  item: {
    paddingTop: 2,
  },
  iconBase: {
    height: 24,
    width: 24,
  },
  homeRoofLeft: {
    height: 2,
    left: 5,
    position: "absolute",
    top: 6,
    transform: [{ rotate: "-45deg" }],
    width: 8,
  },
  homeRoofRight: {
    height: 2,
    left: 11,
    position: "absolute",
    top: 6,
    transform: [{ rotate: "45deg" }],
    width: 8,
  },
  homeBody: {
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    bottom: 3,
    height: 10,
    left: 6,
    position: "absolute",
    width: 12,
  },
  exploreRing: {
    borderRadius: 999,
    borderWidth: 2,
    height: 12,
    left: 5,
    position: "absolute",
    top: 5,
    width: 12,
  },
  exploreHandle: {
    bottom: 4,
    height: 2,
    position: "absolute",
    right: 4,
    transform: [{ rotate: "45deg" }],
    width: 8,
  },
  profileHead: {
    borderRadius: 999,
    borderWidth: 2,
    height: 8,
    left: 8,
    position: "absolute",
    top: 4,
    width: 8,
  },
  profileBody: {
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    bottom: 3,
    height: 8,
    left: 5,
    position: "absolute",
    width: 14,
  },
});
