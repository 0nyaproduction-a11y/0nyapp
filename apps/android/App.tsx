import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { LoadingState } from "./src/components/ui";
import { AuthProvider, useAuth } from "./src/lib/authContext";
import type { RootStackParamList } from "./src/navigation/types";
import { AccountScreen } from "./src/screens/AccountScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SeriesScreen } from "./src/screens/SeriesScreen";
import { SignInScreen } from "./src/screens/SignInScreen";
import { WalletScreen } from "./src/screens/WalletScreen";
import { WatchScreen } from "./src/screens/WatchScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: "#070707" },
          headerStyle: { backgroundColor: "#070707" },
          headerTintColor: "#f7f2e8",
          headerTitleStyle: { fontWeight: "800" },
        }}
      >
        {session ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Series" component={SeriesScreen} />
            <Stack.Screen name="Watch" component={WatchScreen} />
            <Stack.Screen name="Wallet" component={WalletScreen} />
            <Stack.Screen name="Account" component={AccountScreen} />
          </>
        ) : (
          <Stack.Screen
            name="SignIn"
            component={SignInScreen}
            options={{ title: "Sign in" }}
          />
        )}
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
