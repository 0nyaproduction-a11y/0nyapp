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
  rewardedAccessMode: "permanent";
  requiredRewardedCompletions: number;
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
  id?: string;
  title: string;
  slug: string;
  contentType?: "MICRO_DRAMA";
  publishedAt?: string | null;
  language?: string | null;
  genre: string | null;
  primaryGenre?: ApiGenre | null;
  secondaryGenres?: ApiGenre[];
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

export type ApiGenre = {
  id: string;
  displayName: string;
};

export type ApiShortFilm = {
  id: string;
  slug: string;
  title: string;
  contentType?: "SHORT_FILM";
  synopsis: string;
  genre?: string | null;
  primaryGenre?: ApiGenre | null;
  secondaryGenres?: ApiGenre[];
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
  evidence: {
    occurredAt: string;
    transactionId: string;
  } | null;
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

export type HomeSpotlight = {
  contentType: HomeContentType;
  format: string | null;
  genre: string | null;
  id: string;
  poster: string | null;
  slug: string;
  synopsis: string | null;
  title: string;
  sharePath: string;
  showTitle: boolean;
};

export type HomeRowItem = {
  id: string;
  slug: string;
  contentType: HomeContentType;
  title: string;
  poster: string | null;
  showTitle?: boolean;
  source?: "editorial_pin" | "deterministic_release_date";
};

export type HomeRow = {
  id: string;
  slug: string;
  title: string;
  role: "start_here" | "editorial" | "spotlight" | "category";
  enabled: boolean;
  sortOrder: number;
  rankingPolicy: "editorial";
  rankingPolicyVersion: "home_editorial_v1";
  configVersion: string;
  configHash: string;
  rankingDecisionId: string;
  items: HomeRowItem[];
};

export type HomeState = {
  state: "H01" | "H02" | null;
  startHereVisible: boolean | null;
  viewerStateKnown: boolean;
  lowHistoryThreshold: number | null;
  completedCount: number;
  isGuest: boolean;
  spotlight: HomeSpotlight | null;
  spotlights: HomeSpotlight[];
  spotlightRowId: string | null;
  spotlightRankingDecisionId: string | null;
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
  | "already_accessible"
  | "rewarded_disabled"
  | "not_found";

export type RewardedAdAttemptResponse = {
  customData: string | null;
  expiresAt: string | null;
  status: RewardedAdAttemptStatus;
  verifiedProgress: number | null;
  requiredCompletions: number | null;
};

export type RewardedProgressResponse = {
  verifiedProgress: number;
  requiredCompletions: number;
  state:
    | "none"
    | "partial"
    | "complete"
    | "disabled"
    | "not_found"
    | "not_authenticated";
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

export type GooglePlayBillingBoundaryResponse = {
  backendStatus:
    "DEVELOPMENT_TEST_BOUNDARY" | "EXTERNALLY_BLOCKED_NOT_CONFIGURED";
  billingPlan: "weekly" | "monthly" | "yearly" | null;
  entitlementChanged: boolean;
  googleProductConfigured: boolean;
  kind: "coin_pack" | "subscription" | null;
  mode: "purchase" | "restore";
  productCode: string | null;
  scenario: string | null;
  subscription: {
    endsAt: string | null;
    planCode: string | null;
    status: "active" | "none";
  };
  testOnly: boolean;
  verificationStatus: "test_only_not_google_verified" | "not_configured";
  wallet: {
    coinBalance: number;
  };
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
