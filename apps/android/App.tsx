import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { LoadingState } from "./src/components/ui";
import { AdMobProvider } from "./src/lib/adMob";
import { AuthProvider, useAuth } from "./src/lib/authContext";
import { getAndroidLinkingConfig } from "./src/navigation/linking";
import { MainTabsNavigator } from "./src/navigation/MainTabs";
import type { RootStackParamList } from "./src/navigation/types";
import { colors } from "./src/theme/tokens";
import { EpisodeAccessOptionsScreen } from "./src/screens/EpisodeAccessOptionsScreen";
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

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { isLoading } = useAuth();
  const linking = getAndroidLinkingConfig();

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "800" },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabsNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: "Wallet" }} />
        <Stack.Screen
          name="CoinPurchase"
          component={CoinPurchaseScreen}
          options={{ title: "Buy Coins" }}
        />
        <Stack.Screen name="Plus" component={PlusScreen} options={{ title: "" }} />
        <Stack.Screen
          name="SearchResults"
          component={SearchResultsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Series" component={SeriesScreen} />
        <Stack.Screen
          name="SeriesEpisodes"
          component={SeriesEpisodesScreen}
          options={{ title: "Episodes" }}
        />
        <Stack.Screen name="ShortFilm" component={ShortFilmDetailScreen} />
        <Stack.Screen name="ShortFilmPlayback" component={ShortFilmPlaybackScreen} />
        <Stack.Screen name="ShortFilmEnd" component={ShortFilmEndScreen} />
        <Stack.Screen name="ShortFilmChaiAmount" component={ShortFilmChaiAmountScreen} />
        <Stack.Screen name="ShortFilmChaiConfirm" component={ShortFilmChaiConfirmScreen} />
        <Stack.Screen
          name="EpisodeAccessOptions"
          component={EpisodeAccessOptionsScreen}
          options={{ title: "Unlock options" }}
        />
        <Stack.Screen
          name="ParentalControls"
          component={ParentalControlsScreen}
          options={{ title: "Parental Control" }}
        />
        <Stack.Screen name="Watch" component={WatchScreen} />
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{ title: "Sign in" }}
        />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AdMobProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </AdMobProvider>
  );
}
