import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AccountScreen } from "../screens/AccountScreen";
import { DeleteAccountScreen } from "../screens/DeleteAccountScreen";
import { RestoreSyncScreen } from "../screens/RestoreSyncScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { colors } from "../theme/tokens";
import type { ProfileStackParamList } from "./types";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "800" },
      }}
    >
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ title: "Delete Account" }}
      />
      <Stack.Screen
        name="RestoreSync"
        component={RestoreSyncScreen}
        options={{ title: "Restore / Sync" }}
      />
    </Stack.Navigator>
  );
}
