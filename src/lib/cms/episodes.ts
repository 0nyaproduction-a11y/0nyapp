import "server-only";

import {
  CONTENT_DESCRIPTORS,
  CONTENT_RATINGS,
  type ContentDescriptor,
  type ContentRating,
} from "@/lib/classification";
import { cleanupArtworkObjectsAfterContentDeletion } from "@/lib/cms/artwork";
import {
  EPISODE_STATUSES,
  REWARDED_ACCESS_MODES,
  type SeriesRow,
  type EpisodeRow,
  type EpisodeStatus,
  type RewardedAccessMode,
} from "@/lib/cms/constants";
import { cleanupMediaAssetsAfterContentDeletion } from "@/lib/cms/media";
import { createAdminClient } from "@/lib/supabase/admin";

export type { EpisodeRow, EpisodeStatus, RewardedAccessMode };
export { EPISODE_STATUSES, REWARDED_ACCESS_MODES };

// Matches episodes_preview_seconds check (locked_preview_seconds between 0
// and 3) added in migration 006_episode_access_controls.
const MIN_LOCKED_PREVIEW_SECONDS = 0;
const MAX_LOCKED_PREVIEW_SECONDS = 3;

export type EpisodeInput = {
  episodeNumber: number;
  title: string | null;
  synopsis: string | null;
  durationSeconds: number;
  thumbnailUrl: string | null;
  isFree: boolean;
  coinPrice: number;
  coinUnlockEnabled: boolean;
  rewardedUnlockEnabled: boolean;
  rewardedAccessMode: RewardedAccessMode;
  plusAccess: boolean;
  lockedPreviewSeconds: number;
  contentRatingOverride: ContentRating | null;
  contentDescriptorsOverride: ContentDescriptor[];
};

export type EpisodeValidationError = { field: string; message: string };

export type EpisodeActionResult =
  | { success: true; episode: EpisodeRow }
  | { success: false; errors: EpisodeValidationError[] };

export type EpisodeDeletePreview = {
  blockers: string[];
  episode: EpisodeRow | null;
};

export type EpisodeDeleteResult =
  | {
      success: true;
      episodeId: string;
      seriesId: string;
      seriesSlug: string;
      episodeNumber: number;
      cleanupWarnings: string[];
    }
  | { success: false; message: string; blockers?: string[] };

export type SeriesEpisodesDeletePreview = {
  blockers: string[];
  episodeCount: number;
  series: Pick<SeriesRow, "id" | "slug" | "status"> | null;
};

export type SeriesEpisodesDeleteResult =
  | { success: true; seriesId: string; seriesSlug: string; deletedCount: number; cleanupWarnings: string[] }
  | { success: false; message: string; blockers?: string[] };

export type SeriesEpisodesArchiveResult =
  | {
      success: true;
      seriesId: string;
      seriesSlug: string;
      updatedCount: number;
      updatedEpisodeNumbers: number[];
    }
  | { success: false; message: string };

function getAdminClient() {
  return createAdminClient();
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

export function validateEpisodeInput(input: EpisodeInput): EpisodeValidationError[] {
  const errors: EpisodeValidationError[] = [];

  if (!Number.isInteger(input.episodeNumber) || input.episodeNumber <= 0) {
    errors.push({ field: "episodeNumber", message: "Episode number must be a positive whole number." });
  }

  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 0) {
    errors.push({ field: "durationSeconds", message: "Duration must be zero or a positive whole number of seconds." });
  }

  if (!Number.isInteger(input.coinPrice) || input.coinPrice < 0) {
    errors.push({ field: "coinPrice", message: "Coin price must be zero or a positive whole number." });
  }

  // Mirrors the DB constraint episodes_coin_unlock_requires_price so the
  // admin gets an immediate, friendly error instead of a raw DB failure.
  if (input.coinUnlockEnabled && input.coinPrice <= 0) {
    errors.push({ field: "coinPrice", message: "Coin price must be greater than zero when coin unlock is enabled." });
  }

  if (!REWARDED_ACCESS_MODES.includes(input.rewardedAccessMode)) {
    errors.push({ field: "rewardedAccessMode", message: "Unsupported rewarded access mode." });
  }

  if (
    !Number.isInteger(input.lockedPreviewSeconds) ||
    input.lockedPreviewSeconds < MIN_LOCKED_PREVIEW_SECONDS ||
    input.lockedPreviewSeconds > MAX_LOCKED_PREVIEW_SECONDS
  ) {
    errors.push({
      field: "lockedPreviewSeconds",
      message: `Locked preview seconds must be between ${MIN_LOCKED_PREVIEW_SECONDS} and ${MAX_LOCKED_PREVIEW_SECONDS}.`,
    });
  }

  if (input.contentRatingOverride && !CONTENT_RATINGS.includes(input.contentRatingOverride)) {
    errors.push({ field: "contentRatingOverride", message: "Unsupported content rating override." });
  }

  for (const descriptor of input.contentDescriptorsOverride) {
    if (!CONTENT_DESCRIPTORS.includes(descriptor)) {
      errors.push({
        field: "contentDescriptorsOverride",
        message: `Unsupported content descriptor: ${descriptor}.`,
      });
      break;
    }
  }

  return errors;
}

export async function listEpisodesForSeries(seriesId: string): Promise<EpisodeRow[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("series_id", seriesId)
    .order("episode_number", { ascending: true });

  if (error) {
    console.warn("Unable to list episodes for CMS.");
    return [];
  }

  return data;
}

export async function getEpisodeForAdminById(id: string): Promise<EpisodeRow | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("episodes").select("*").eq("id", id).maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getEpisodeForSeriesByNumber(
  seriesId: string,
  episodeNumber: number,
): Promise<EpisodeRow | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("series_id", seriesId)
    .eq("episode_number", episodeNumber)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function createEpisode(
  seriesId: string,
  input: EpisodeInput,
): Promise<EpisodeActionResult> {
  const errors = validateEpisodeInput(input);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .insert({
      series_id: seriesId,
      episode_number: input.episodeNumber,
      title: input.title,
      synopsis: input.synopsis,
      duration_seconds: input.durationSeconds,
      thumbnail_url: input.thumbnailUrl,
      is_free: input.isFree,
      coin_price: input.coinPrice,
      coin_unlock_enabled: input.coinUnlockEnabled,
      rewarded_unlock_enabled: input.rewardedUnlockEnabled,
      rewarded_access_mode: input.rewardedAccessMode,
      plus_access: input.plusAccess,
      locked_preview_seconds: input.lockedPreviewSeconds,
      content_rating_override: input.contentRatingOverride,
      content_descriptors_override: input.contentDescriptorsOverride,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return {
        success: false,
        errors: [{ field: "episodeNumber", message: "That episode number is already used in this series." }],
      };
    }

    return { success: false, errors: [{ field: "form", message: "Unable to create episode." }] };
  }

  return { success: true, episode: data };
}

export async function updateEpisode(id: string, input: EpisodeInput): Promise<EpisodeActionResult> {
  const errors = validateEpisodeInput(input);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .update({
      episode_number: input.episodeNumber,
      title: input.title,
      synopsis: input.synopsis,
      duration_seconds: input.durationSeconds,
      thumbnail_url: input.thumbnailUrl,
      is_free: input.isFree,
      coin_price: input.coinPrice,
      coin_unlock_enabled: input.coinUnlockEnabled,
      rewarded_unlock_enabled: input.rewardedUnlockEnabled,
      rewarded_access_mode: input.rewardedAccessMode,
      plus_access: input.plusAccess,
      locked_preview_seconds: input.lockedPreviewSeconds,
      content_rating_override: input.contentRatingOverride,
      content_descriptors_override: input.contentDescriptorsOverride,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return {
        success: false,
        errors: [{ field: "episodeNumber", message: "That episode number is already used in this series." }],
      };
    }

    return { success: false, errors: [{ field: "form", message: "Unable to update episode." }] };
  }

  return { success: true, episode: data };
}

export async function updateEpisodeStatus(
  id: string,
  status: EpisodeStatus,
): Promise<EpisodeActionResult> {
  if (!EPISODE_STATUSES.includes(status)) {
    return { success: false, errors: [{ field: "status", message: "Unsupported status." }] };
  }

  const supabase = getAdminClient();
  const existing = await getEpisodeForAdminById(id);

  if (!existing) {
    return { success: false, errors: [{ field: "status", message: "Episode not found." }] };
  }

  // published_at has no other writer in the schema; set it the first time an
  // episode is published so CMS/consumer code has a real publish timestamp
  // to work with. Never overwritten once set.
  const shouldStampPublishedAt = status === "published" && !existing.published_at;

  const { data, error } = await supabase
    .from("episodes")
    .update({
      status,
      ...(shouldStampPublishedAt ? { published_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { success: false, errors: [{ field: "status", message: "Unable to update status." }] };
  }

  return { success: true, episode: data };
}

export async function persistEpisodeThumbnail(id: string, publicUrl: string): Promise<EpisodeActionResult> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("episodes")
    .update({ thumbnail_url: publicUrl })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { success: false, errors: [{ field: "thumbnailUrl", message: "Unable to save thumbnail." }] };
  }

  return { success: true, episode: data };
}

export type MediaReadinessLabel = "Not assigned" | "Pending" | "Processing" | "Ready" | "Failed";

function toMediaReadinessLabel(status: string | null | undefined): MediaReadinessLabel {
  switch (status) {
    case "ready":
      return "Ready";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    default:
      return "Not assigned";
  }
}

/**
 * Read-only media readiness display for the episode editor. CMS Phase 2
 * deliberately does not build a Mux upload/select workflow (Phase 3
 * dependency) — this only reports whatever media_asset_id already exists.
 */
export async function resolveEpisodeMediaReadiness(episode: EpisodeRow) {
  const supabase = getAdminClient();

  async function readinessFor(mediaAssetId: string | null) {
    if (!mediaAssetId) {
      return toMediaReadinessLabel(null);
    }

    const { data } = await supabase.from("media_assets").select("status").eq("id", mediaAssetId).maybeSingle();
    return toMediaReadinessLabel(data?.status);
  }

  const [video, preview] = await Promise.all([
    readinessFor(episode.media_asset_id),
    readinessFor(episode.preview_media_asset_id),
  ]);

  return { video, preview };
}

async function inspectEpisodeDeletion(episode: EpisodeRow, seriesSlug: string): Promise<EpisodeDeletePreview> {
  const supabase = getAdminClient();
  const blockers: string[] = [];

  if (episode.status === "published") {
    blockers.push("Archive this episode before deleting it.");
  }

  const [watchProgressResult, entitlementsResult, rewardedAttemptsResult, coinTransactionsResult] =
    await Promise.all([
      supabase
        .from("watch_progress")
        .select("id")
        .eq("series_slug", seriesSlug)
        .eq("episode_number", episode.episode_number)
        .limit(1),
      supabase.from("episode_entitlements").select("id").eq("episode_id", episode.id).limit(1),
      supabase.from("rewarded_ad_attempts").select("id").eq("episode_id", episode.id).limit(1),
      supabase.from("coin_transactions").select("id").eq("episode_id", episode.id).limit(1),
    ]);

  if (watchProgressResult.error || entitlementsResult.error || rewardedAttemptsResult.error || coinTransactionsResult.error) {
    blockers.push("Unable to inspect episode dependencies right now.");
    return { blockers, episode };
  }

  if ((watchProgressResult.data ?? []).length > 0) {
    blockers.push("Viewer watch progress exists for this episode.");
  }

  if ((entitlementsResult.data ?? []).length > 0) {
    blockers.push("Viewer entitlements exist for this episode.");
  }

  if ((rewardedAttemptsResult.data ?? []).length > 0) {
    blockers.push("Rewarded-ad history exists for this episode.");
  }

  if ((coinTransactionsResult.data ?? []).length > 0) {
    blockers.push("Coin purchase history exists for this episode.");
  }

  return { blockers, episode };
}

export async function getEpisodeDeletePreview(episode: EpisodeRow, seriesSlug: string) {
  return inspectEpisodeDeletion(episode, seriesSlug);
}

export async function deleteEpisode(episode: EpisodeRow, seriesSlug: string): Promise<EpisodeDeleteResult> {
  const preview = await inspectEpisodeDeletion(episode, seriesSlug);

  if (preview.blockers.length > 0) {
    return { success: false, message: "Resolve the blockers before deleting this episode.", blockers: preview.blockers };
  }

  const supabase = getAdminClient();
  const { error } = await supabase.from("episodes").delete().eq("id", episode.id);

  if (error) {
    return { success: false, message: "Unable to delete episode." };
  }

  const cleanupWarnings = await cleanupMediaAssetsAfterContentDeletion([
    episode.media_asset_id ?? "",
    episode.preview_media_asset_id ?? "",
  ]);
  const artworkCleanupWarnings = await cleanupArtworkObjectsAfterContentDeletion([episode.thumbnail_url]);

  return {
    success: true,
    episodeId: episode.id,
    episodeNumber: episode.episode_number,
    seriesId: episode.series_id,
    seriesSlug,
    cleanupWarnings: [...artworkCleanupWarnings, ...cleanupWarnings],
  };
}

async function inspectSeriesEpisodesDeletion(seriesId: string): Promise<SeriesEpisodesDeletePreview> {
  const supabase = getAdminClient();
  const blockers: string[] = [];

  const [seriesResult, episodesResult] = await Promise.all([
    supabase.from("series").select("id,slug,status").eq("id", seriesId).maybeSingle(),
    supabase
      .from("episodes")
      .select("id,episode_number,status,media_asset_id,preview_media_asset_id,thumbnail_url")
      .eq("series_id", seriesId)
      .order("episode_number", { ascending: true }),
  ]);

  if (seriesResult.error || !seriesResult.data) {
    return { blockers: ["Series not found."], episodeCount: 0, series: null };
  }

  const series = seriesResult.data;
  const episodes = episodesResult.data ?? [];
  const episodeCount = episodes.length;

  if (series.status === "published") {
    blockers.push("Archive this series before deleting episodes.");
  }

  const publishedEpisodeNumbers = episodes
    .filter((episode) => episode.status === "published")
    .map((episode) => episode.episode_number);

  if (publishedEpisodeNumbers.length > 0) {
    const previewNumbers = publishedEpisodeNumbers.slice(0, 3).join(", ");
    const suffix = publishedEpisodeNumbers.length > 3 ? ", ..." : "";
    blockers.push(`Archive the published episodes first (${previewNumbers}${suffix}).`);
  }

  if (episodeCount > 0) {
    const [watchProgressResult, entitlementsResult, rewardedAttemptsResult, coinTransactionsResult] =
      await Promise.all([
        supabase
          .from("watch_progress")
          .select("id")
          .eq("series_slug", series.slug)
          .limit(1),
        supabase.from("episode_entitlements").select("id").in("episode_id", episodes.map((episode) => episode.id)).limit(1),
        supabase.from("rewarded_ad_attempts").select("id").in("episode_id", episodes.map((episode) => episode.id)).limit(1),
        supabase.from("coin_transactions").select("id").in("episode_id", episodes.map((episode) => episode.id)).limit(1),
      ]);

    if (watchProgressResult.error || entitlementsResult.error || rewardedAttemptsResult.error || coinTransactionsResult.error) {
      blockers.push("Unable to inspect series-episode dependencies right now.");
      return { blockers, episodeCount, series };
    }

    if ((watchProgressResult.data ?? []).length > 0) {
      blockers.push("Viewer watch progress exists for this series.");
    }

    if ((entitlementsResult.data ?? []).length > 0) {
      blockers.push("Viewer entitlements exist for one or more episodes in this series.");
    }

    if ((rewardedAttemptsResult.data ?? []).length > 0) {
      blockers.push("Rewarded-ad history exists for one or more episodes in this series.");
    }

    if ((coinTransactionsResult.data ?? []).length > 0) {
      blockers.push("Coin purchase history exists for one or more episodes in this series.");
    }
  }

  return { blockers, episodeCount, series };
}

export async function getSeriesEpisodesDeletePreview(seriesId: string) {
  return inspectSeriesEpisodesDeletion(seriesId);
}

export async function deleteAllEpisodesForSeries(seriesId: string): Promise<SeriesEpisodesDeleteResult> {
  const preview = await inspectSeriesEpisodesDeletion(seriesId);

  if (!preview.series) {
    return { success: false, message: "Series not found." };
  }

  if (preview.episodeCount === 0) {
    return { success: false, message: "No episodes exist for this series." };
  }

  if (preview.blockers.length > 0) {
    return {
      success: false,
      message: "Resolve the blockers before deleting all episodes.",
      blockers: preview.blockers,
    };
  }

  const supabase = getAdminClient();
  const { data: episodesForCleanup, error: cleanupQueryError } = await supabase
    .from("episodes")
    .select("media_asset_id,preview_media_asset_id,thumbnail_url")
    .eq("series_id", seriesId);

  if (cleanupQueryError || !episodesForCleanup) {
    return { success: false, message: "Unable to inspect episode media assets for this series." };
  }

  const { error, count } = await supabase
    .from("episodes")
    .delete({ count: "exact" })
    .eq("series_id", seriesId);

  if (error) {
    return { success: false, message: "Unable to delete all episodes for this series." };
  }

  const cleanupRows = episodesForCleanup as Array<
    Pick<EpisodeRow, "media_asset_id" | "preview_media_asset_id" | "thumbnail_url">
  >;
  const cleanupWarnings = await cleanupMediaAssetsAfterContentDeletion(
    cleanupRows.flatMap((episode) => [episode.media_asset_id ?? "", episode.preview_media_asset_id ?? ""]),
  );
  const artworkCleanupWarnings = await cleanupArtworkObjectsAfterContentDeletion(
    cleanupRows.map((episode) => episode.thumbnail_url),
  );

  return {
    success: true,
    seriesId,
    seriesSlug: preview.series.slug,
    deletedCount: count ?? preview.episodeCount,
    cleanupWarnings: [...artworkCleanupWarnings, ...cleanupWarnings],
  };
}

export async function archiveAllEpisodesForSeries(seriesId: string): Promise<SeriesEpisodesArchiveResult> {
  const supabase = getAdminClient();
  const [seriesResult, episodesResult] = await Promise.all([
    supabase.from("series").select("id,slug,status").eq("id", seriesId).maybeSingle(),
   supabase
     .from("episodes")
     .select("id,episode_number,status")
     .eq("series_id", seriesId)
     .order("episode_number", { ascending: true }),
  ]);

  if (seriesResult.error || !seriesResult.data) {
   return { success: false, message: "Series not found." };
  }

  const episodes = episodesResult.data ?? [];
  const episodesToArchive = episodes.filter((episode) => episode.status !== "archived");

  if (episodesToArchive.length === 0) {
   return {
     success: true,
     seriesId,
     seriesSlug: seriesResult.data.slug,
     updatedCount: 0,
     updatedEpisodeNumbers: [],
   };
  }

  const { data, error } = await supabase
   .from("episodes")
   .update({ status: "archived" })
   .eq("series_id", seriesId)
   .neq("status", "archived")
   .select("episode_number");

  if (error || !data) {
   return { success: false, message: "Unable to archive all episodes for this series." };
  }

  const updatedEpisodeNumbers = data.map((episode) => episode.episode_number).sort((a, b) => a - b);

  return {
   success: true,
   seriesId,
   seriesSlug: seriesResult.data.slug,
   updatedCount: updatedEpisodeNumbers.length,
   updatedEpisodeNumbers,
  };
}
