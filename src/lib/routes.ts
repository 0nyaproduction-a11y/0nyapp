export function seriesPath(slug: string) {
  return `/series/${slug}`;
}

export function watchEpisodePath(seriesSlug: string, episodeNumber: number) {
  return `/watch/${seriesSlug}/${episodeNumber}`;
}

export function shortFilmPath(slug: string) {
  return `/short-films/${slug}`;
}

export function purchaseEpisodePath(seriesSlug: string, episodeNumber: number) {
  return `/purchase/${seriesSlug}/${episodeNumber}`;
}

export const accountPath = "/account";
export const deleteAccountPath = "/delete-account";
export const walletPath = "/wallet";
export const plansPath = "/plans";
export const loginPath = "/login";
export const adminPath = "/admin";
export const adminLoginPath = "/admin/login";
export const adminResetPasswordPath = "/admin/reset-password";

export const seriesListPath = "/admin/series";
export const seriesNewPath = "/admin/series/new";
export const mediaListPath = "/admin/media";
export const shortFilmListPath = "/admin/short-films";
export const shortFilmNewPath = "/admin/short-films/new";
export const billingListPath = "/admin/billing";
export const homeListPath = "/admin/home";

export function withListContext(path: string, query?: Record<string, string>): string {
  if (!query) return path;

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

// ---------------------------------------------------------------------------
// CMS-C08B-05 — list-context preservation (short films).
// Reuses withListContext above; no parallel navigation system.
// ---------------------------------------------------------------------------

export const SHORT_FILM_LIST_QUERY_KEYS = ["page", "pageSize", "search", "status"] as const;

export type ShortFilmListQueryKey = (typeof SHORT_FILM_LIST_QUERY_KEYS)[number];

export const SHORT_FILM_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export const DEFAULT_SHORT_FILM_PAGE_SIZE = 25;

export const SHORT_FILM_STATUSES = ["draft", "published", "archived"] as const;

function sanitizePageValue(raw: unknown): string | null {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 10000) return null;
  return String(n);
}

function sanitizePageSizeValue(raw: unknown): string | null {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  if (!SHORT_FILM_PAGE_SIZE_OPTIONS.includes(n as (typeof SHORT_FILM_PAGE_SIZE_OPTIONS)[number])) return null;
  return String(n);
}

function sanitizeSearchValue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 120);
  return trimmed ? trimmed : null;
}

function sanitizeStatusValue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if ((SHORT_FILM_STATUSES as readonly string[]).includes(trimmed)) return trimmed;
  return null;
}

/**
 * Narrow an arbitrary query record to the whitelisted short-film list keys,
 * validating each value. Unknown keys are dropped so arbitrary/foreign params
 * can never be injected into return URLs.
 */
export function sanitizeShortFilmListQuery(
  query?: Record<string, string | string[] | undefined | null>,
): Record<string, string> {
  if (!query) return {};
  const out: Record<string, string> = {};
  const page = sanitizePageValue(Array.isArray(query.page) ? query.page[0] : query.page);
  const pageSize = sanitizePageSizeValue(Array.isArray(query.pageSize) ? query.pageSize[0] : query.pageSize);
  const search = sanitizeSearchValue(Array.isArray(query.search) ? query.search[0] : query.search);
  const status = sanitizeStatusValue(Array.isArray(query.status) ? query.status[0] : query.status);
  if (page) out.page = page;
  if (pageSize) out.pageSize = pageSize;
  if (search) out.search = search;
  if (status) out.status = status;
  return out;
}

/**
 * Sanitize a return target to the canonical admin list path.
 * - Relative admin path with the canonical pathname → kept (query whitelisted).
 * - Missing, malformed, external (http/https/protocol-relative), or non-admin
 *   targets → canonical path.
 * Refresh/deep-link safe: never throws, always returns a usable admin URL.
 */
export function sanitizeAdminReturnTarget(
  rawTarget: string | undefined | null,
  canonicalPath: string,
  allowedKeys: readonly string[],
): string {
  if (!rawTarget || typeof rawTarget !== "string") return canonicalPath;
  const trimmed = rawTarget.trim();
  if (!trimmed.startsWith("/")) return canonicalPath;
  if (trimmed.startsWith("//")) return canonicalPath;
  if (trimmed.includes("\\")) return canonicalPath;
  let pathname = trimmed;
  let search = "";
  const qIndex = trimmed.indexOf("?");
  if (qIndex >= 0) {
    pathname = trimmed.slice(0, qIndex);
    search = trimmed.slice(qIndex + 1);
  }
  if (pathname !== canonicalPath) return canonicalPath;
  if (!search) return canonicalPath;
  let parsed: URLSearchParams;
  try {
    parsed = new URLSearchParams(search);
  } catch {
    return canonicalPath;
  }
  const filtered: Record<string, string> = {};
  for (const key of allowedKeys) {
    const value = parsed.get(key);
    if (value === null || value === "") continue;
    filtered[key] = value;
  }
  const sanitized = sanitizeShortFilmListQuery(filtered);
  return withListContext(canonicalPath, sanitized);
}

/**
 * Build the short-film list return href from the edit page's own searchParams.
 * Sanitizes first, then reuses withListContext — single navigation system.
 */
export function shortFilmListReturnHref(
  query?: Record<string, string | string[] | undefined | null>,
): string {
  return withListContext(shortFilmListPath, sanitizeShortFilmListQuery(query));
}

export function seriesEditPath(seriesId: string) {
  return `/admin/series/${seriesId}`;
}

export function episodeNewPath(seriesId: string) {
  return `/admin/series/${seriesId}/episodes/new`;
}

export function episodeBulkUploadPath(seriesId: string) {
  return `/admin/series/${seriesId}/episodes/bulk-upload`;
}

export function episodeEditPath(seriesId: string, episodeId: string) {
  return `/admin/series/${seriesId}/episodes/${episodeId}`;
}

export function shortFilmEditPath(shortFilmId: string) {
  return `/admin/short-films/${shortFilmId}`;
}