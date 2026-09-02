import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AccountScreen } from "../screens/AccountScreen";
import { DeleteAccountScreen } from "../screens/DeleteAccountScreen";
import { RestoreSyncScreen } from "../screens/RestoreSyncScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { useAppLanguage } from "../lib/appLanguage";
import { colors } from "../theme/tokens";
import type { ProfileStackParamList } from "./types";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  const { t, typography } = useAppLanguage();

  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: typography.h3.fontFamily,
          fontWeight: "600",
          fontSize: typography.h3.fontSize,
        },
      }}
    >
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: t("profile.title", "Profile") }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t("settings.title", "Settings") }}
      />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ title: t("profile.delete_account", "Delete Account") }}
      />
      <Stack.Screen
        name="RestoreSync"
        component={RestoreSyncScreen}
        options={{ title: t("profile.restore_sync", "Restore / Sync") }}
      />
    </Stack.Navigator>
  );
}
