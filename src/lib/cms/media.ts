import "server-only";

import { createMuxDirectUpload, reconcileMuxMediaAssetState, type MuxDirectUploadResult } from "@/lib/mux";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type MediaAssetRow = Database["public"]["Tables"]["media_assets"]["Row"];
export type MediaAssetStatus = MediaAssetRow["status"];

export type MediaAssetFormState = {
  error?: string;
  message?: string;
};

export type MediaUploadIntent = Pick<MuxDirectUploadResult, "corsOrigin" | "mediaAssetId" | "uploadUrl">;

function getAdminClient() {
  return createAdminClient();
}

function isVideoMimeType(mimeType: string) {
  return mimeType.trim().startsWith("video/");
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

export async function createMediaUploadIntent(mimeType: string): Promise<MediaUploadIntent> {
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
    const directUpload = await createMuxDirectUpload(createdMediaAsset.id, supabase);
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
