import type { ContentItem, Episode } from "@/data/content";
import type { ShortFilm } from "@/lib/catalog";
import type { EpisodeAccessState } from "@/lib/entitlements";

export function serializeEpisode(episode: Episode) {
  return {
    id: episode.id,
    number: episode.number,
    title: episode.title,
    description: episode.description,
    runtime: episode.runtime,
    isFree: episode.isFree,
    coinPrice: episode.coinPrice ?? 0,
    coinUnlockEnabled: episode.coinUnlockEnabled,
    rewardedUnlockEnabled: episode.rewardedUnlockEnabled,
    rewardedAccessMode: episode.rewardedAccessMode,
    requiredRewardedCompletions: episode.requiredRewardedCompletions,
    plusAccess: episode.plusAccess,
    lockedPreviewSeconds: episode.lockedPreviewSeconds,
    contentRatingOverride: episode.contentRatingOverride ?? null,
    contentDescriptorsOverride: episode.contentDescriptorsOverride ?? [],
    contentRating: episode.contentRating ?? null,
    contentDescriptors: episode.contentDescriptors ?? [],
    parentalLockRequired: episode.parentalLockRequired ?? false,
    ageVerificationRequired: episode.ageVerificationRequired ?? false,
  };
}

export function serializeSeries(series: ContentItem) {
  return {
    title: series.title,
    slug: series.slug,
    genre: series.genre,
    format: series.format,
    episodeCount: series.episodeCount,
    episodeDuration: series.episodeDuration,
    synopsis: series.synopsis,
    poster: series.poster,
    contentRating: series.contentRating ?? null,
    contentDescriptors: series.contentDescriptors ?? [],
    parentalLockRequired: series.parentalLockRequired ?? false,
    ageVerificationRequired: series.ageVerificationRequired ?? false,
    episodes: series.episodes.map(serializeEpisode),
  };
}

export function serializeShortFilm(shortFilm: ShortFilm) {
  return {
    id: shortFilm.id,
    slug: shortFilm.slug,
    title: shortFilm.title,
    synopsis: shortFilm.synopsis,
    poster: shortFilm.poster,
    heroImage: shortFilm.heroImage,
    creatorReference: shortFilm.creatorReference,
    durationSeconds: shortFilm.durationSeconds,
    durationLabel: shortFilm.durationLabel,
    language: shortFilm.language,
    contentRating: shortFilm.contentRating,
    contentDescriptors: shortFilm.contentDescriptors,
    parentalLockRequired: shortFilm.parentalLockRequired,
    ageVerificationRequired: shortFilm.ageVerificationRequired,
    status: shortFilm.status,
    publishAt: shortFilm.publishAt,
    midrollEnabled: shortFilm.midrollEnabled,
    midrollTimecodes: shortFilm.midrollTimecodes,
    postrollEnabled: shortFilm.postrollEnabled,
    chaiEnabled: shortFilm.chaiEnabled,
    playbackReady: shortFilm.playbackReady,
    sharePath: shortFilm.sharePath,
  };
}

export function serializeEpisodeAccess(
  accessByEpisodeNumber: Map<number, EpisodeAccessState>,
) {
  return Object.fromEntries(
    Array.from(accessByEpisodeNumber.entries()).map(([episodeNumber, access]) => [
      episodeNumber,
      {
        canWatch: access.canWatch,
        kind: access.kind,
        label: access.label,
      },
    ]),
  );
}
