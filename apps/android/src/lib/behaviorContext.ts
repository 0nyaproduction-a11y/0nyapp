import type { DiscoveryContext } from "../navigation/types";

export function toPlaybackOriginContext(origin?: DiscoveryContext) {
  return {
    sourceSurface: origin?.sourceSurface ?? ("direct" as const),
    rowId: origin && "rowId" in origin ? origin.rowId : null,
    position: origin ? ("searchResultPosition" in origin ? origin.searchResultPosition : origin.position) : null,
    searchQueryContext: origin && "searchQueryContext" in origin ? origin.searchQueryContext : null,
    searchResultPosition: origin && "searchResultPosition" in origin ? origin.searchResultPosition : null,
    rankingDecisionId: origin?.rankingDecisionId ?? null,
    recommendationReason: origin?.recommendationReason ?? null,
  };
}
