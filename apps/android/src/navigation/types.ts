import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ApiEpisode, ApiSeries, ApiShortFilm, EpisodeAccess } from "../types/api";

export type ParentalControlsTarget =
  | {
      params: RootStackParamList["Watch"];
      screen: "Watch";
    }
  | {
      params: RootStackParamList["ShortFilm"];
      screen: "ShortFilm";
    }
  | {
      params: RootStackParamList["ShortFilmPlayback"];
      screen: "ShortFilmPlayback";
    }
  | {
      params: RootStackParamList["EpisodeAccessOptions"];
      screen: "EpisodeAccessOptions";
    };

export type ProfileStackParamList = {
  Account: undefined;
  Settings: undefined;
  DeleteAccount: undefined;
  RestoreSync: undefined;
};

export type ExploreFormat = "all" | "micro-dramas" | "short-films";

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  SignIn: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Wallet: undefined;
  CoinPurchase:
    | undefined
    | {
        returnToChai?: {
          selectedAmount: number;
          shortFilm: ApiShortFilm;
        };
      };
  Plus: undefined;
  SearchResults: {
    format?: ExploreFormat;
    genre?: string | null;
    query: string;
  };
  Series: {
    slug: string;
  };
  SeriesEpisodes: {
    episodeAccess?: Record<string, EpisodeAccess>;
    series?: ApiSeries;
    seriesSlug?: string;
  };
  Watch: {
    series?: ApiSeries;
    episode?: ApiEpisode;
    access?: EpisodeAccess;
    episodeAccess?: Record<string, EpisodeAccess>;
    seriesSlug?: string;
    episodeNumber?: number;
    resumeAtSeconds?: number | null;
  };
  ShortFilm: {
    slug: string;
  };
  ShortFilmPlayback: {
    slug: string;
    resumeAtSeconds?: number | null;
    startFromBeginning?: boolean;
  };
  ShortFilmEnd: {
    shortFilm: ApiShortFilm;
    chai: {
      allowedCoinAmounts: number[];
      available: boolean;
    };
  };
  ShortFilmChaiAmount: {
    selectedAmount?: number;
    shortFilm: ApiShortFilm;
  };
  ShortFilmChaiConfirm: {
    coinAmount: number;
    shortFilm: ApiShortFilm;
  };
  ParentalControls: {
    mode: "unlock" | "manage";
    target?: ParentalControlsTarget;
  };
  EpisodeAccessOptions: {
    access: EpisodeAccess;
    episode: ApiEpisode;
    episodeAccess: Record<string, EpisodeAccess>;
    resumeAtSeconds?: number | null;
    seriesSlug: string;
    seriesTitle: string;
  };
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Screen>;

export type MainTabScreenProps<Screen extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, Screen>,
  NativeStackScreenProps<RootStackParamList>
>;

export type ProfileStackScreenProps<Screen extends keyof ProfileStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProfileStackParamList, Screen>,
    MainTabScreenProps<"Profile">
  >;
