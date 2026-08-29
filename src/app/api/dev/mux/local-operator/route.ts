import path from "node:path";
import { realpath, stat, readFile } from "node:fs/promises";
import { getShortFilmBySlug as getMockShortFilmBySlug } from "@/data/content";
import { errorResponse } from "@/lib/api/responses";
import { authorizeMuxPlayback } from "@/lib/playback";
import { createMuxDirectUpload, reconcileMuxMediaAssetState, rehydrateDevelopmentMuxMediaAssets } from "@/lib/mux";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type LocalOperatorRequest = {
  episodeNumber?: number;
  filePath?: string;
  mediaAssetId?: string;
  mode?: "rehydrate";
  seriesSlug?: string;
  shortFilmSlug?: string;
  targetType?: "SERIES_EPISODE" | "SHORT_FILM";
};

type LoadedEpisode = {
  episode: {
    id: string;
    media_asset_id: string | null;
  };
  supabase: ReturnType<typeof createAdminClient>;
};

type LoadedShortFilm = {
  shortFilm: {
    id: string;
    media_asset_id: string | null;
    playback_reference: string | null;
    slug: string;
  };
  supabase: ReturnType<typeof createAdminClient>;
  created: boolean;
};

type UploadResult = {
  directUploadResult: "created" | "skipped";
  mediaAssetId: string;
  mediaRowCreationResult: "created" | "reused";
};

function isDevelopmentRequestAllowed() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ONYA_DEV_LOCAL_OPERATOR_ENABLED === "true"
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeFilePath(value: string) {
  return value.trim();
}

function getAllowedMediaBaseDir(): string {
  const configured = process.env.ONYA_DEV_LOCAL_OPERATOR_MEDIA_DIR?.trim();

  return configured ? path.resolve(configured) : path.resolve(process.cwd(), "local-media");
}

function resolveAllowedMediaPath(rawPath: string): string {
  const baseDir = getAllowedMediaBaseDir();
  const candidate = path.resolve(baseDir, rawPath);

  if (candidate !== baseDir && !candidate.startsWith(baseDir + path.sep)) {
    throw new Error("Access denied.");
  }

  return candidate;
}

async function loadEpisode(seriesSlug: string, episodeNumber: number): Promise<LoadedEpisode | null> {
  const supabase = createAdminClient();

  const { data: series, error: seriesError } = await supabase
    .from("series")
    .select("id")
    .eq("slug", seriesSlug)
    .eq("status", "published")
    .maybeSingle();

  if (seriesError || !series) {
    return null;
  }

  // Dev-only operator: intentionally does NOT filter on episode status. Media
  // must be attachable to an existing draft episode row (ingest + verify
  // READY) before it is ever flipped to published; the real, RLS/entitlement
  // -aware playback path (src/lib/playback.ts) still requires "published"
  // independently, so this does not loosen anything user-facing.
  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .select("id,media_asset_id")
    .eq("series_id", series.id)
    .eq("episode_number", episodeNumber)
    .maybeSingle();

  if (episodeError || !episode) {
    return null;
  }

  return { episode, supabase };
}

async function loadShortFilm(shortFilmSlug: string): Promise<LoadedShortFilm | null> {
  const supabase = createAdminClient();

  const { data: shortFilm, error } = await supabase
    .from("short_films")
    .select("id,media_asset_id,playback_reference,slug")
    .eq("slug", shortFilmSlug)
    .maybeSingle();

  if (error) {
    return null;
  }

  if (shortFilm) {
    return { created: false, shortFilm, supabase };
  }

  const mockShortFilm = getMockShortFilmBySlug(shortFilmSlug);

  if (!mockShortFilm) {
    return null;
  }

  const { data: createdShortFilm, error: createError } = await supabase
    .from("short_films")
    .insert({
      chai_enabled: false,
      content_descriptors: [],
      content_rating: null,
      creator_reference: null,
      duration_seconds: 300,
      hero_image_url: mockShortFilm.poster,
      language: "Hindi",
      midroll_enabled: false,
      midroll_timecodes: [],
      playback_reference: null,
      postroll_enabled: false,
      poster_url: mockShortFilm.poster,
      publish_at: new Date().toISOString(),
      slug: mockShortFilm.slug,
      status: "published",
      synopsis: mockShortFilm.synopsis,
      title: mockShortFilm.title,
    })
    .select("id,media_asset_id,playback_reference,slug")
    .single();

  if (createError || !createdShortFilm) {
    return null;
  }

  return { created: true, shortFilm: createdShortFilm, supabase };
}

function getUploadContentType(filePath: string) {
  return filePath.toLowerCase().endsWith(".mp4") ? "video/mp4" : "application/octet-stream";
}

async function uploadFileToMux(uploadUrl: string, filePath: string) {
  let resolvedPath: string;

  try {
    resolvedPath = resolveAllowedMediaPath(filePath);
  } catch {
    throw new Error("Access denied.");
  }

  let realPath: string;

  try {
    realPath = await realpath(resolvedPath);
  } catch {
    throw new Error("Unable to read local media file.");
  }

  const baseDir = getAllowedMediaBaseDir();
  if (realPath !== baseDir && !realPath.startsWith(baseDir + path.sep)) {
    throw new Error("Access denied.");
  }

  let fileBytes: Buffer;
  try {
    fileBytes = await readFile(realPath);
  } catch {
    throw new Error("Unable to read local media file.");
  }

  const response = await fetch(uploadUrl, {
    body: fileBytes as unknown as BodyInit,
    headers: {
      "Content-Type": getUploadContentType(filePath),
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(`Mux direct upload failed with status ${response.status}.`);
  }
}

function buildEpisodePayload(input: {
  directUploadResult: "created" | "skipped";
  episodeAssociation: string;
  maxResolutionTier: string | null;
  mediaAssetId: string;
  mediaAssetsStatus: string;
  mediaRowCreationResult: "created" | "reused";
  muxAssetState: string;
  muxUploadState: string;
  reconciliationResult: string;
  resolutionTier: string | null;
  signedPlaybackAuthorization: string;
  status: string;
  securityCheck: string;
  nextAction: string;
}) {
  return {
    ...input,
    operatorMechanism: "dev-route",
    filesChanged: [
      "src/lib/mux/index.ts",
      "src/app/api/dev/mux/local-operator/route.ts",
      "scripts/mux-local-operator.mjs",
      "package.json",
    ],
  };
}

function buildShortFilmPayload(input: {
  directUploadResult: "created" | "skipped";
  maxResolutionTier: string | null;
  mediaAssetId: string;
  mediaAssetsStatus: string;
  mediaRowCreationResult: "created" | "reused";
  muxAssetState: string;
  muxUploadState: string;
  reconciliationResult: string;
  resolutionTier: string | null;
  signedPlaybackAuthorization: string;
  shortFilmAssociation: string;
  shortFilmPlaybackReady: boolean;
  status: string;
  securityCheck: string;
  nextAction: string;
}) {
  return {
    ...input,
    operatorMechanism: "dev-route",
    filesChanged: [
      "src/lib/mux/index.ts",
      "src/app/api/dev/mux/local-operator/route.ts",
      "scripts/mux-local-operator.mjs",
      "package.json",
    ],
  };
}

async function reconcileUntilSettled(mediaAssetId: string, supabase: ReturnType<typeof createAdminClient>) {
  let reconciliation = await reconcileMuxMediaAssetState(mediaAssetId, supabase);

  if (reconciliation.status === "not_found") {
    return reconciliation;
  }

  if (reconciliation.status === "updated" && reconciliation.mediaStatus === "processing") {
    const waitTimes = [1500, 3000];

    for (const waitTime of waitTimes) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      reconciliation = await reconcileMuxMediaAssetState(mediaAssetId, supabase);

      if (reconciliation.status === "not_found" || reconciliation.mediaStatus !== "processing") {
        break;
      }
    }
  }

  return reconciliation;
}

async function createAndUploadMediaAsset(
  supabase: ReturnType<typeof createAdminClient>,
  mediaAssetId: string | null,
  filePath: string,
) {
  let resolvedMediaAssetId = mediaAssetId;
  let mediaRowCreationResult: "created" | "reused" = "reused";
  let directUploadResult: "created" | "skipped" = "skipped";

  if (!resolvedMediaAssetId) {
    const { data: createdMediaAsset, error: createError } = await supabase
      .from("media_assets")
      .insert({
        provider_name: "mux",
        status: "pending",
      })
      .select("id")
      .single();

    if (createError || !createdMediaAsset) {
      const failureMessage = createError?.message ?? "Unable to create the media asset row.";
      throw new Error(failureMessage);
    }

    resolvedMediaAssetId = createdMediaAsset.id;
    mediaRowCreationResult = "created";
  }

  const directUpload = await createMuxDirectUpload(resolvedMediaAssetId, supabase);
  directUploadResult = "created";

  if (filePath) {
    await uploadFileToMux(directUpload.uploadUrl, filePath);
  }

  return {
    directUpload,
    directUploadResult,
    mediaRowCreationResult,
    mediaAssetId: resolvedMediaAssetId,
  };
}

export async function POST(request: Request) {
  if (!isDevelopmentRequestAllowed()) {
    return errorResponse("not_found", "This operator is only available in development.", 404);
  }

  let body: LocalOperatorRequest;

  try {
    body = (await request.json()) as LocalOperatorRequest;
  } catch {
    return errorResponse("invalid_request", "A valid JSON body is required.", 400);
  }

  if (body.mode === "rehydrate") {
    const rehydrationResult = await rehydrateDevelopmentMuxMediaAssets();
    const verificationSupabase = createAdminClient();

    for (const target of rehydrationResult.targets) {
      if (target.label === "Aadha Takiya Episode 1") {
        const playbackAuthorization = await authorizeMuxPlayback(
          {
            episodeNumber: 1,
            seriesSlug: "aadha-takiya",
            targetType: "SERIES_EPISODE",
          },
          {
            parentalSessionToken: null,
            supabase: verificationSupabase,
            userId: null,
          },
        );

        target.playbackAuthorizationStatus = playbackAuthorization.status;
      } else if (target.label === "Trial & Error Short Film") {
        const playbackAuthorization = await authorizeMuxPlayback(
          {
            slug: "mute-button",
            targetType: "SHORT_FILM",
          },
          {
            parentalSessionToken: null,
            supabase: verificationSupabase,
            userId: null,
          },
        );

        target.playbackAuthorizationStatus = playbackAuthorization.status;
      }
    }

    return jsonResponse(rehydrationResult);
  }

  const targetType = body.targetType ?? (body.shortFilmSlug ? "SHORT_FILM" : "SERIES_EPISODE");
  const rawFilePath = body.filePath ? normalizeFilePath(body.filePath) : "";
  const mediaAssetId = body.mediaAssetId?.trim() ?? "";

  let filePath = "";
  if (rawFilePath) {
    let resolvedPath: string;
    try {
      resolvedPath = resolveAllowedMediaPath(rawFilePath);
    } catch {
      return errorResponse("forbidden", "Access denied.", 403);
    }

    try {
      const fileStat = await stat(resolvedPath);
      if (!fileStat.isFile()) {
        return errorResponse("invalid_request", "Invalid file path.", 400);
      }
    } catch {
      return errorResponse("invalid_request", "File not found.", 400);
    }

    filePath = resolvedPath;
  }

  if (targetType === "SHORT_FILM") {
    const shortFilmSlug = body.shortFilmSlug?.trim();

    if (!shortFilmSlug) {
      return errorResponse("invalid_request", "shortFilmSlug is required for short film proof mode.", 400);
    }

    if (!filePath && !mediaAssetId) {
      return errorResponse("invalid_request", "filePath is required for a fresh short film upload.", 400);
    }

    const loadedShortFilm = await loadShortFilm(shortFilmSlug);

    if (!loadedShortFilm) {
      return errorResponse("not_found", "Target short film not found.", 404);
    }

    const { shortFilm, supabase } = loadedShortFilm;

    if (shortFilm.media_asset_id && mediaAssetId && shortFilm.media_asset_id !== mediaAssetId) {
      return errorResponse("invalid_request", "Short film already has a media asset attached.", 409);
    }

    let attachmentStatus = shortFilm.media_asset_id ? "already_attached" : "attached";
    let uploadResult: UploadResult = {
      directUploadResult: "skipped" as const,
      mediaAssetId: shortFilm.media_asset_id ?? mediaAssetId,
      mediaRowCreationResult: "reused" as const,
    };

    if (!uploadResult.mediaAssetId) {
      try {
        uploadResult = await createAndUploadMediaAsset(supabase, null, filePath);
      } catch (error) {
        const failureMessage = error instanceof Error ? error.message : "Mux direct upload creation failed.";
        return errorResponse("server_error", failureMessage, 502);
      }
    }

    const { error: attachShortFilmError } = await supabase
      .from("short_films")
      .update({ media_asset_id: uploadResult.mediaAssetId })
      .eq("id", shortFilm.id);

    if (attachShortFilmError) {
      return errorResponse("server_error", "Unable to attach the media asset to the short film.", 500);
    }

    attachmentStatus = "attached";

    const reconciliation = await reconcileUntilSettled(uploadResult.mediaAssetId, supabase);

    if (reconciliation.status === "not_found") {
      return errorResponse("not_found", "Media asset not found.", 404);
    }

    if (reconciliation.status === "updated" && reconciliation.mediaStatus === "processing") {
      return jsonResponse(
        buildShortFilmPayload({
          directUploadResult: uploadResult.directUploadResult,
          maxResolutionTier: reconciliation.maxResolutionTier ?? null,
          mediaAssetId: uploadResult.mediaAssetId,
          mediaAssetsStatus: reconciliation.mediaStatus,
          mediaRowCreationResult: uploadResult.mediaRowCreationResult,
          muxAssetState: reconciliation.muxAssetStatus ?? "unknown",
          muxUploadState: reconciliation.muxUploadStatus ?? "unknown",
          nextAction: "Re-run with mediaAssetId to reconcile later.",
          reconciliationResult: "PROCESSING",
          resolutionTier: reconciliation.resolutionTier ?? null,
          securityCheck: "server-only; no raw secrets logged; RLS unchanged",
          shortFilmAssociation: attachmentStatus,
          shortFilmPlaybackReady: false,
          signedPlaybackAuthorization: "skipped",
          status: "processing",
        }),
      );
    }

    const providerPlaybackReference =
      reconciliation.status === "updated" ? reconciliation.providerPlaybackReference : null;

    const { error: updateShortFilmError } = await supabase
      .from("short_films")
      .update({
        media_asset_id: uploadResult.mediaAssetId,
        playback_reference: providerPlaybackReference,
      })
      .eq("id", shortFilm.id);

    if (updateShortFilmError) {
      return errorResponse("server_error", "Unable to persist the short film playback state.", 500);
    }

    const playbackAuthorization = await authorizeMuxPlayback(
      {
        slug: shortFilm.slug,
        targetType: "SHORT_FILM",
      },
      {
        parentalSessionToken: null,
        supabase,
        userId: null,
      },
    );

    const signedPlaybackAuthorization =
      playbackAuthorization.status === "ok" ? "ok" : playbackAuthorization.status;

    return jsonResponse(
      buildShortFilmPayload({
        directUploadResult: uploadResult.directUploadResult,
        maxResolutionTier: reconciliation.status === "updated" ? reconciliation.maxResolutionTier ?? null : null,
        mediaAssetId: uploadResult.mediaAssetId,
        mediaAssetsStatus: reconciliation.status === "updated" ? reconciliation.mediaStatus : "unknown",
        mediaRowCreationResult: uploadResult.mediaRowCreationResult,
        muxAssetState: reconciliation.status === "updated" ? reconciliation.muxAssetStatus ?? "unknown" : "unknown",
        muxUploadState: reconciliation.status === "updated" ? reconciliation.muxUploadStatus ?? "unknown" : "unknown",
        nextAction: playbackAuthorization.status === "ok" ? "None." : "Investigate the authorization status.",
        reconciliationResult:
          reconciliation.status === "updated" ? reconciliation.mediaStatus.toUpperCase() : "NOT_FOUND",
        resolutionTier: reconciliation.status === "updated" ? reconciliation.resolutionTier ?? null : null,
        securityCheck: "server-only; no raw secrets logged; RLS unchanged",
        shortFilmAssociation: attachmentStatus,
        shortFilmPlaybackReady: Boolean(providerPlaybackReference),
        signedPlaybackAuthorization,
        status: playbackAuthorization.status === "ok" ? "done" : "done",
      }),
    );
  }

  const seriesSlug = body.seriesSlug?.trim();
  const episodeNumber = typeof body.episodeNumber === "number" ? body.episodeNumber : NaN;

  if (!seriesSlug || !Number.isInteger(episodeNumber) || episodeNumber <= 0) {
    return errorResponse("invalid_request", "seriesSlug and a positive episodeNumber are required.", 400);
  }

  if (!filePath && !mediaAssetId) {
    return errorResponse("invalid_request", "filePath is required for a fresh upload.", 400);
  }

  const loadedEpisode = await loadEpisode(seriesSlug, episodeNumber);

  if (!loadedEpisode) {
    return errorResponse("not_found", "Target episode not found.", 404);
  }

  const { episode, supabase } = loadedEpisode;

  if (episode.media_asset_id && mediaAssetId && episode.media_asset_id !== mediaAssetId) {
    return errorResponse("invalid_request", "Episode already has a media asset attached.", 409);
  }

  let attachmentStatus = episode.media_asset_id ? "already_attached" : "attached";
  let uploadResult: UploadResult = {
    directUploadResult: "skipped" as const,
    mediaAssetId: episode.media_asset_id ?? mediaAssetId,
    mediaRowCreationResult: "reused" as const,
  };

  if (!uploadResult.mediaAssetId) {
    try {
      uploadResult = await createAndUploadMediaAsset(supabase, null, filePath);
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Mux direct upload creation failed.";
      return errorResponse("server_error", failureMessage, 502);
    }
  }

  const { error: attachEpisodeError } = await supabase
    .from("episodes")
    .update({ media_asset_id: uploadResult.mediaAssetId })
    .eq("id", episode.id);

  if (attachEpisodeError) {
    return errorResponse("server_error", "Unable to attach the media asset to the episode.", 500);
  }

  attachmentStatus = "attached";

  const reconciliation = await reconcileUntilSettled(uploadResult.mediaAssetId, supabase);

  if (reconciliation.status === "not_found") {
    return errorResponse("not_found", "Media asset not found.", 404);
  }

  if (reconciliation.status === "updated" && reconciliation.mediaStatus === "processing") {
    return jsonResponse(
      buildEpisodePayload({
        directUploadResult: uploadResult.directUploadResult,
        episodeAssociation: attachmentStatus,
        maxResolutionTier: reconciliation.maxResolutionTier ?? null,
        mediaAssetId: uploadResult.mediaAssetId,
        mediaAssetsStatus: reconciliation.mediaStatus,
        mediaRowCreationResult: uploadResult.mediaRowCreationResult,
        muxAssetState: reconciliation.muxAssetStatus ?? "unknown",
        muxUploadState: reconciliation.muxUploadStatus ?? "unknown",
        nextAction: "Re-run with mediaAssetId to reconcile later.",
        reconciliationResult: "PROCESSING",
        resolutionTier: reconciliation.resolutionTier ?? null,
        securityCheck: "server-only; no raw secrets logged; RLS unchanged",
        signedPlaybackAuthorization: "skipped",
        status: "processing",
      }),
    );
  }

  const playbackAuthorization = await authorizeMuxPlayback(
    {
      episodeNumber,
      seriesSlug,
      targetType: "SERIES_EPISODE",
    },
    {
      parentalSessionToken: null,
      supabase,
      userId: null,
    },
  );

  const signedPlaybackAuthorization =
    playbackAuthorization.status === "ok" ? "ok" : playbackAuthorization.status;

  return jsonResponse(
    buildEpisodePayload({
      directUploadResult: uploadResult.directUploadResult,
      episodeAssociation: attachmentStatus,
      maxResolutionTier: reconciliation.status === "updated" ? reconciliation.maxResolutionTier ?? null : null,
      mediaAssetId: uploadResult.mediaAssetId,
      mediaAssetsStatus: reconciliation.status === "updated" ? reconciliation.mediaStatus : "unknown",
      mediaRowCreationResult: uploadResult.mediaRowCreationResult,
      muxAssetState: reconciliation.status === "updated" ? reconciliation.muxAssetStatus ?? "unknown" : "unknown",
      muxUploadState: reconciliation.status === "updated" ? reconciliation.muxUploadStatus ?? "unknown" : "unknown",
      nextAction: playbackAuthorization.status === "ok" ? "None." : "Investigate the authorization status.",
      reconciliationResult: reconciliation.status === "updated" ? reconciliation.mediaStatus.toUpperCase() : "NOT_FOUND",
      resolutionTier: reconciliation.status === "updated" ? reconciliation.resolutionTier ?? null : null,
      securityCheck: "server-only; no raw secrets logged; RLS unchanged",
      signedPlaybackAuthorization,
      status: playbackAuthorization.status === "ok" ? "done" : "done",
    }),
  );
}
