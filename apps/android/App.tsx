import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect, useRef } from "react";
import { LoadingState } from "./src/components/ui";
import { AppState, LogBox, type AppStateStatus } from "react-native";

LogBox.ignoreAllLogs(true);
import { AdMobProvider } from "./src/lib/adMob";
import { AuthProvider, useAuth } from "./src/lib/authContext";
import { AppLanguageProvider, useAppLanguage } from "./src/lib/appLanguage";
import { getAndroidLinkingConfig } from "./src/navigation/linking";
import { MainTabsNavigator } from "./src/navigation/MainTabs";
import type { RootStackParamList } from "./src/navigation/types";
import { colors } from "./src/theme/tokens";
import { EpisodeAccessOptionsScreen } from "./src/screens/EpisodeAccessOptionsScreen";
import { AgeDeclarationScreen } from "./src/screens/AgeDeclarationScreen";
import { SeriesScreen } from "./src/screens/SeriesScreen";
import { SeriesEpisodesScreen } from "./src/screens/SeriesEpisodesScreen";
import { ParentalControlsScreen } from "./src/screens/ParentalControlsScreen";
import { SearchResultsScreen } from "./src/screens/SearchResultsScreen";
import { SignInScreen } from "./src/screens/SignInScreen";
import { ShortFilmEndScreen } from "./src/screens/ShortFilmEndScreen";
import { ShortFilmChaiAmountScreen } from "./src/screens/ShortFilmChaiAmountScreen";
import { ShortFilmChaiConfirmScreen } from "./src/screens/ShortFilmChaiConfirmScreen";
import { ShortFilmDetailScreen } from "./src/screens/ShortFilmDetailScreen";
import { ShortFilmPlaybackScreen } from "./src/screens/ShortFilmPlaybackScreen";
import { WalletScreen } from "./src/screens/WalletScreen";
import { CoinPurchaseScreen } from "./src/screens/CoinPurchaseScreen";
import { PlusScreen } from "./src/screens/PlusScreen";
import { WatchScreen } from "./src/screens/WatchScreen";
import { PlayTogetherRoomScreen } from "./src/screens/PlayTogetherRoomScreen";
import { perfMark } from "./src/lib/perf";
import { createSessionObservationController } from "./src/lib/sessionObservations";
import { setupNotificationListeners, setupTokenRefreshListener } from "./src/lib/notifications";

const Stack = createNativeStackNavigator<RootStackParamList>();

perfMark("APP_START");

function AppNavigator() {
  const { isLoading, session } = useAuth();
  const { t, typography } = useAppLanguage();
  const linking = getAndroidLinkingConfig();
  const sessionObservationController = useRef(createSessionObservationController());

  useEffect(() => {
    const controller = sessionObservationController.current;
    controller.appOpened();
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "background" || nextState === "inactive") {
        controller.appBackground();
      } else if (nextState === "active") {
        controller.appForeground();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    sessionObservationController.current.setActorId(session?.user.id ?? null);
  }, [session?.user.id]);

  useEffect(() => {
    const cleanupRefresh = setupTokenRefreshListener(session?.access_token);
    const cleanupListeners = setupNotificationListeners();
    return () => {
      cleanupRefresh();
      cleanupListeners();
    };
  }, [session?.access_token]);

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <NavigationContainer linking={linking} onReady={() => perfMark("NAVIGATION_READY")}>
      <Stack.Navigator
        initialRouteName="MainTabs"
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
          name="MainTabs"
          component={MainTabsNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Wallet"
          component={WalletScreen}
          options={{
            headerRight: () => null,
            title: "Activity",
          }}
        />
        <Stack.Screen
          name="CoinPurchase"
          component={CoinPurchaseScreen}
          options={{ title: t("coin_purchase.title", "Buy Coins") }}
        />
        <Stack.Screen
          name="Plus"
          component={PlusScreen}
          options={{
            headerRight: () => null,
            title: "",
          }}
        />
        <Stack.Screen
          name="SearchResults"
          component={SearchResultsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Series"
          component={SeriesScreen}
          options={{
            headerRight: () => null,
            title: "",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="SeriesEpisodes"
          component={SeriesEpisodesScreen}
          options={{ title: t("series.episodes", "Episodes") }}
        />
        <Stack.Screen name="ShortFilm" component={ShortFilmDetailScreen} />
        <Stack.Screen name="ShortFilmPlayback" component={ShortFilmPlaybackScreen} />
        <Stack.Screen name="ShortFilmEnd" component={ShortFilmEndScreen} />
        <Stack.Screen name="ShortFilmChaiAmount" component={ShortFilmChaiAmountScreen} />
        <Stack.Screen name="ShortFilmChaiConfirm" component={ShortFilmChaiConfirmScreen} />
        <Stack.Screen
          name="EpisodeAccessOptions"
          component={EpisodeAccessOptionsScreen}
          options={{
            // W02 is a contextual access presentation over the frozen W01
            // preview frame, not a full-screen replacement: keep the player
            // screen underneath mounted and visible.
            animation: "fade",
            contentStyle: { backgroundColor: "transparent" },
            headerShown: false,
            presentation: "transparentModal",
            title: t("unlock.title", "Unlock options"),
          }}
        />
        <Stack.Screen
          name="ParentalControls"
          component={ParentalControlsScreen}
          options={{ title: t("parental.title", "Parental Control") }}
        />
        <Stack.Screen name="Watch" component={WatchScreen} />
        <Stack.Screen
          name="AgeDeclaration"
          component={AgeDeclarationScreen}
          options={{
            headerRight: () => null,
            title: t("age_declaration.title", "Before you continue"),
          }}
        />
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{
            headerRight: () => null,
            title: t("signin.title", "Sign in"),
          }}
        />
        <Stack.Screen
          name="PlayTogetherRoom"
          component={PlayTogetherRoomScreen}
          options={{ title: t("play_together.title", "Play Together") }}
        />
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    "PlusJakartaSans-Regular": require("./assets/fonts/plus-jakarta-sans/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Medium": require("./assets/fonts/plus-jakarta-sans/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("./assets/fonts/plus-jakarta-sans/PlusJakartaSans-SemiBold.ttf"),
    "Mukta-Regular": require("./assets/fonts/mukta/Mukta-Regular.ttf"),
    "Mukta-Medium": require("./assets/fonts/mukta/Mukta-Medium.ttf"),
    "Mukta-SemiBold": require("./assets/fonts/mukta/Mukta-SemiBold.ttf"),
  });

  if (!fontsLoaded && !fontError) {
    return <LoadingState />;
  }

  return (
    <AppLanguageProvider>
      <AdMobProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </AdMobProvider>
    </AppLanguageProvider>
  );
}
