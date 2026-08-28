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
  id: string;
  number: number;
  title: string;
  description: string;
  runtime: string;
  isFree: boolean;
  coinPrice: number;
  coinUnlockEnabled: boolean;
  rewardedUnlockEnabled: boolean;
  rewardedAccessMode: "permanent" | "session";
  plusAccess: boolean;
  lockedPreviewSeconds: number;
  contentRatingOverride: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
  contentDescriptorsOverride: (
    | "language"
    | "violence"
    | "sexual content"
    | "substance use"
    | "fear / horror"
    | "mature themes"
  )[];
  contentRating: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
  contentDescriptors: (
    | "language"
    | "violence"
    | "sexual content"
    | "substance use"
    | "fear / horror"
    | "mature themes"
  )[];
  parentalLockRequired: boolean;
  ageVerificationRequired: boolean;
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
  contentRating: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
  contentDescriptors: (
    | "language"
    | "violence"
    | "sexual content"
    | "substance use"
    | "fear / horror"
    | "mature themes"
  )[];
  parentalLockRequired: boolean;
  ageVerificationRequired: boolean;
  episodes: ApiEpisode[];
};

export type ApiShortFilm = {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  poster: string;
  heroImage: string | null;
  creatorReference: string | null;
  durationSeconds: number;
  durationLabel: string;
  language: string | null;
  contentRating: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
  contentDescriptors: (
    | "language"
    | "violence"
    | "sexual content"
    | "substance use"
    | "fear / horror"
    | "mature themes"
  )[];
  parentalLockRequired: boolean;
  ageVerificationRequired: boolean;
  status: "draft" | "published" | "archived";
  publishAt: string | null;
  midrollEnabled: boolean;
  midrollTimecodes: number[];
  postrollEnabled: boolean;
  chaiEnabled: boolean;
  playbackReady: boolean;
  sharePath: string;
};

export type ShortFilmChaiAvailability = {
  available: boolean;
  allowedCoinAmounts: number[];
};

export type EpisodeAccess = {
  canWatch: boolean;
  kind: "free" | "owned" | "included" | "subscription" | "locked";
  label: string;
};

export type EpisodePurchaseResponse = {
  success: boolean;
  status:
    | "not_authenticated"
    | "invalid_episode"
    | "insufficient_balance"
    | "already_owned"
    | "active_subscription"
    | "already_accessible"
    | "purchase_success"
    | "purchase_failed";
  remainingBalance: number | null;
};

export type AccountDeleteResponse = {
  success: boolean;
};

export type ParentalControlStatusResponse = {
  failedAttempts: number;
  hasPin: boolean;
  lockedUntil: string | null;
  restrictionsEnabled: boolean;
  restrictionThreshold: "U/A 13+" | "U/A 16+" | null;
};

export type ParentalControlActionResponse = ParentalControlStatusResponse & {
  expiresAt?: string;
  guestCredential?: string;
  success: boolean;
  parentalSessionToken?: string;
  status:
    | "verified"
    | "setup_complete"
    | "updated"
    | "wrong_pin"
    | "locked"
    | "not_configured"
    | "reauth_required"
    | "invalid_pin"
    | "invalid_threshold";
};

export type PlaybackAuthorizationResponse =
  | {
      expiresAt: string;
      playbackUrl: string;
      stillUrl?: string;
      status: "ok";
    }
  | {
      status:
        | "not_found"
        | "parental_required"
        | "access_required"
        | "age_verification_required"
        | "media_not_ready"
        | "playback_unavailable";
    };

export type PreviewPlaybackAuthorizationResponse =
  | {
      expiresAt: string;
      previewSeconds: number;
      previewUrl: string;
      status: "ok";
    }
  | {
      status:
        | "not_found"
        | "parental_required"
        | "access_required"
        | "age_verification_required"
        | "preview_not_required"
        | "preview_not_ready"
        | "preview_unavailable";
    };

export type CatalogResponse = {
  catalog: ApiSeries[];
  home?: HomeState | null;
  shortFilms: ApiShortFilm[];
};

export type HomeContentType = "series" | "short_film";

export type HomeRowItem = {
  id: string;
  contentType: HomeContentType;
  slug: string;
  title: string;
  poster: string | null;
  sharePath: string;
};

export type HomeRow = {
  id: string;
  title: string;
  role: "start_here" | "editorial";
  enabled: boolean;
  sortOrder: number;
  items: HomeRowItem[];
};

export type HomeState = {
  state: "H01" | "H02" | null;
  startHereVisible: boolean | null;
  viewerStateKnown: boolean;
  lowHistoryThreshold: number | null;
  completedCount: number;
  isGuest: boolean;
  rows: HomeRow[];
};

export type SeriesResponse = {
  series: ApiSeries;
  episodeAccess: Record<string, EpisodeAccess>;
};

export type ShortFilmResponse = {
  shortFilm: ApiShortFilm;
  chai: ShortFilmChaiAvailability;
};

export type ChaiTipResponse = {
  remainingBalance: number | null;
  status: string;
  success: boolean;
};

export type RewardedAdAttemptStatus =
  | "pending"
  | "granted"
  | "expired"
  | "failed"
  | "unsupported_pending_policy"
  | "already_accessible"
  | "rewarded_disabled"
  | "not_found";

export type RewardedAdAttemptResponse = {
  customData: string | null;
  expiresAt: string | null;
  status: RewardedAdAttemptStatus;
};

export type MeResponse = {
  id: string;
  displayName: string;
  identifier: string;
  wallet: {
    coinBalance: number;
  };
  subscription: {
    status: "active" | "none";
    label: string;
    planCode: string | null;
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

export type WatchProgressItem = {
  contentType: "series_episode" | "short_film";
  seriesSlug: string | null;
  episodeNumber: number | null;
  shortFilmSlug: string | null;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  adBreakState: {
    pendingBreakSeconds: number | null;
    handledBreakSeconds: number[];
    waivedBreakSeconds: number[];
  };
  lastWatchedAt: string;
};

export type WatchProgressResponse = {
  progress: WatchProgressItem[];
};

export type WatchProgressWriteRequest =
  | {
      contentType?: "series_episode";
      seriesSlug: string;
      episodeNumber: number;
      positionSeconds: number;
    }
  | {
      contentType: "short_film";
      shortFilmSlug: string;
      positionSeconds: number;
      adBreakState?: {
        pendingBreakSeconds: number | null;
        handledBreakSeconds: number[];
        waivedBreakSeconds: number[];
      };
    };

export type WatchProgressWriteResponse = WatchProgressItem;
