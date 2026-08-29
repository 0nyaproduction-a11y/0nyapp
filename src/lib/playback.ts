import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeContentDescriptors,
  normalizeContentRating,
  resolveContentClassification,
  type ContentRating,
} from "@/lib/classification";
import { canUserWatchEpisode, resolvePlaybackMaxResolution } from "@/lib/entitlements";
import { getPerfCollector, timePerf } from "@/lib/api/perf";
import {
  createMuxPreviewClip,
  createMuxSignedPlaybackUrl,
  createMuxSignedThumbnailUrl,
} from "@/lib/mux";
import {
  getGuestParentalControlStatus,
  getParentalControlStatus,
  type ParentalControlStatus,
  validateParentalSessionProof,
} from "@/lib/parental-controls";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type SeriesRow = Database["public"]["Tables"]["series"]["Row"];
type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];
type ShortFilmRow = Database["public"]["Tables"]["short_films"]["Row"];
type MediaAssetRow = Database["public"]["Tables"]["media_assets"]["Row"];

export type PlaybackTarget =
  | {
      targetType: "SERIES_EPISODE";
      episodeNumber: number;
      seriesSlug: string;
    }
  | {
      targetType: "SHORT_FILM";
      slug: string;
    };

export type PlaybackAuthContext = {
  guestCredential?: string | null;
  parentalSessionToken?: string | null;
  supabase?: SupabaseClient<Database>;
  userId: string | null;
};

export type PlaybackAuthorizationResult =
  | {
      expiresAt: string;
      playbackUrl: string;
      stillUrl?: string;
      status: "ok";
    }
  | {
      status:
        | "not_found"
        | "parental_required"
        | "access_required"
        | "age_verification_required"
        | "media_not_ready"
        | "playback_unavailable";
    };

export type PreviewPlaybackAuthorizationResult =
  | {
      expiresAt: string;
      previewSeconds: number;
      previewUrl: string;
      status: "ok";
    }
  | {
      status:
        | "not_found"
        | "parental_required"
        | "access_required"
        | "age_verification_required"
        | "preview_not_required"
        | "preview_not_ready"
        | "preview_unavailable";
    };

export type EpisodePreviewProvisioningResult =
  | {
      episodeId: string;
      previewMediaAssetId: string;
      previewSeconds: number;
      status: "provisioned";
    }
  | {
      episodeId: string;
      previewMediaAssetId: string;
      previewSeconds: number;
      status: "reused";
    }
  | {
      status: "not_found" | "preview_disabled" | "media_not_ready" | "playback_unavailable";
    };

function getSupabase(supabase?: SupabaseClient<Database>) {
  return supabase ?? createAdminClient();
}

function isReleased(issuedAt: string | null) {
  return !issuedAt || new Date(issuedAt).getTime() <= Date.now();
}

function formatRuntime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = `${safeSeconds % 60}`.padStart(2, "0");

  return `${minutes}:${remainder}`;
}

function resolveEpisodeClassification(series: SeriesRow, episode: EpisodeRow) {
  const seriesRating = normalizeContentRating(series.content_rating);
  const seriesDescriptors = normalizeContentDescriptors(series.content_descriptors);
  const episodeRating = normalizeContentRating(episode.content_rating_override);
  const episodeDescriptors = normalizeContentDescriptors(episode.content_descriptors_override);

  return resolveContentClassification(
    episodeRating ?? seriesRating,
    episodeDescriptors.length > 0 ? episodeDescriptors : seriesDescriptors,
  );
}

const PARENTAL_RATING_ORDER: Record<Exclude<ContentRating, "A">, number> = {
  U: 0,
  "U/A 7+": 1,
  "U/A 13+": 2,
  "U/A 16+": 3,
};

function meetsParentalRestrictionThreshold(
  contentRating: ContentRating | null,
  status: ParentalControlStatus,
) {
  if (!status.restrictionsEnabled || !status.restrictionThreshold || contentRating === "A") {
    return false;
  }

  if (!contentRating) {
    return false;
  }

  return PARENTAL_RATING_ORDER[contentRating] >= PARENTAL_RATING_ORDER[status.restrictionThreshold];
}

async function loadParentalControlStatus(auth: PlaybackAuthContext) {
  if (auth.userId) {
    return getParentalControlStatus(auth.userId);
  }

  if (!auth.guestCredential?.trim()) {
    return null;
  }

  return getGuestParentalControlStatus(auth.guestCredential);
}

type LoadedEpisodePlaybackContext =
  | {
      status: "not_found" | "age_verification_required" | "parental_required";
    }
  | {
      context: {
        classification: ReturnType<typeof resolveContentClassification>;
        episode: EpisodeRow;
        series: SeriesRow;
      };
      status: "ok";
    };

async function loadEpisodePlaybackContext(
  target: Extract<PlaybackTarget, { targetType: "SERIES_EPISODE" }>,
  auth: PlaybackAuthContext,
): Promise<LoadedEpisodePlaybackContext> {
  const supabase = getSupabase(auth.supabase);
  const { data: series, error: seriesError } = await timePerf("content_lookup", () =>
    supabase
      .from("series")
      .select("*")
      .eq("slug", target.seriesSlug)
      .eq("status", "published")
      .maybeSingle()
  );

  if (seriesError || !series) {
    return { status: "not_found" };
  }

  const { data: episode, error: episodeError } = await timePerf("episodes_lookup", () =>
    supabase
      .from("episodes")
      .select("*")
      .eq("series_id", series.id)
      .eq("episode_number", target.episodeNumber)
      .eq("status", "published")
      .maybeSingle()
  );

  if (episodeError || !episode || !isReleased(episode.published_at)) {
    return { status: "not_found" };
  }

  const classification = resolveEpisodeClassification(series, episode);

  if (classification.ageVerificationRequired) {
    return { status: "age_verification_required" };
  }

  if (classification.parentalLockRequired) {
    const parentalControlStatus = await loadParentalControlStatus(auth);

    if (
      parentalControlStatus?.hasPin &&
      meetsParentalRestrictionThreshold(classification.contentRating, parentalControlStatus)
    ) {
      if (!auth.parentalSessionToken?.trim()) {
        return { status: "parental_required" };
      }

      const parentalProofValid = await validateParentalSessionProof({
        guestCredential: auth.guestCredential,
        parentalSessionToken: auth.parentalSessionToken,
        userId: auth.userId,
      });

      if (!parentalProofValid) {
        return { status: "parental_required" };
      }
    }
  }

  return {
    context: {
      classification,
      episode,
      series,
    },
    status: "ok",
  };
}

function buildWatchableEpisode(
  series: SeriesRow,
  episode: EpisodeRow,
): Parameters<typeof canUserWatchEpisode>[0]["episode"] {
  const classification = resolveEpisodeClassification(series, episode);

  return {
    id: episode.id,
    number: episode.episode_number,
    title: episode.title ?? `Episode ${episode.episode_number}`,
    description: episode.synopsis ?? "",
    runtime: formatRuntime(episode.duration_seconds),
    isFree: episode.is_free,
    isLocked: !episode.is_free,
    coinPrice: episode.coin_price,
    coinUnlockEnabled: episode.coin_unlock_enabled,
    rewardedUnlockEnabled: episode.rewarded_unlock_enabled,
    rewardedAccessMode: episode.rewarded_access_mode,
    plusAccess: episode.plus_access,
    lockedPreviewSeconds: episode.locked_preview_seconds,
    contentRatingOverride: normalizeContentRating(episode.content_rating_override),
    contentDescriptorsOverride: normalizeContentDescriptors(episode.content_descriptors_override),
    contentRating: classification.contentRating,
    contentDescriptors: classification.contentDescriptors,
    parentalLockRequired: classification.parentalLockRequired,
    ageVerificationRequired: classification.ageVerificationRequired,
  };
}

function resolveShortFilmClassification(shortFilm: ShortFilmRow) {
  return resolveContentClassification(
    normalizeContentRating(shortFilm.content_rating),
    normalizeContentDescriptors(shortFilm.content_descriptors),
  );
}

async function resolveEpisodePlayback(
  target: Extract<PlaybackTarget, { targetType: "SERIES_EPISODE" }>,
  auth: PlaybackAuthContext,
  stillAtSeconds?: number | null,
): Promise<PlaybackAuthorizationResult> {
  const loaded = await loadEpisodePlaybackContext(target, auth);

  if (loaded.status !== "ok") {
    return { status: loaded.status };
  }

  const supabase = getSupabase(auth.supabase);
  const { series, episode } = loaded.context;
  const canWatch = await canUserWatchEpisode({
    episode: buildWatchableEpisode(series, episode),
    supabase,
    userId: auth.userId,
  });

  if (!canWatch) {
    return { status: "access_required" };
  }

  if (!episode.media_asset_id) {
    return { status: "playback_unavailable" };
  }

  const { data: mediaAsset, error: mediaAssetError } = await timePerf("media_lookup", () =>
    supabase
      .from("media_assets")
      .select("*")
      .eq("id", episode.media_asset_id)
      .maybeSingle()
  );

  if (mediaAssetError) {
    return { status: "playback_unavailable" };
  }

  if (!mediaAsset) {
   return { status: "playback_unavailable" };
  }

  if (mediaAsset.status !== "ready") {
   return { status: "media_not_ready" };
  }

  const playbackReference = mediaAsset.provider_playback_reference?.trim();

  if (!playbackReference) {
   return { status: "playback_unavailable" };
  }

  if (episode.duration_seconds <= 0) {
   return { status: "playback_unavailable" };
  }

  const maxResolution = await resolvePlaybackMaxResolution(auth.userId, supabase);
  const tMux0 = performance.now();
  const signedPlayback = createMuxSignedPlaybackUrl(
    playbackReference,
    episode.duration_seconds,
    maxResolution,
  );
  timePerf("mux_sign", async () => {}).catch(() => {});
  const tMux1 = performance.now();
  const collector = getPerfCollector();
  if (collector) collector.addMarker("mux_sign", tMux1 - tMux0);
  let stillUrl: string | undefined;

  if (typeof stillAtSeconds === "number" && Number.isFinite(stillAtSeconds)) {
   try {
     const signedThumbnail = createMuxSignedThumbnailUrl(playbackReference, {
       height: 960,
       timeSeconds: Math.min(
         Math.max(0, stillAtSeconds),
         Math.max(episode.duration_seconds - 0.001, 0),
       ),
       width: 540,
     });

     stillUrl = signedThumbnail.thumbnailUrl;
   } catch (error) {
     console.warn(
       "[0nya playback still]",
       error instanceof Error ? error.message : String(error),
     );
   }
  }

  return {
   expiresAt: signedPlayback.expiresAt,
   playbackUrl: signedPlayback.playbackUrl,
   ...(stillUrl ? { stillUrl } : {}),
   status: "ok",
  };
}

async function resolvePreviewPlayback(
  target: Extract<PlaybackTarget, { targetType: "SERIES_EPISODE" }>,
  auth: PlaybackAuthContext,
): Promise<PreviewPlaybackAuthorizationResult> {
  const loaded = await loadEpisodePlaybackContext(target, auth);

  if (loaded.status !== "ok") {
    return { status: loaded.status };
  }

  const supabase = getSupabase(auth.supabase);
  const { series, episode } = loaded.context;
  const canWatch = await canUserWatchEpisode({
    episode: buildWatchableEpisode(series, episode),
    supabase,
    userId: auth.userId,
  });

  if (canWatch) {
    return { status: "preview_not_required" };
  }

  const previewSeconds = Math.max(0, Math.floor(episode.locked_preview_seconds));

  if (previewSeconds <= 0) {
    return { status: "preview_unavailable" };
  }

  const fullMediaAssetId = episode.media_asset_id?.trim();

  if (!fullMediaAssetId) {
    return { status: "preview_unavailable" };
  }

  const { data: fullMediaAsset, error: fullMediaAssetError } = await supabase
    .from("media_assets")
    .select("*")
    .eq("id", fullMediaAssetId)
    .maybeSingle();

  if (fullMediaAssetError || !fullMediaAsset) {
    return { status: "preview_unavailable" };
  }

  if (fullMediaAsset.status !== "ready") {
    return { status: "preview_not_ready" };
  }

  const previewMediaAssetId = episode.preview_media_asset_id?.trim();
  let previewMediaAsset: MediaAssetRow | null = null;

  if (previewMediaAssetId) {
    const { data, error } = await supabase
      .from("media_assets")
      .select("*")
      .eq("id", previewMediaAssetId)
      .maybeSingle();

    if (!error && data) {
      previewMediaAsset = data;
    }
  }

  if (
    !previewMediaAsset ||
    previewMediaAsset.source_media_asset_id !== fullMediaAsset.id ||
    previewMediaAsset.clip_start_seconds !== 0 ||
    previewMediaAsset.clip_end_seconds !== previewSeconds
  ) {
    return { status: "preview_not_ready" };
  }

  if (previewMediaAsset.status === "failed") {
    return { status: "preview_unavailable" };
  }

  if (previewMediaAsset.status !== "ready") {
    return { status: "preview_not_ready" };
  }

  const previewPlaybackReference = previewMediaAsset.provider_playback_reference?.trim();

  if (!previewPlaybackReference) {
    return { status: "preview_unavailable" };
  }

  const previewMaxResolution = await resolvePlaybackMaxResolution(auth.userId, supabase);
  const signedPlayback = createMuxSignedPlaybackUrl(
    previewPlaybackReference,
    previewSeconds,
    previewMaxResolution,
  );

  return {
    expiresAt: signedPlayback.expiresAt,
    previewSeconds,
    previewUrl: signedPlayback.playbackUrl,
    status: "ok",
  };
}

async function resolveShortFilmPlayback(
  target: Extract<PlaybackTarget, { targetType: "SHORT_FILM" }>,
  auth: PlaybackAuthContext,
  stillAtSeconds?: number | null,
): Promise<PlaybackAuthorizationResult> {
  const supabase = getSupabase(auth.supabase);
  const { data: shortFilm, error: shortFilmError } = await timePerf("content_lookup", () =>
    supabase
      .from("short_films")
      .select("*")
      .eq("slug", target.slug)
      .eq("status", "published")
      .maybeSingle()
  );

  if (shortFilmError || !shortFilm || !isReleased(shortFilm.publish_at)) {
    return { status: "not_found" };
  }

  const classification = resolveShortFilmClassification(shortFilm);

  if (classification.ageVerificationRequired) {
    return { status: "age_verification_required" };
  }

  if (classification.parentalLockRequired) {
    const parentalControlStatus = await loadParentalControlStatus(auth);

    if (
      parentalControlStatus?.hasPin &&
      meetsParentalRestrictionThreshold(classification.contentRating, parentalControlStatus)
    ) {
      if (!auth.parentalSessionToken?.trim()) {
        return { status: "parental_required" };
      }

      const parentalProofValid = await validateParentalSessionProof({
        guestCredential: auth.guestCredential,
        parentalSessionToken: auth.parentalSessionToken,
        supabase,
        userId: auth.userId,
      });

      if (!parentalProofValid) {
        return { status: "parental_required" };
      }
    }
  }

  if (!shortFilm.media_asset_id) {
    return { status: "playback_unavailable" };
  }

  const { data: mediaAsset, error: mediaAssetError } = await timePerf("media_lookup", () =>
    supabase
      .from("media_assets")
      .select("*")
      .eq("id", shortFilm.media_asset_id)
      .maybeSingle()
  );

  if (mediaAssetError) {
    return { status: "playback_unavailable" };
  }

  if (!mediaAsset) {
    return { status: "playback_unavailable" };
  }

  if (mediaAsset.status !== "ready") {
    return { status: "media_not_ready" };
  }

  const playbackReference = mediaAsset.provider_playback_reference?.trim();

  if (!playbackReference) {
    return { status: "playback_unavailable" };
  }

  if (shortFilm.duration_seconds <= 0) {
    return { status: "playback_unavailable" };
  }

  const shortFilmMaxResolution = await resolvePlaybackMaxResolution(auth.userId, supabase);
  const tMux0 = performance.now();
  const signedPlayback = createMuxSignedPlaybackUrl(
    playbackReference,
    shortFilm.duration_seconds,
    shortFilmMaxResolution,
  );
  const tMux1 = performance.now();
  const collector = getPerfCollector();
  if (collector) collector.addMarker("mux_sign", tMux1 - tMux0);
  let stillUrl: string | undefined;

  if (typeof stillAtSeconds === "number" && Number.isFinite(stillAtSeconds)) {
    try {
      const signedThumbnail = createMuxSignedThumbnailUrl(playbackReference, {
        height: 960,
        timeSeconds: Math.min(
          Math.max(0, stillAtSeconds),
          Math.max(shortFilm.duration_seconds - 0.001, 0),
        ),
        width: 540,
      });

      stillUrl = signedThumbnail.thumbnailUrl;
    } catch (error) {
      console.warn(
        "[0nya playback still]",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return {
    expiresAt: signedPlayback.expiresAt,
    playbackUrl: signedPlayback.playbackUrl,
    ...(stillUrl ? { stillUrl } : {}),
    status: "ok",
  };
}

export async function provisionEpisodePreviewMediaAsset(
  episodeId: string,
  supabaseClient?: SupabaseClient<Database>,
): Promise<EpisodePreviewProvisioningResult> {
  const supabase = getSupabase(supabaseClient);
  const normalizedEpisodeId = episodeId.trim();

  if (!normalizedEpisodeId) {
    return { status: "not_found" };
  }

  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", normalizedEpisodeId)
    .eq("status", "published")
    .maybeSingle();

  if (episodeError || !episode || !isReleased(episode.published_at)) {
    return { status: "not_found" };
  }

  const previewSeconds = Math.max(0, Math.floor(episode.locked_preview_seconds));

  if (previewSeconds <= 0) {
    return { status: "preview_disabled" };
  }

  if (!episode.media_asset_id) {
    return { status: "playback_unavailable" };
  }

  const { data: fullMediaAsset, error: fullMediaAssetError } = await supabase
    .from("media_assets")
    .select("*")
    .eq("id", episode.media_asset_id)
    .maybeSingle();

  if (fullMediaAssetError || !fullMediaAsset) {
    return { status: "playback_unavailable" };
  }

  if (fullMediaAsset.status !== "ready") {
    return { status: "media_not_ready" };
  }

  const sourceAssetId = fullMediaAsset.provider_asset_reference?.trim();

  if (!sourceAssetId) {
    return { status: "playback_unavailable" };
  }

  const previewMatchesCurrentConfig = (mediaAsset: MediaAssetRow | null) =>
    Boolean(
      mediaAsset &&
      mediaAsset.source_media_asset_id === fullMediaAsset.id &&
      mediaAsset.clip_start_seconds === 0 &&
      mediaAsset.clip_end_seconds === previewSeconds &&
      mediaAsset.status !== "failed",
    );

  let previewMediaAsset: MediaAssetRow | null = null;

  if (episode.preview_media_asset_id) {
    const { data, error } = await supabase
      .from("media_assets")
      .select("*")
      .eq("id", episode.preview_media_asset_id)
      .maybeSingle();

    if (!error && previewMatchesCurrentConfig(data)) {
      previewMediaAsset = data;
    }
  }

  if (!previewMediaAsset) {
    const { data } = await supabase
      .from("media_assets")
      .select("*")
      .eq("source_media_asset_id", fullMediaAsset.id)
      .eq("clip_start_seconds", 0)
      .eq("clip_end_seconds", previewSeconds)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previewMatchesCurrentConfig(data)) {
      previewMediaAsset = data;
    }
  }

  if (previewMediaAsset) {
    if (episode.preview_media_asset_id !== previewMediaAsset.id) {
      const { error: updateEpisodeError } = await supabase
        .from("episodes")
        .update({ preview_media_asset_id: previewMediaAsset.id })
        .eq("id", episode.id);

      if (updateEpisodeError) {
        throw new Error("Unable to attach the existing preview media asset.");
      }
    }

    return {
      episodeId: episode.id,
      previewMediaAssetId: previewMediaAsset.id,
      previewSeconds,
      status: "reused",
    };
  }

  const { data: createdPreviewMediaAsset, error: createPreviewMediaAssetError } = await supabase
    .from("media_assets")
    .insert({
      clip_end_seconds: previewSeconds,
      clip_start_seconds: 0,
      provider_name: "mux",
      source_media_asset_id: fullMediaAsset.id,
      status: "pending",
    })
    .select("*")
    .single();

  if (createPreviewMediaAssetError || !createdPreviewMediaAsset) {
    throw new Error("Unable to create the preview media asset.");
  }

  const { error: attachPreviewMediaAssetError } = await supabase
    .from("episodes")
    .update({ preview_media_asset_id: createdPreviewMediaAsset.id })
    .eq("id", episode.id);

  if (attachPreviewMediaAssetError) {
    throw new Error("Unable to attach the preview media asset to the episode.");
  }

  try {
    const muxPreviewClip = await createMuxPreviewClip({
      endTime: previewSeconds,
      passthrough: createdPreviewMediaAsset.id,
      sourceAssetId,
      startTime: 0,
    });

    const nextStatus = muxPreviewClip.status === "ready" && muxPreviewClip.playbackId ? "ready" : "processing";

    const { error: updatePreviewMediaAssetError } = await supabase
      .from("media_assets")
      .update({
        provider_asset_reference: muxPreviewClip.assetId,
        provider_playback_reference: muxPreviewClip.playbackId,
        provider_name: "mux",
        status: nextStatus,
      })
      .eq("id", createdPreviewMediaAsset.id);

    if (updatePreviewMediaAssetError) {
      throw new Error("Unable to persist the preview Mux asset reference.");
    }

    return {
      episodeId: episode.id,
      previewMediaAssetId: createdPreviewMediaAsset.id,
      previewSeconds,
      status: "provisioned",
    };
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : "Unable to create the preview Mux asset.";

    const { error: markFailedError } = await supabase
      .from("media_assets")
      .update({
        failure_code: "mux_preview_asset_error",
        failure_message: failureMessage,
        status: "failed",
      })
      .eq("id", createdPreviewMediaAsset.id);

    if (markFailedError) {
      throw new Error("Unable to mark the preview media asset as failed.");
    }

    throw error instanceof Error ? error : new Error(failureMessage);
  }
}

export async function authorizeMuxPlayback(
  target: PlaybackTarget,
  auth: PlaybackAuthContext,
  stillAtSeconds?: number | null,
): Promise<PlaybackAuthorizationResult> {
  if (target.targetType === "SERIES_EPISODE") {
    return resolveEpisodePlayback(target, auth, stillAtSeconds);
  }

  return resolveShortFilmPlayback(target, auth, stillAtSeconds);
}

export async function authorizeMuxPreviewPlayback(
  target: Extract<PlaybackTarget, { targetType: "SERIES_EPISODE" }>,
  auth: PlaybackAuthContext,
): Promise<PreviewPlaybackAuthorizationResult> {
  return resolvePreviewPlayback(target, auth);
}
