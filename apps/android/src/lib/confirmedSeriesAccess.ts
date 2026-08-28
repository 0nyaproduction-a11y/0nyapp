import type { SeriesResponse } from "../types/api";

type ConfirmedSeriesAccessListener = (seriesResponse: SeriesResponse) => void;

const confirmedSeriesAccessBySlug = new Map<string, SeriesResponse>();
const confirmedSeriesAccessListeners = new Set<ConfirmedSeriesAccessListener>();

export function getConfirmedSeriesAccess(seriesSlug?: string | null) {
  if (!seriesSlug) {
    return null;
  }

  return confirmedSeriesAccessBySlug.get(seriesSlug) ?? null;
}

export function publishConfirmedSeriesAccess(seriesResponse: SeriesResponse) {
  confirmedSeriesAccessBySlug.set(seriesResponse.series.slug, seriesResponse);

  confirmedSeriesAccessListeners.forEach((listener) => {
    listener(seriesResponse);
  });
}

export function subscribeConfirmedSeriesAccess(listener: ConfirmedSeriesAccessListener) {
  confirmedSeriesAccessListeners.add(listener);

  return () => {
    confirmedSeriesAccessListeners.delete(listener);
  };
}
