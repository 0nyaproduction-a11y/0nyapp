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
    }
  | {
      params: RootStackParamList["Wallet"];
      screen: "Wallet";
    };

export type ProfileStackParamList = {
  Account: undefined;
  Settings: undefined;
  DeleteAccount: undefined;
  RestoreSync: undefined;
};

export type ExploreFormat = "all" | "micro-dramas" | "short-films";

export type SearchResultContext = {
  contentId: string;
  contentSlug: string;
  contentType: "MICRO_DRAMA" | "SHORT_FILM";
  searchQueryContext: string;
  searchResultPosition: number;
  sourceSurface: "search";
  rankingDecisionId?: string | null;
  recommendationReason?: "SEARCH_RELEVANCE" | "GENRE_FILTER" | "FORMAT_FILTER" | null;
};

export type DiscoveryContext = SearchResultContext | {
  contentId: string;
  contentSlug: string;
  contentType: "MICRO_DRAMA" | "SHORT_FILM";
  position: number;
  rowId: string | null;
  sourceSurface: "home" | "explore" | "continue_watching";
  rankingDecisionId?: string | null;
  recommendationReason?: "NEW_RELEASE" | "CONTINUE_WATCHING" | "SEARCH_RELEVANCE" | "GENRE_FILTER" | "FORMAT_FILTER" | "EDITORIAL" | null;
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type MicroDramaAccessContext = {
  access: EpisodeAccess;
  episode: ApiEpisode;
  episodeAccess: Record<string, EpisodeAccess>;
  episodeNumber: number;
  resumeAtSeconds?: number | null;
  seriesSlug: string;
  seriesTitle: string;
};

export type RootStackParamList = {
  AgeDeclaration: undefined;
  SignIn: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Wallet:
    | undefined
    | {
        microDramaAccess?: MicroDramaAccessContext;
        view?: "ledger";
      };
  CoinPurchase:
    | undefined
    | {
        returnToWallet?: {
          microDramaAccess: MicroDramaAccessContext;
        };
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
    searchContext?: DiscoveryContext;
    slug: string;
  };
  SeriesEpisodes: {
    episodeAccess?: Record<string, EpisodeAccess>;
    series?: ApiSeries;
    seriesSlug?: string;
    searchContext?: DiscoveryContext;
  };
  Watch: {
    series?: ApiSeries;
    episode?: ApiEpisode;
    access?: EpisodeAccess;
    episodeAccess?: Record<string, EpisodeAccess>;
    seriesSlug: string;
    episodeNumber: number;
    resumeAtSeconds?: number | null;
    startFromBeginning?: boolean;
    searchContext?: DiscoveryContext;
  };
  ShortFilm: {
    searchContext?: DiscoveryContext;
    slug: string;
  };
  ShortFilmPlayback: {
    slug: string;
    resumeAtSeconds?: number | null;
    startFromBeginning?: boolean;
    searchContext?: DiscoveryContext;
  };
  ShortFilmEnd: {
    shortFilm: ApiShortFilm;
    chai: {
      allowedCoinAmounts: number[];
      available: boolean;
    };
    hasSentChaiThisPlayback?: boolean;
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
    access: MicroDramaAccessContext["access"];
    episode: MicroDramaAccessContext["episode"];
    episodeAccess: MicroDramaAccessContext["episodeAccess"];
    episodeNumber: number;
    resumeAtSeconds?: MicroDramaAccessContext["resumeAtSeconds"];
    seriesSlug: MicroDramaAccessContext["seriesSlug"];
    seriesTitle: MicroDramaAccessContext["seriesTitle"];
  };
  PlayTogetherRoom:
    | { mode: "host"; episodeId: string }
    | { mode: "join"; inviteToken: string }
    | { mode: "room"; roomId: string };
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
