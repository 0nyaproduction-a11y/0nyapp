import type { ApiEpisode, ApiSeries } from "../types/api";

export type EffectiveClassification = {
  contentRating: ApiSeries["contentRating"] | ApiEpisode["contentRating"];
  contentDescriptors: string[];
  parentalLockRequired: boolean;
  ageVerificationRequired: boolean;
};

function getDescriptors(series: ApiSeries, episode?: ApiEpisode | null) {
  return episode?.contentDescriptorsOverride.length
    ? episode.contentDescriptorsOverride
    : series.contentDescriptors;
}

export function resolveEffectiveEpisodeClassification(
  series: ApiSeries,
  episode: ApiEpisode,
): EffectiveClassification {
  const contentRating = episode.contentRatingOverride ?? series.contentRating;
  const contentDescriptors = getDescriptors(series, episode);

  return {
    contentRating,
    contentDescriptors,
    parentalLockRequired: contentRating === "U/A 13+" || contentRating === "U/A 16+" || contentRating === "A",
    ageVerificationRequired: contentRating === "A",
  };
}

export function resolveEffectiveSeriesClassification(series: ApiSeries): EffectiveClassification {
  return {
    contentRating: series.contentRating,
    contentDescriptors: series.contentDescriptors,
    parentalLockRequired:
      series.contentRating === "U/A 13+" ||
      series.contentRating === "U/A 16+" ||
      series.contentRating === "A",
    ageVerificationRequired: series.contentRating === "A",
  };
}
