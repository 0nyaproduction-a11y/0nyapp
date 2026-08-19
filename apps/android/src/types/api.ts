export type ApiEnvelope<T> =
  | {
      data: T;
    }
  | {
      error: {
        code: string;
        message: string;
      };
    };

export type ApiEpisode = {
  number: number;
  title: string;
  description: string;
  runtime: string;
  isFree: boolean;
  coinPrice: number;
};

export type ApiSeries = {
  title: string;
  slug: string;
  genre: string;
  format: string;
  episodeCount: number;
  episodeDuration: string;
  synopsis: string;
  poster: string;
  episodes: ApiEpisode[];
};

export type EpisodeAccess = {
  canWatch: boolean;
  kind: "free" | "owned" | "included" | "locked";
  label: string;
};

export type CatalogResponse = {
  catalog: ApiSeries[];
};

export type SeriesResponse = {
  series: ApiSeries;
  episodeAccess: Record<string, EpisodeAccess>;
};

export type MeResponse = {
  id: string;
  displayName: string;
  identifier: string;
  wallet: {
    balance: number;
  };
  subscription: {
    label: string;
    active: boolean;
    endsAt: string | null;
  };
};

export type WalletResponse = {
  balance: number;
  coinProducts: {
    code: string;
    coinAmount: number;
    displayName: string;
  }[];
  recentTransactions: {
    amount: number;
    type: "credit" | "episode_purchase" | "refund" | "promo";
    createdAt: string;
  }[];
  recentTopUps: {
    status: string;
    provider: string;
    coinAmount: number;
    completedAt: string | null;
    createdAt: string;
  }[];
};

export type WatchProgressResponse = {
  progress: {
    seriesSlug: string;
    episodeNumber: number;
    positionSeconds: number;
    durationSeconds: number;
    completed: boolean;
    lastWatchedAt: string;
  }[];
};
