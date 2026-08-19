import type { ApiEpisode, ApiSeries, EpisodeAccess } from "../types/api";

export type RootStackParamList = {
  SignIn: undefined;
  Home: undefined;
  Series: {
    slug: string;
  };
  Watch: {
    series: ApiSeries;
    episode: ApiEpisode;
    access: EpisodeAccess;
  };
  Wallet: undefined;
  Account: undefined;
};
