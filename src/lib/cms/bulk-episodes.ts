import type { ContentDescriptor, ContentRating } from "@/lib/classification";
import { type EpisodeInput } from "@/lib/cms/episodes";
import { type RewardedAccessMode } from "@/lib/cms/constants";

export type BulkEpisodeDefaults = {
  isFree: boolean;
  coinUnlockEnabled: boolean;
  coinPrice: number;
  rewardedUnlockEnabled: boolean;
  rewardedAccessMode: RewardedAccessMode;
  requiredRewardedCompletions: number;
  plusAccess: boolean;
  lockedPreviewSeconds: number;
  contentRatingOverride: ContentRating | null;
  contentDescriptorsOverride: ContentDescriptor[];
};

export type BulkEpisodeCreateInput = {
  episodeNumber: number;
  title: string;
  durationSeconds: number;
  defaults: BulkEpisodeDefaults;
};

export type BulkEpisodeCreateResult =
  | {
      success: true;
      episode: {
        duration_seconds: number;
        id: string;
        episode_number: number;
        media_asset_id: string | null;
        status: string;
        title: string | null;
      };
    }
  | {
      success: false;
      error: string;
    };

export type BulkEpisodeFinalizeResult =
  | {
      assigned: boolean;
      episodeId: string;
      mediaAssetId: string;
      mediaStatus: "pending" | "processing" | "ready" | "failed";
      success: true;
    }
  | {
      error: string;
      mediaStatus?: "pending" | "processing" | "ready" | "failed" | "not_found";
      success: false;
    };

export function buildEpisodeInputForBulkCreate(input: BulkEpisodeCreateInput): EpisodeInput {
  return {
    episodeNumber: input.episodeNumber,
    title: input.title.trim().length > 0 ? input.title.trim() : null,
    synopsis: null,
    durationSeconds: Math.max(0, Math.trunc(input.durationSeconds)),
    thumbnailUrl: null,
    isFree: input.defaults.isFree,
    coinPrice: input.defaults.coinPrice,
    coinUnlockEnabled: input.defaults.coinUnlockEnabled,
    rewardedUnlockEnabled: input.defaults.rewardedUnlockEnabled,
    rewardedAccessMode: input.defaults.rewardedAccessMode,
    requiredRewardedCompletions: input.defaults.requiredRewardedCompletions,
    plusAccess: input.defaults.plusAccess,
    lockedPreviewSeconds: input.defaults.lockedPreviewSeconds,
    contentRatingOverride: input.defaults.contentRatingOverride,
    contentDescriptorsOverride: input.defaults.contentDescriptorsOverride,
  };
}
