import { getMobileEnv } from "../config/env";
import type {
  PlayTogetherCreateRoomResponse,
  PlayTogetherFeatureConfig,
  PlayTogetherHeartbeatResponse,
  PlayTogetherInviteResponse,
  PlayTogetherJoinRoomResponse,
  PlayTogetherRevokedInvite,
  PlayTogetherRoomCommand,
  PlayTogetherRoomCommandRequest,
  PlayTogetherRoomState,
} from "../types/playTogether";
import type {
  AccountDeleteResponse,
  ApiEnvelope,
  ApiSeries,
  ApiShortFilm,
  CatalogResponse,
  ChaiTipResponse,
  EpisodePurchaseResponse,
  GooglePlayBillingBoundaryResponse,
  MeResponse,
  ParentalControlActionResponse,
  ParentalControlStatusResponse,
  RewardedAdAttemptResponse,
  RewardedProgressResponse,
  PlaybackAuthorizationResponse,
  PreviewPlaybackAuthorizationResponse,
  SeriesResponse,
  ShortFilmResponse,
  WalletResponse,
  WatchProgressResponse,
  WatchProgressWriteRequest,
  WatchProgressWriteResponse,
} from "../types/api";
import { publishConfirmedSeriesAccess } from "./confirmedSeriesAccess";
import { perfEnd, perfMark, perfStart } from "./perf";
import { supabase } from "./supabase";

type ApiRequestOptions = {
  accessToken?: string | null;
  body?: unknown;
  method?: "GET" | "POST" | "PUT" | "PATCH";
  _isRetry?: boolean;
};

const CATALOG_CACHE_TTL_MS = 15000;
const SERIES_CACHE_TTL_MS = 15000;

type CatalogCacheEntry = {
  expiresAt: number;
  value: CatalogResponse;
};

type SeriesCacheEntry = {
  expiresAt: number;
  value: SeriesResponse;
};

const catalogCache = new Map<string, CatalogCacheEntry>();
const seriesCache = new Map<string, SeriesCacheEntry>();
const catalogInFlight = new Map<string, Promise<CatalogResponse>>();
const seriesInFlight = new Map<string, Promise<SeriesResponse>>();
const loggedApiBaseUrls = new Set<string>();

function getAuthScopedCacheKey(accessToken?: string | null) {
  return accessToken ? `auth:${accessToken}` : "guest";
}

function getSafeApiPath(path: string) {
  return path.split("?")[0] || path;
}

export type PlaybackAuthorizationRequest =
  | {
      episodeNumber: number;
      seriesSlug: string;
      targetType: "SERIES_EPISODE";
      stillAtSeconds?: number;
    }
  | {
      slug: string;
      targetType: "SHORT_FILM";
      stillAtSeconds?: number;
    };

export type PlaybackAuthorizationAuth = {
  guestCredential?: string | null;
  parentalSessionToken?: string | null;
};

export type PreviewPlaybackAuthorizationRequest = {
  episodeNumber: number;
  seriesSlug: string;
  targetType: "SERIES_EPISODE";
};

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type RecoveryCopy = {
  body: string;
  title: string;
};

export function getRequestRecoveryCopy(error: unknown, fallback: RecoveryCopy): RecoveryCopy {
  if (error instanceof ApiError && error.code === "network_error") {
    return {
      body: "Check your connection and try again.",
      title: "No connection",
    };
  }

  return fallback;
}

function normalizeCatalogResponse(payload: unknown): CatalogResponse {
  const candidate =
    payload && typeof payload === "object"
      ? (payload as Partial<CatalogResponse>)
      : {};
  const envelope =
    "data" in candidate && candidate.data && typeof candidate.data === "object"
      ? (candidate.data as Partial<CatalogResponse>)
      : candidate;

  const normalized = {
    catalog: Array.isArray(envelope.catalog) ? (envelope.catalog as ApiSeries[]) : [],
    home:
      envelope.home && typeof envelope.home === "object"
        ? envelope.home
        : null,
    shortFilms: Array.isArray(envelope.shortFilms) ? (envelope.shortFilms as ApiShortFilm[]) : [],
  };

  return normalized;
}

async function requestApi<T>(path: string, options: ApiRequestOptions = {}) {
  const { apiBaseUrl } = getMobileEnv();
  const method = options.method ?? "GET";
  const safePath = getSafeApiPath(path);

  if (__DEV__ && !loggedApiBaseUrls.has(apiBaseUrl)) {
    loggedApiBaseUrls.add(apiBaseUrl);
    console.info("[0nya api diagnostics]", {
      apiBaseUrl,
      source: "EXPO_PUBLIC_ONYA_API_BASE_URL",
    });
  }

  const requestMeasure = perfStart("API_REQUEST", {
    method,
    path: safePath,
    source: "NETWORK",
  });
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      method,
    });
  } catch (error) {
    perfEnd(requestMeasure, {
      method,
      path: safePath,
      source: "NETWORK",
      status: 0,
    });
    console.error(
      "[0nya catalog requestApi fetch]",
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error.stack : undefined,
    );
    throw new ApiError("network_error", "Could not reach 0nya.", 0);
  }

  if (response.status === 401 && options.accessToken && !options._isRetry) {
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData.session) {
        const newAccessToken = refreshData.session.access_token;
        return await requestApi<T>(path, {
          ...options,
          accessToken: newAccessToken,
          _isRetry: true,
        });
      } else if (refreshError) {
        const isAuthError = refreshError.status && refreshError.status >= 400 && refreshError.status < 500;
        if (isAuthError) {
          await supabase.auth.signOut({ scope: "local" });
        } else {
          throw new ApiError("network_error", "Could not reach 0nya during session refresh.", 0);
        }
      }
    } catch (refreshException) {
      if (refreshException instanceof ApiError) {
        throw refreshException;
      }
      throw new ApiError("network_error", "Could not reach 0nya during session refresh.", 0);
    }
  }

  let body: ApiEnvelope<T> | T;

  try {
    body = (await response.json()) as ApiEnvelope<T> | T;
  } catch (error) {
    perfEnd(requestMeasure, {
      method,
      path: safePath,
      source: "NETWORK",
      status: response.status,
    });
    console.error(
      "[0nya catalog requestApi json]",
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error.stack : undefined,
    );
    throw new ApiError(
      "invalid_response",
      "The server returned an invalid response.",
      response.status,
    );
  }

  if (body && typeof body === "object" && "error" in body) {
    if (body.error.code === "not_authenticated" && options.accessToken && !options._isRetry) {
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session) {
          const newAccessToken = refreshData.session.access_token;
          return await requestApi<T>(path, {
            ...options,
            accessToken: newAccessToken,
            _isRetry: true,
          });
        } else if (refreshError) {
          const isAuthError = refreshError.status && refreshError.status >= 400 && refreshError.status < 500;
          if (isAuthError) {
            await supabase.auth.signOut({ scope: "local" });
          } else {
            throw new ApiError("network_error", "Could not reach 0nya during session refresh.", 0);
          }
        }
      } catch (refreshException) {
        if (refreshException instanceof ApiError) {
          throw refreshException;
        }
        throw new ApiError("network_error", "Could not reach 0nya during session refresh.", 0);
      }
    }

    perfEnd(requestMeasure, {
      method,
      path: safePath,
      source: "NETWORK",
      status: response.status,
    });
    throw new ApiError(body.error.code, body.error.message, response.status);
  }

  perfEnd(requestMeasure, {
    method,
    path: safePath,
    source: "NETWORK",
    status: response.status,
  });

  if (body && typeof body === "object" && "data" in body && body.data !== undefined) {
    return body.data as T;
  }

  return body as T;
}

export function getCatalog(accessToken?: string | null) {
  const cacheKey = getAuthScopedCacheKey(accessToken);
  const cached = catalogCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    perfMark("API_REQUEST_END", {
      duration_ms: 0,
      method: "GET",
      path: "/api/v1/catalog",
      source: "CACHE",
      status: 200,
    });
    return Promise.resolve(cached.value);
  }

  const inFlight = catalogInFlight.get(cacheKey);

  if (inFlight) {
    perfMark("API_REQUEST_END", {
      duration_ms: 0,
      method: "GET",
      path: "/api/v1/catalog",
      source: "DEDUPED",
      status: 0,
    });
    return inFlight;
  }

  const request = requestApi<CatalogResponse>("/api/v1/catalog", { accessToken })
    .then((payload) => {
      const normalized = normalizeCatalogResponse(payload);
      catalogCache.set(cacheKey, {
        expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
        value: normalized,
      });
      return normalized;
    })
    .finally(() => {
      catalogInFlight.delete(cacheKey);
    });

  catalogInFlight.set(cacheKey, request);
  return request;
}

export function getSeries(slug: string, accessToken?: string | null) {
  const normalizedSlug = slug.trim();
  const requestKey = `${getAuthScopedCacheKey(accessToken)}:${normalizedSlug}`;
  const cached = seriesCache.get(requestKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    perfMark("API_REQUEST_END", {
      duration_ms: 0,
      method: "GET",
      path: "/api/v1/series/:slug",
      source: "CACHE",
      status: 200,
    });
    return Promise.resolve(cached.value);
  }

  const inFlight = seriesInFlight.get(requestKey);

  if (inFlight) {
    perfMark("API_REQUEST_END", {
      duration_ms: 0,
      method: "GET",
      path: "/api/v1/series/:slug",
      source: "DEDUPED",
      status: 0,
    });
    return inFlight;
  }

  const request = requestApi<SeriesResponse>(`/api/v1/series/${encodeURIComponent(normalizedSlug)}`, {
    accessToken,
  })
    .then((seriesResponse) => {
      seriesCache.set(requestKey, {
        expiresAt: Date.now() + SERIES_CACHE_TTL_MS,
        value: seriesResponse,
      });
      publishConfirmedSeriesAccess(seriesResponse);
      return seriesResponse;
    })
    .finally(() => {
      seriesInFlight.delete(requestKey);
    });

  seriesInFlight.set(requestKey, request);
  return request;
}

export function isShortFilmPublished(shortFilm: Partial<ApiShortFilm> | null | undefined) {
  if (!shortFilm) {
    return false;
  }

  if (shortFilm.status !== "published") {
    return false;
  }

  if (typeof shortFilm.publishAt === "string" && shortFilm.publishAt.trim().length > 0) {
    const publishTime = Date.parse(shortFilm.publishAt);
    if (!Number.isNaN(publishTime) && publishTime > Date.now()) {
      return false;
    }
  }

  return true;
}

export function getShortFilm(slug: string, accessToken?: string | null) {
  return requestApi<ShortFilmResponse>(`/api/v1/short-films/${encodeURIComponent(slug)}`, {
    accessToken,
  }).then((payload) => {
    if (!payload || !payload.shortFilm || !isShortFilmPublished(payload.shortFilm)) {
      throw new ApiError("not_found", "This title is unavailable right now.", 404);
    }

    return payload;
  });
}

export function submitShortFilmChaiTip(
  accessToken: string,
  slug: string,
  coinAmount: number,
  idempotencyKey: string,
) {
  return requestApi<ChaiTipResponse>(`/api/v1/short-films/${encodeURIComponent(slug)}/chai`, {
    accessToken,
    body: {
      coinAmount,
      idempotencyKey,
    },
    method: "POST",
  });
}

export function getMe(accessToken: string) {
  return requestApi<MeResponse>("/api/v1/me", { accessToken });
}

export function getWallet(accessToken: string) {
  return requestApi<WalletResponse>("/api/v1/wallet", { accessToken });
}

export function submitGooglePlayBillingBoundary(
  accessToken: string,
  body: {
    googleProductId?: string | null;
    kind?: "coin_pack" | "subscription";
    mode: "purchase" | "restore";
    productCode?: string | null;
    scenario?: string | null;
    testOnly?: boolean;
  },
) {
  return requestApi<GooglePlayBillingBoundaryResponse>("/api/v1/billing/google-play", {
    accessToken,
    body,
    method: "POST",
  });
}

export function getWatchProgress(accessToken: string) {
  return requestApi<WatchProgressResponse>("/api/v1/watch-progress", {
    accessToken,
  });
}

export function putWatchProgress(
  accessToken: string,
  progress: WatchProgressWriteRequest,
) {
  return requestApi<WatchProgressWriteResponse>("/api/v1/watch-progress", {
    accessToken,
    body: progress,
    method: "PUT",
  });
}

export function purchaseEpisodeWithCoins(accessToken: string, episodeId: string) {
  return requestApi<EpisodePurchaseResponse>(
    `/api/v1/episodes/${encodeURIComponent(episodeId)}/purchase`,
    {
      accessToken,
      method: "POST",
    },
  );
}

export function createRewardedAdAttempt(accessToken: string, episodeId: string) {
  return requestApi<RewardedAdAttemptResponse>(
    `/api/v1/episodes/${encodeURIComponent(episodeId)}/rewarded`,
    {
      accessToken,
      method: "POST",
    },
  );
}

export function getRewardedAdAttemptStatus(accessToken: string, customData: string) {
  return requestApi<RewardedAdAttemptResponse>(
    `/api/v1/rewarded-ad-attempts/${encodeURIComponent(customData)}`,
    {
      accessToken,
    },
  );
}

export function getRewardedProgress(accessToken: string, episodeId: string) {
  return requestApi<RewardedProgressResponse>(
    `/api/v1/episodes/${encodeURIComponent(episodeId)}/rewarded/progress`,
    {
      accessToken,
    },
  );
}

export type RecordRewardedEventArgs = {
  eventType:
    | "rewarded_offer_shown"
    | "rewarded_cta_selected"
    | "rewarded_no_fill"
    | "rewarded_load_failed";
  episodeId?: string | null;
  adIndex?: number | null;
  requiredCount?: number | null;
  resultingProgress?: number | null;
  metadata?: Record<string, unknown> | null;
};

export function recordRewardedEvent(accessToken: string, args: RecordRewardedEventArgs) {
  return requestApi<{ recorded: boolean }>("/api/v1/monetization/rewarded-events", {
    accessToken,
    body: {
      eventType: args.eventType,
      episodeId: args.episodeId ?? null,
      adIndex: args.adIndex ?? null,
      requiredCount: args.requiredCount ?? null,
      resultingProgress: args.resultingProgress ?? null,
      metadata: args.metadata ?? {},
    },
    method: "POST",
  });
}

export function deleteAccount(accessToken: string) {
  return requestApi<AccountDeleteResponse>("/api/v1/account/delete", {
    accessToken,
    method: "POST",
  });
}

export function getParentalControlStatus(
  accessToken?: string | null,
  guestCredential?: string | null,
) {
  const path = guestCredential
    ? `/api/v1/account/parental-controls?guestCredential=${encodeURIComponent(guestCredential)}`
    : "/api/v1/account/parental-controls";

  return requestApi<ParentalControlStatusResponse>(path, {
    accessToken,
  });
}

export function saveParentalControlPin(
  accessToken: string | null,
  body: { currentPin?: string; guestCredential?: string | null; pin: string; mode?: "set" | "verify" },
) {
  return requestApi<ParentalControlActionResponse>("/api/v1/account/parental-controls", {
    accessToken,
    body,
    method: "POST",
  });
}

export function saveParentalRestrictionSettings(
  accessToken: string | null,
  body: {
    guestCredential?: string | null;
    restrictionsEnabled: boolean;
    restrictionThreshold?: "U/A 13+" | "U/A 16+" | null;
  },
) {
  return requestApi<ParentalControlActionResponse>("/api/v1/account/parental-controls", {
    accessToken,
    body: {
      ...body,
      mode: "settings",
    },
    method: "POST",
  });
}

export function authorizePlayback(
  accessToken: string | null | undefined,
  body: PlaybackAuthorizationRequest & PlaybackAuthorizationAuth,
) {
  return requestApi<PlaybackAuthorizationResponse>("/api/v1/playback", {
    accessToken,
    body,
    method: "POST",
  }).then((response) =>
    response && typeof response === "object" && "playbackUrl" in response
      ? { ...response, status: "ok" as const }
      : response,
  );
}

export function authorizePreviewPlayback(
  accessToken: string | null | undefined,
  body: PreviewPlaybackAuthorizationRequest & PlaybackAuthorizationAuth,
) {
  return requestApi<PreviewPlaybackAuthorizationResponse>("/api/v1/playback/preview", {
    accessToken,
    body,
    method: "POST",
  }).then((response) =>
    response && typeof response === "object" && "previewUrl" in response
      ? { ...response, status: "ok" as const }
      : response,
  );
}

// PX01-C — Play Together bounded room client.
//
// Room state is backend-authoritative. These functions only shape requests to
// the existing PX01-B API; they never write, apply, or schedule playback/chat
// commands (those belong to later PX01 milestones), and they never fabricate
// room state locally. Invite tokens are connection-only and must never be
// logged, persisted, or sent to analytics.

export function createPlayTogetherRoom(accessToken: string, episodeId: string) {
  return requestApi<PlayTogetherCreateRoomResponse>("/api/v1/play-together/rooms", {
    accessToken,
    body: { episodeId },
    method: "POST",
  });
}

export function getPlayTogetherRoom(accessToken: string, roomId: string) {
  return requestApi<{ room: PlayTogetherRoomState }>(
    `/api/v1/play-together/rooms/${encodeURIComponent(roomId)}`,
    { accessToken },
  );
}

export function createPlayTogetherInvite(accessToken: string, roomId: string) {
  return requestApi<PlayTogetherInviteResponse>(
    `/api/v1/play-together/rooms/${encodeURIComponent(roomId)}/invites`,
    { accessToken, method: "POST" },
  );
}

export function revokePlayTogetherInvite(accessToken: string, roomId: string, inviteId: string) {
  return requestApi<{ invite: PlayTogetherRevokedInvite }>(
    `/api/v1/play-together/rooms/${encodeURIComponent(roomId)}/invites/${encodeURIComponent(inviteId)}/revoke`,
    { accessToken, method: "PATCH" },
  );
}

export function joinPlayTogetherRoom(accessToken: string, inviteToken: string) {
  return requestApi<PlayTogetherJoinRoomResponse>("/api/v1/play-together/rooms/join", {
    accessToken,
    body: { inviteToken },
    method: "POST",
  });
}

export function getPlayTogetherHeartbeat(accessToken: string, roomId: string) {
  return requestApi<PlayTogetherHeartbeatResponse>(
    `/api/v1/play-together/rooms/${encodeURIComponent(roomId)}/heartbeat`,
    { accessToken },
  );
}

// PX01-D: Host playback commands. Only the Host may issue them (backend
// enforces not_host); the command is never applied locally, only POSTed, and
// guests converge by applying the canonical room state.
export function sendPlayTogetherRoomCommand(
  accessToken: string,
  roomId: string,
  command: PlayTogetherRoomCommandRequest,
) {
  return requestApi<{ command: PlayTogetherRoomCommand }>(
    `/api/v1/play-together/rooms/${encodeURIComponent(roomId)}/commands`,
    { accessToken, body: command, method: "POST" },
  );
}

// PX01-C1: Read-only consumer visibility seam. Public (no access token) so the
// feature gate can be resolved before sign-in. The Android client never
// supplies/overrides `enabled`; it consumes the server value only.
export function getPlayTogetherConfig() {
  return requestApi<PlayTogetherFeatureConfig>("/api/v1/play-together/config");
}
