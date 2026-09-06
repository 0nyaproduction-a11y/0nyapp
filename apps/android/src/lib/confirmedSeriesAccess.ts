import type { SeriesResponse } from "../types/api";

// Display hints only. Every playback still requires server authorization.
export type AccessRequestScope = Readonly<{ identity: number; revision: number }>;
type ConfirmedSeriesAccessListener = (seriesResponse: SeriesResponse | null) => void;
let userId: string | null = null;
let identity = 0;
let revision = 0;
const currentTokens = new Set<string>();

const confirmedSeriesAccessBySlug = new Map<string, SeriesResponse>();
const confirmedSeriesAccessListeners = new Set<ConfirmedSeriesAccessListener>();

export function setConfirmedAccessIdentity(nextUserId: string | null, accessToken?: string | null, beforeInvalidate?: () => void) {
  const changed = userId !== nextUserId;
  if (changed) {
    userId = nextUserId;
    identity += 1;
    currentTokens.clear();
  }
  if (nextUserId && accessToken) currentTokens.add(accessToken);
  if (changed) {
    beforeInvalidate?.();
    invalidateConfirmedSeriesAccess();
  }
  return changed;
}

export function captureRequestIdentity(): AccessRequestScope {
  return { identity, revision };
}

export function captureAccessRequest(accessToken?: string | null): AccessRequestScope | null {
  if (accessToken ? !currentTokens.has(accessToken) : userId !== null) return null;
  return { identity, revision };
}

export function isCurrentAccessIdentity(scope: AccessRequestScope | null) {
  return scope !== null && scope.identity === identity;
}

export function registerRefreshedAccessToken(scope: AccessRequestScope | null, nextUserId: string, token: string) {
  if (!isCurrentAccessIdentity(scope) || nextUserId !== userId) return false;
  currentTokens.add(token);
  return true;
}

export function isCurrentAccessRequest(scope: AccessRequestScope | null) {
  return isCurrentAccessIdentity(scope) && scope?.revision === revision;
}

export function invalidateConfirmedSeriesAccess() {
  revision += 1;
  confirmedSeriesAccessBySlug.clear();
  confirmedSeriesAccessListeners.forEach((listener) => listener(null));
}

export function getConfirmedSeriesAccess(seriesSlug?: string | null) {
  if (!seriesSlug) {
    return null;
  }

  return confirmedSeriesAccessBySlug.get(seriesSlug) ?? null;
}

export function getConfirmedPlayableEpisode(response: SeriesResponse, episodeNumber: number) {
  const episode = response.series.episodes.find((candidate) => candidate.number === episodeNumber);
  const access = episode ? response.episodeAccess[String(episodeNumber)] : undefined;
  return episode && access?.canWatch ? { episode, access } : null;
}

export function publishConfirmedSeriesAccess(seriesResponse: SeriesResponse, scope: AccessRequestScope | null) {
  if (!isCurrentAccessRequest(scope)) return false;
  // Replace the entire server decision, including denials and removed episodes.
  confirmedSeriesAccessBySlug.set(seriesResponse.series.slug, seriesResponse);

  confirmedSeriesAccessListeners.forEach((listener) => {
    listener(seriesResponse);
  });
  return true;
}

export function subscribeConfirmedSeriesAccess(listener: ConfirmedSeriesAccessListener) {
  confirmedSeriesAccessListeners.add(listener);

  return () => {
    confirmedSeriesAccessListeners.delete(listener);
  };
}
