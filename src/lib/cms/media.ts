import "server-only";

import {
  createMuxDirectUpload,
  deleteMuxAsset,
  reconcileMuxMediaAssetState,
  type MuxDirectUploadResult,
} from "@/lib/mux";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type MediaAssetRow = Database["public"]["Tables"]["media_assets"]["Row"];
export type MediaAssetStatus = MediaAssetRow["status"];

export type MediaAssetFormState = {
  error?: string;
  message?: string;
};

export type MediaUploadIntent = Pick<MuxDirectUploadResult, "corsOrigin" | "mediaAssetId" | "uploadUrl">;
export type MediaAssetCleanupResult = {
  mediaAssetId: string;
  warning: string | null;
};

function getAdminClient() {
  return createAdminClient();
}

function isVideoMimeType(mimeType: string) {
  return mimeType.trim().startsWith("video/");
}

function normalizeMediaAssetIds(mediaAssetIds: string[]) {
  return Array.from(
    new Set(
      mediaAssetIds
        .map((mediaAssetId) => mediaAssetId.trim())
        .filter((mediaAssetId) => Boolean(mediaAssetId)),
    ),
  );
}

async function mediaAssetHasRemainingReferences(mediaAssetId: string) {
  const supabase = getAdminClient();
  const [episodeMediaResult, episodePreviewResult, shortFilmResult, derivedAssetResult] = await Promise.all([
    supabase.from("episodes").select("id").eq("media_asset_id", mediaAssetId).limit(1),
    supabase.from("episodes").select("id").eq("preview_media_asset_id", mediaAssetId).limit(1),
    supabase.from("short_films").select("id").eq("media_asset_id", mediaAssetId).limit(1),
    supabase.from("media_assets").select("id").eq("source_media_asset_id", mediaAssetId).limit(1),
  ]);

  if (
    episodeMediaResult.error ||
    episodePreviewResult.error ||
    shortFilmResult.error ||
    derivedAssetResult.error
  ) {
    return { error: true as const, referenced: false };
  }

  return {
    error: false as const,
    referenced:
      (episodeMediaResult.data ?? []).length > 0 ||
      (episodePreviewResult.data ?? []).length > 0 ||
      (shortFilmResult.data ?? []).length > 0 ||
      (derivedAssetResult.data ?? []).length > 0,
  };
}

async function cleanupMediaAsset(mediaAssetId: string): Promise<MediaAssetCleanupResult> {
  const supabase = getAdminClient();
  const normalizedMediaAssetId = mediaAssetId.trim();

  if (!normalizedMediaAssetId) {
    return { mediaAssetId: normalizedMediaAssetId, warning: null };
  }

  const { data: mediaAsset, error: mediaAssetError } = await supabase
    .from("media_assets")
    .select("id,provider_asset_reference")
    .eq("id", normalizedMediaAssetId)
    .maybeSingle();

  if (mediaAssetError) {
    return {
      mediaAssetId: normalizedMediaAssetId,
      warning: `Unable to inspect media asset ${normalizedMediaAssetId} for cleanup; the row was preserved.`,
    };
  }

  if (!mediaAsset) {
    return { mediaAssetId: normalizedMediaAssetId, warning: null };
  }

  const referenceState = await mediaAssetHasRemainingReferences(normalizedMediaAssetId);

  if (referenceState.error) {
    return {
      mediaAssetId: normalizedMediaAssetId,
      warning: `Unable to verify whether media asset ${normalizedMediaAssetId} is shared; the row was preserved.`,
    };
  }

  if (referenceState.referenced) {
    return { mediaAssetId: normalizedMediaAssetId, warning: null };
  }

  if (mediaAsset.provider_asset_reference) {
    try {
      await deleteMuxAsset(mediaAsset.provider_asset_reference);
    } catch {
      return {
        mediaAssetId: normalizedMediaAssetId,
        warning: `Mux cleanup failed for media asset ${normalizedMediaAssetId}; the row was preserved for retry.`,
      };
    }
  }

  const { error: deleteError } = await supabase.from("media_assets").delete().eq("id", normalizedMediaAssetId);

  if (deleteError) {
    return {
      mediaAssetId: normalizedMediaAssetId,
      warning: `Unable to remove media asset ${normalizedMediaAssetId}; the row was preserved for retry.`,
    };
  }

  return { mediaAssetId: normalizedMediaAssetId, warning: null };
}

export async function cleanupMediaAssetsAfterContentDeletion(mediaAssetIds: string[]) {
  const warnings: string[] = [];

  for (const mediaAssetId of normalizeMediaAssetIds(mediaAssetIds)) {
    const cleanupResult = await cleanupMediaAsset(mediaAssetId);

    if (cleanupResult.warning) {
      warnings.push(cleanupResult.warning);
    }
  }

  return warnings;
}

export async function listMediaAssetsForAdmin(): Promise<MediaAssetRow[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function listReadyMediaAssetsForAdmin(): Promise<MediaAssetRow[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("*")
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function createMediaUploadIntent(
  mimeType: string,
  corsOriginOverride?: string | null,
): Promise<MediaUploadIntent> {
  const normalizedMimeType = mimeType.trim().toLowerCase();

  if (!isVideoMimeType(normalizedMimeType)) {
    throw new Error("Only video uploads are allowed.");
  }

  const supabase = getAdminClient();
  const { data: createdMediaAsset, error: createError } = await supabase
    .from("media_assets")
    .insert({
      provider_name: "mux",
      status: "pending",
    })
    .select("id")
    .single();

  if (createError || !createdMediaAsset) {
    throw new Error("Unable to create the media asset row.");
  }

  try {
    const directUpload = await createMuxDirectUpload(createdMediaAsset.id, supabase, corsOriginOverride);
    return {
      corsOrigin: directUpload.corsOrigin,
      mediaAssetId: directUpload.mediaAssetId,
      uploadUrl: directUpload.uploadUrl,
    };
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : "Unable to create the direct upload.";

    await supabase
      .from("media_assets")
      .update({
        failure_code: "mux_direct_upload_error",
        failure_message: failureMessage,
        status: "failed",
      })
      .eq("id", createdMediaAsset.id);

    throw error;
  }
}

export async function refreshMediaAssetStatus(mediaAssetId: string) {
  const supabase = getAdminClient();
  const normalizedMediaAssetId = mediaAssetId.trim();

  if (!normalizedMediaAssetId) {
    throw new Error("Media asset ID is required.");
  }

  const { data: mediaAsset, error } = await supabase
    .from("media_assets")
    .select("id")
    .eq("id", normalizedMediaAssetId)
    .maybeSingle();

  if (error || !mediaAsset) {
    throw new Error("Media asset not found.");
  }

  return reconcileMuxMediaAssetState(normalizedMediaAssetId, supabase);
}

export async function assignEpisodeMediaAsset(episodeId: string, mediaAssetId: string) {
  const supabase = getAdminClient();
  const normalizedEpisodeId = episodeId.trim();
  const normalizedMediaAssetId = mediaAssetId.trim();

  if (!normalizedEpisodeId) {
    throw new Error("Episode ID is required.");
  }

  if (!normalizedMediaAssetId) {
    throw new Error("Media asset ID is required.");
  }

  const [{ data: episode, error: episodeError }, { data: mediaAsset, error: mediaAssetError }] =
    await Promise.all([
      supabase.from("episodes").select("id,media_asset_id").eq("id", normalizedEpisodeId).maybeSingle(),
      supabase.from("media_assets").select("id,status").eq("id", normalizedMediaAssetId).maybeSingle(),
    ]);

  if (episodeError || !episode) {
    throw new Error("Episode not found.");
  }

  if (mediaAssetError || !mediaAsset) {
    throw new Error("Media asset not found.");
  }

  if (mediaAsset.status !== "ready") {
    throw new Error("Only ready media assets can be assigned to an episode.");
  }

  if (episode.media_asset_id === mediaAsset.id) {
    return { episodeId: episode.id, mediaAssetId: mediaAsset.id, updated: false as const };
  }

  const { error: updateError } = await supabase
    .from("episodes")
    .update({ media_asset_id: mediaAsset.id })
    .eq("id", episode.id);

  if (updateError) {
    throw new Error("Unable to assign the media asset to the episode.");
  }

  return { episodeId: episode.id, mediaAssetId: mediaAsset.id, updated: true as const };
}

export async function assignShortFilmMediaAsset(shortFilmId: string, mediaAssetId: string) {
  const supabase = getAdminClient();
  const normalizedShortFilmId = shortFilmId.trim();
  const normalizedMediaAssetId = mediaAssetId.trim();

  if (!normalizedShortFilmId) {
    throw new Error("Short film ID is required.");
  }

  if (!normalizedMediaAssetId) {
    throw new Error("Media asset ID is required.");
  }

  const [{ data: shortFilm, error: shortFilmError }, { data: mediaAsset, error: mediaAssetError }] =
    await Promise.all([
      supabase.from("short_films").select("id,media_asset_id").eq("id", normalizedShortFilmId).maybeSingle(),
      supabase.from("media_assets").select("id,status").eq("id", normalizedMediaAssetId).maybeSingle(),
    ]);

  if (shortFilmError || !shortFilm) {
    throw new Error("Short film not found.");
  }

  if (mediaAssetError || !mediaAsset) {
    throw new Error("Media asset not found.");
  }

  if (mediaAsset.status !== "ready") {
    throw new Error("Only ready media assets can be assigned to a short film.");
  }

  if (shortFilm.media_asset_id === mediaAsset.id) {
    return { shortFilmId: shortFilm.id, mediaAssetId: mediaAsset.id, updated: false as const };
  }

  const { error: updateError } = await supabase
    .from("short_films")
    .update({ media_asset_id: mediaAsset.id })
    .eq("id", shortFilm.id);

  if (updateError) {
    throw new Error("Unable to assign the media asset to the short film.");
  }

  return { shortFilmId: shortFilm.id, mediaAssetId: mediaAsset.id, updated: true as const };
}
