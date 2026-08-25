import { getMobileEnv } from "../config/env";
import type {
  AccountDeleteResponse,
  ApiEnvelope,
  ApiSeries,
  ApiShortFilm,
  CatalogResponse,
  ChaiTipResponse,
  EpisodePurchaseResponse,
  MeResponse,
  ParentalControlActionResponse,
  ParentalControlStatusResponse,
  RewardedAdAttemptResponse,
  PlaybackAuthorizationResponse,
  PreviewPlaybackAuthorizationResponse,
  SeriesResponse,
  ShortFilmResponse,
  WalletResponse,
  WatchProgressResponse,
  WatchProgressWriteRequest,
  WatchProgressWriteResponse,
} from "../types/api";

type ApiRequestOptions = {
  accessToken?: string | null;
  body?: unknown;
  method?: "GET" | "POST" | "PUT";
};

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
    shortFilms: Array.isArray(envelope.shortFilms) ? (envelope.shortFilms as ApiShortFilm[]) : [],
  };

  if (__DEV__) {
    console.info("[0nya catalog normalize]", {
      catalogLength: normalized.catalog.length,
      shortFilmsLength: normalized.shortFilms.length,
      firstSeriesSlug: normalized.catalog[0]?.slug,
      firstEpisodeCount: normalized.catalog[0]?.episodes?.length ?? 0,
    });
  }

  return normalized;
}

async function requestApi<T>(path: string, options: ApiRequestOptions = {}) {
  const { apiBaseUrl } = getMobileEnv();
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
      method: options.method ?? "GET",
    });
  } catch (error) {
    console.error(
      "[0nya catalog requestApi fetch]",
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error.stack : undefined,
    );
    throw new ApiError("network_error", "Could not reach 0nya.", 0);
  }

  let body: ApiEnvelope<T> | T;

  try {
    body = (await response.json()) as ApiEnvelope<T> | T;
    if (__DEV__) {
      const entries = body && typeof body === "object" ? Object.keys(body) : [];
      const dataKeys =
        body && typeof body === "object" && "data" in body && body.data && typeof body.data === "object"
          ? Object.keys(body.data as Record<string, unknown>)
          : [];
      console.info("[0nya catalog response]", {
        status: response.status,
        type: typeof body,
        keys: entries,
        dataKeys,
      });
    }
  } catch (error) {
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
    throw new ApiError(body.error.code, body.error.message, response.status);
  }

  if (body && typeof body === "object" && "data" in body && body.data !== undefined) {
    return body.data as T;
  }

  return body as T;
}

export function getCatalog(accessToken?: string | null) {
  return requestApi<CatalogResponse>("/api/v1/catalog", { accessToken }).then((payload) =>
    normalizeCatalogResponse(payload),
  );
}

export function getSeries(slug: string, accessToken?: string | null) {
  return requestApi<SeriesResponse>(`/api/v1/series/${encodeURIComponent(slug)}`, {
    accessToken,
  });
}

export function getShortFilm(slug: string, accessToken?: string | null) {
  return requestApi<ShortFilmResponse>(`/api/v1/short-films/${encodeURIComponent(slug)}`, {
    accessToken,
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
