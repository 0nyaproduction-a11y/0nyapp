import { getMobileEnv } from "../config/env";
import type {
  ApiEnvelope,
  CatalogResponse,
  MeResponse,
  SeriesResponse,
  WalletResponse,
  WatchProgressResponse,
} from "../types/api";

type ApiRequestOptions = {
  accessToken?: string | null;
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

async function requestApi<T>(path: string, options: ApiRequestOptions = {}) {
  const { apiBaseUrl } = getMobileEnv();
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, { headers });
  } catch {
    throw new ApiError("network_error", "Could not reach 0nya.", 0);
  }

  let body: ApiEnvelope<T>;

  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError("invalid_response", "The server returned an invalid response.", response.status);
  }

  if ("error" in body) {
    throw new ApiError(body.error.code, body.error.message, response.status);
  }

  return body.data;
}

export function getCatalog(accessToken?: string | null) {
  return requestApi<CatalogResponse>("/api/v1/catalog", { accessToken });
}

export function getSeries(slug: string, accessToken?: string | null) {
  return requestApi<SeriesResponse>(`/api/v1/series/${encodeURIComponent(slug)}`, {
    accessToken,
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
