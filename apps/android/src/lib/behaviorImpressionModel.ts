export const IMPRESSION_MIN_VISIBILITY_FRACTION = 0.5;
export const IMPRESSION_MIN_VISIBLE_MS = 1000;

export type ImpressionExposureState = {
  visibleSince: number | null;
  emitted: boolean;
};

export function advanceImpressionExposure(
  state: ImpressionExposureState,
  visibilityFraction: number,
  observedAtMs: number,
): ImpressionExposureState {
  if (state.emitted) return state;
  if (visibilityFraction < IMPRESSION_MIN_VISIBILITY_FRACTION) {
    return { emitted: false, visibleSince: null };
  }
  const visibleSince = state.visibleSince ?? observedAtMs;
  return {
    visibleSince,
    emitted: observedAtMs - visibleSince >= IMPRESSION_MIN_VISIBLE_MS,
  };
}

export function getMeasuredVisibilityFraction(
  item: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
) {
  if (item.width <= 0 || item.height <= 0) return 0;
  const visibleWidth = Math.max(0, Math.min(item.x + item.width, viewport.width) - Math.max(item.x, 0));
  const visibleHeight = Math.max(0, Math.min(item.y + item.height, viewport.height) - Math.max(item.y, 0));
  return (visibleWidth * visibleHeight) / (item.width * item.height);
}

export function markCollectionServed(seen: Set<string>, collectionKey: string) {
  if (seen.has(collectionKey)) return false;
  seen.add(collectionKey);
  return true;
}
