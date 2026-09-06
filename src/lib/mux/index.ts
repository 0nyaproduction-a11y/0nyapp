import "server-only";

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import {
  getMuxApiCredentials,
  getMuxDirectUploadCorsOrigin,
  getMuxPlaybackSigningCredentials,
} from "@/lib/mux/env";

type MuxPlaybackId = {
  id: string;
  policy: "public" | "signed" | "drm";
};

type MuxWebhookMediaData = {
  id?: string;
  passthrough?: string | null;
  direct_upload_id?: string | null;
  playback_ids?: MuxPlaybackId[] | null;
  errors?: Array<{
    type?: string | null;
    message?: string | null;
  }> | null;
};

export type MuxWebhookEvent = {
  type?: string | null;
  data?: MuxWebhookMediaData | null;
};

export type MuxDirectUploadResult = {
  mediaAssetId: string;
  uploadId: string;
  uploadUrl: string;
  corsOrigin: string | null;
};

export type MuxWebhookProcessingResult =
  | {
      status: "ignored";
    }
  | {
      status: "invalid";
      reason: "missing_signature" | "invalid_signature" | "invalid_payload" | "missing_passthrough";
    }
  | {
      status: "not_found";
    }
  | {
      status: "updated";
      mediaAssetId: string;
      mediaStatus: Database["public"]["Tables"]["media_assets"]["Row"]["status"];
    };

export type MuxSignedPlaybackResult = {
  playbackUrl: string;
  expiresAt: string;
};

export type MuxSignedThumbnailResult = {
  expiresAt: string;
  thumbnailUrl: string;
};

export type MuxAssetDeleteResult = {
  assetId: string;
  alreadyMissing: boolean;
};

export type MuxSubtitleTextTrackInput = {
  assetId: string;
  closedCaptions?: boolean;
  languageCode: string;
  name: string;
  sourceUrl: string;
};

export type MuxSubtitleTextTrackResult = {
  assetId: string;
  closedCaptions: boolean;
  languageCode: string;
  name: string;
  status: "preparing" | "ready" | "errored" | "deleted";
  trackId: string;
};

type MuxUploadRecord = {
  asset_id?: string | null;
  errors?: Array<{
    message?: string | null;
    type?: string | null;
  }> | null;
  id?: string;
  status?: string | null;
};

type MuxAssetRecord = {
  errors?: Array<{
    message?: string | null;
    type?: string | null;
  }> | null;
  id?: string;
  // Diagnostic-only fields (read-only): the tier Mux actually ingested/can
  // deliver at, and the ceiling that was configured for the asset. Exact Mux
  // API field names; see https://www.mux.com/docs/api-reference/video.
  max_resolution_tier?: string | null;
  playback_ids?: MuxPlaybackId[] | null;
  resolution_tier?: string | null;
  status?: string | null;
};

type MuxAssetListRecord = {
  duration?: number | null;
  id?: string;
  playback_ids?: MuxPlaybackId[] | null;
  status?: string | null;
};

type MuxUploadListRecord = {
  asset_id?: string | null;
  id?: string;
  passthrough?: string | null;
  status?: string | null;
};

export type DevMediaRehydrationTargetStatus =
  | "UNCHANGED"
  | "REHYDRATED"
  | "AMBIGUOUS"
  | "MISSING"
  | "NOT_FOUND";

export type DevMediaRehydrationTargetResult = {
  label: string;
  mediaAssetId: string | null;
  providerAssetReference: string | null;
  providerPlaybackReference: string | null;
  playbackAuthorizationStatus: string | null;
  status: DevMediaRehydrationTargetStatus;
  reason: string | null;
};

export type DevMediaRehydrationResult = {
  filesChanged: string[];
  nextAction: string;
  providerMatchingStrategy: string;
  securityCheck: string;
  status: "done" | "blocked";
  targets: DevMediaRehydrationTargetResult[];
};

const MUX_PLAYBACK_BUFFER_SECONDS = 30 * 60;
// Preview credentials need enough time for player startup, HLS playlist/segment
// loading, the configured preview, and a bounded network retry. This expiry is
// defense-in-depth; asset_end_time is the content-window restriction.
export const MUX_PREVIEW_TOKEN_TTL_SECONDS = 2 * 60;

async function getSupabase(supabaseClient?: SupabaseClient<Database>) {
  return supabaseClient ?? createAdminClient();
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signJwt(header: Record<string, string>, payload: Record<string, string | number>) {
  const { privateKey } = getMuxPlaybackSigningCredentials();
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).end().sign(privateKey);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function buildBasicAuthHeader() {
  const { tokenId, tokenSecret } = getMuxApiCredentials();
  const credentials = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");

  return `Basic ${credentials}`;
}

async function fetchMuxResource<T>(path: string) {
  const response = await fetch(`https://api.mux.com${path}`, {
    headers: {
      Authorization: buildBasicAuthHeader(),
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Mux API request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: T;
  };

  return payload.data ?? null;
}

async function getMuxSafeErrorSummary(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: {
        messages?: string[];
        type?: string;
      };
    };

    const errorType = payload.error?.type?.trim();
    const messages = payload.error?.messages?.map((message) => message.trim()).filter(Boolean) ?? [];
    const detail = [errorType, ...messages].filter(Boolean).join(": ");

    return detail ? ` ${detail}` : "";
  } catch {
    return "";
  }
}

export async function deleteMuxAsset(assetId: string): Promise<MuxAssetDeleteResult> {
  const normalizedAssetId = assetId.trim();

  if (!normalizedAssetId) {
    throw new Error("Mux asset ID is required.");
  }

  const response = await fetch(`https://api.mux.com/video/v1/assets/${encodeURIComponent(normalizedAssetId)}`, {
    method: "DELETE",
    headers: {
      Authorization: buildBasicAuthHeader(),
    },
  });

  if (response.status === 404) {
    return { assetId: normalizedAssetId, alreadyMissing: true };
  }

  if (!response.ok) {
    throw new Error(`Mux asset deletion failed with status ${response.status}.`);
  }

  return { assetId: normalizedAssetId, alreadyMissing: false };
}

export async function fetchMuxCollection<T>(path: string) {
  const response = await fetch(`https://api.mux.com${path}`, {
    headers: {
      Authorization: buildBasicAuthHeader(),
    },
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Mux API request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: T[] | null;
  };

  return payload.data ?? [];
}

function getSignedPlaybackId(playbackIds: MuxPlaybackId[] | null | undefined) {
  return playbackIds?.find((playbackId) => playbackId.policy === "signed")?.id ?? null;
}

function getMuxEventStatus(eventType: string): Database["public"]["Tables"]["media_assets"]["Row"]["status"] | null {
  if (eventType.endsWith(".ready")) {
    return "ready";
  }

  if (eventType.endsWith(".errored") || eventType.endsWith(".deleted")) {
    return "failed";
  }

  if (eventType.includes(".created")) {
    return "processing";
  }

  return null;
}

function isMuxAssetEvent(eventType: string) {
  return eventType.startsWith("video.asset.");
}

function isMuxUploadEvent(eventType: string) {
  return eventType.startsWith("video.upload.");
}

function getMuxFailureDetails(data: MuxWebhookMediaData) {
  const failure = data.errors?.[0];

  return {
    failureCode: failure?.type ?? "mux_asset_error",
    failureMessage: failure?.message ?? null,
  };
}

function getMuxErrorDetails(errors: Array<{ message?: string | null; type?: string | null }> | null | undefined) {
  const failure = errors?.[0];

  return {
    failureCode: failure?.type ?? "mux_asset_error",
    failureMessage: failure?.message ?? null,
  };
}

function mapMuxUploadStatus(status: string | null | undefined) {
  if (!status) {
    return "processing" as const;
  }

  if (status === "errored" || status === "cancelled" || status === "timed_out") {
    return "failed" as const;
  }

  return "processing" as const;
}

function mapMuxAssetStatus(status: string | null | undefined) {
  if (!status) {
    return "processing" as const;
  }

  if (status === "ready") {
    return "ready" as const;
  }

  if (status === "errored" || status === "deleted" || status === "cancelled") {
    return "failed" as const;
  }

  return "processing" as const;
}

function isHexSignature(signature: string) {
  return /^[0-9a-f]+$/i.test(signature) && signature.length % 2 === 0;
}

export function verifyMuxWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  signingSecret: string,
  now = Date.now(),
) {
  if (!signatureHeader) {
    return { valid: false, reason: "missing_signature" as const };
  }

  const parts = new Map(
    signatureHeader
      .split(",")
      .map((part) => part.trim())
      .map((part) => part.split("=", 2) as [string, string | undefined]),
  );

  const timestamp = parts.get("t");
  const signature = parts.get("v1");

  if (!timestamp || !signature || !/^\d+$/.test(timestamp) || !isHexSignature(signature)) {
    return { valid: false, reason: "invalid_signature" as const };
  }

  const payload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto.createHmac("sha256", signingSecret).update(payload).digest("hex");

  if (
    expectedSignature.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expectedSignature, "hex"), Buffer.from(signature, "hex"))
  ) {
    return { valid: false, reason: "invalid_signature" as const };
  }

  const timestampSeconds = Number(timestamp);
  const currentSeconds = Math.floor(now / 1000);

  if (Math.abs(currentSeconds - timestampSeconds) > 300) {
    return { valid: false, reason: "invalid_signature" as const };
  }

  return { valid: true, reason: null };
}

export async function createMuxDirectUpload(
  mediaAssetId: string,
  supabaseClient?: SupabaseClient<Database>,
  corsOriginOverride?: string | null,
): Promise<MuxDirectUploadResult> {
  const supabase = await getSupabase(supabaseClient);
  const normalizedMediaAssetId = mediaAssetId.trim();

  const { data: mediaAsset, error: mediaAssetError } = await supabase
    .from("media_assets")
    .select("id,provider_upload_reference,provider_asset_reference")
    .eq("id", normalizedMediaAssetId)
    .maybeSingle();

  if (mediaAssetError || !mediaAsset) {
    throw new Error("Media asset not found.");
  }

  if (mediaAsset.provider_upload_reference || mediaAsset.provider_asset_reference) {
    throw new Error("Media asset is already linked to a Mux upload.");
  }

  const resolvedCorsOrigin = corsOriginOverride?.trim() || getMuxDirectUploadCorsOrigin();

  const response = await fetch("https://api.mux.com/video/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(resolvedCorsOrigin ? { cors_origin: resolvedCorsOrigin } : {}),
      new_asset_settings: {
        // Future 0nya VOD asset infrastructure policy: without this field Mux
        // defaults new assets to a 1080p maximum. This does not manufacture
        // 1440p detail from a lower-resolution source and is not a
        // client-selectable value.
        max_resolution_tier: "1440p",
        playback_policies: ["signed"],
        passthrough: normalizedMediaAssetId,
      },
    }),
  });

  if (!response.ok) {
    const safeErrorSummary = await getMuxSafeErrorSummary(response);
    throw new Error(`Mux direct upload creation failed with status ${response.status}.${safeErrorSummary}`);
  }

  const payload = (await response.json()) as {
    data?: {
      id?: string;
      url?: string;
    };
  };

  const uploadId = payload.data?.id?.trim();
  const uploadUrl = payload.data?.url?.trim();

  if (!uploadId || !uploadUrl) {
    throw new Error("Mux direct upload response was missing upload details.");
  }

  const { error: updateError } = await supabase
    .from("media_assets")
    .update({
      provider_name: "mux",
      provider_upload_reference: uploadId,
      status: "pending",
    })
    .eq("id", normalizedMediaAssetId);

  if (updateError) {
    throw new Error("Unable to persist Mux direct upload details.");
  }

  return {
    mediaAssetId: normalizedMediaAssetId,
    uploadId,
    uploadUrl,
    corsOrigin: resolvedCorsOrigin,
  };
}

export async function processMuxWebhookEvent(
  event: MuxWebhookEvent,
  supabaseClient?: SupabaseClient<Database>,
): Promise<MuxWebhookProcessingResult> {
  const eventType = event.type?.trim();

  if (!eventType) {
    return { status: "ignored" };
  }

  const mediaStatus = getMuxEventStatus(eventType);

  if (!mediaStatus) {
    return { status: "ignored" };
  }

  const mediaAssetId = event.data?.passthrough?.trim();

  if (!mediaAssetId) {
    return { status: "invalid", reason: "missing_passthrough" };
  }

  const supabase = await getSupabase(supabaseClient);
  const { data: mediaAsset, error: mediaAssetError } = await supabase
    .from("media_assets")
    .select("id")
    .eq("id", mediaAssetId)
    .maybeSingle();

  if (mediaAssetError || !mediaAsset) {
    return { status: "not_found" };
  }

  const updatePayload: Database["public"]["Tables"]["media_assets"]["Update"] = {
    provider_name: "mux",
    status: mediaStatus,
  };

  if (isMuxAssetEvent(eventType)) {
    const providerAssetReference = event.data?.id?.trim();

    if (providerAssetReference) {
      updatePayload.provider_asset_reference = providerAssetReference;
    }
  }

  const providerUploadReference = event.data?.direct_upload_id?.trim() ?? (isMuxUploadEvent(eventType) ? event.data?.id?.trim() : undefined);

  if (providerUploadReference) {
    updatePayload.provider_upload_reference = providerUploadReference;
  }

  if (mediaStatus === "ready") {
    const signedPlaybackId = getSignedPlaybackId(event.data?.playback_ids ?? null);

    if (!signedPlaybackId) {
      const { failureCode, failureMessage } = getMuxFailureDetails({
        errors: [{ type: "missing_signed_playback_id", message: "Mux asset ready event did not include a signed playback ID." }],
      });

      updatePayload.status = "failed";
      updatePayload.failure_code = failureCode;
      updatePayload.failure_message = failureMessage;
    } else {
      updatePayload.provider_playback_reference = signedPlaybackId;
      updatePayload.failure_code = null;
      updatePayload.failure_message = null;
    }
  }

  if (mediaStatus === "failed") {
    const { failureCode, failureMessage } = getMuxFailureDetails(event.data ?? {});

    updatePayload.failure_code = failureCode;
    updatePayload.failure_message = failureMessage;
  }

  const { error: updateError } = await supabase
    .from("media_assets")
    .update(updatePayload)
    .eq("id", mediaAssetId);

  if (updateError) {
    throw new Error("Unable to update Mux media asset state.");
  }

  return {
    status: "updated",
    mediaAssetId,
    mediaStatus: updatePayload.status ?? mediaStatus,
  };
}

export type MuxMediaAssetReconciliationResult =
  | {
      mediaAssetId: string;
      // Diagnostic-only: the tier Mux reports for this asset, not used for
      // authorization/playback decisions.
      maxResolutionTier: string | null;
      muxAssetStatus: string | null;
      muxUploadStatus: string | null;
      providerAssetReference: string | null;
      providerPlaybackReference: string | null;
      providerUploadReference: string | null;
      resolutionTier: string | null;
      status: "updated";
      mediaStatus: Database["public"]["Tables"]["media_assets"]["Row"]["status"];
    }
  | {
      mediaAssetId: string;
      status: "not_found";
    };


type MuxInspectionCore = {
  providerUploadReference: string | null;
  providerAssetReference: string | null;
  providerPlaybackReference: string | null;
  muxUploadStatus: string | null;
  muxAssetStatus: string | null;
  muxAssetExists: boolean;
  muxUploadExists: boolean;
  mediaStatus: Database["public"]["Tables"]["media_assets"]["Row"]["status"];
  failureCode: string | null;
  failureMessage: string | null;
  signedPlaybackId: string | null;
  maxResolutionTier: string | null;
  resolutionTier: string | null;
};

// Read-only shared core used by both reconcileMuxMediaAssetState (which writes
// the result back to Supabase) and inspectMuxMediaAssetState (which never
// touches the database). Keeps the Mux GET + status-mapping logic in one place.
async function readMuxMediaAssetState(
  mediaAsset: Database["public"]["Tables"]["media_assets"]["Row"],
): Promise<MuxInspectionCore> {
  const providerUploadReference = mediaAsset.provider_upload_reference?.trim() || null;
  let providerAssetReference = mediaAsset.provider_asset_reference?.trim() || null;
  let providerPlaybackReference = mediaAsset.provider_playback_reference?.trim() || null;
  let muxUploadStatus: string | null = null;
  let muxAssetStatus: string | null = null;
  let mediaStatus: Database["public"]["Tables"]["media_assets"]["Row"]["status"] = mediaAsset.status;
  let failureCode = mediaAsset.failure_code;
  let failureMessage = mediaAsset.failure_message;
  let muxAssetExists = false;
  let muxUploadExists = false;
  let signedPlaybackId: string | null = null;
  let maxResolutionTier: string | null = null;
  let resolutionTier: string | null = null;

  if (providerUploadReference) {
    const upload = await fetchMuxResource<MuxUploadRecord>(
      `/video/v1/uploads/${providerUploadReference}`,
    );

    if (upload) {
      muxUploadExists = true;
      muxUploadStatus = upload.status ?? null;

      if (!providerAssetReference && upload.asset_id?.trim()) {
        providerAssetReference = upload.asset_id.trim();
      }
    }
  }

  let muxAsset: MuxAssetRecord | null = null;

  if (providerAssetReference) {
    muxAsset = await fetchMuxResource<MuxAssetRecord>(
      `/video/v1/assets/${providerAssetReference}`,
    );

    if (muxAsset) {
      muxAssetExists = true;
      muxAssetStatus = muxAsset.status ?? null;
      maxResolutionTier = muxAsset.max_resolution_tier ?? null;
      resolutionTier = muxAsset.resolution_tier ?? null;
    }
  }

  if (muxAsset && muxAsset.status) {
    const mappedAssetStatus = mapMuxAssetStatus(muxAsset.status);

    mediaStatus =
      mappedAssetStatus === "ready"
        ? "ready"
        : mappedAssetStatus === "failed"
          ? "failed"
          : "processing";

    if (mappedAssetStatus === "ready") {
      const signedId = getSignedPlaybackId(muxAsset.playback_ids ?? null);

      if (!signedId) {
        mediaStatus = "failed";
        const failureDetails = getMuxErrorDetails([
          {
            message: "Mux asset ready state did not include a signed playback ID.",
            type: "missing_signed_playback_id",
          },
        ]);
        failureCode = failureDetails.failureCode;
        failureMessage = failureDetails.failureMessage;
        providerPlaybackReference = null;
        signedPlaybackId = null;
      } else {
        signedPlaybackId = signedId;
        providerPlaybackReference = signedId;
        failureCode = null;
        failureMessage = null;
      }
    }

    if (mappedAssetStatus === "failed") {
      const failureDetails = getMuxErrorDetails(muxAsset.errors ?? null);
      failureCode = failureDetails.failureCode;
      failureMessage = failureDetails.failureMessage;
    }
  } else if (providerUploadReference) {
    const mappedUploadStatus = mapMuxUploadStatus(muxUploadStatus);

    if (mappedUploadStatus === "failed") {
      mediaStatus = "failed";
      const failureDetails = getMuxErrorDetails(uploadErrorsFromStatus(muxUploadStatus));
      failureCode = failureDetails.failureCode;
      failureMessage = failureDetails.failureMessage;
    } else {
      mediaStatus = "processing";
    }
  } else {
    mediaStatus = mediaAsset.status;
  }

  return {
    providerUploadReference,
    providerAssetReference,
    providerPlaybackReference,
    muxUploadStatus,
    muxAssetStatus,
    muxAssetExists,
    muxUploadExists,
    mediaStatus,
    failureCode,
    failureMessage,
    signedPlaybackId,
    maxResolutionTier,
    resolutionTier,
  };
}


// Read-only provider inspection result. Returned by inspectMuxMediaAssetState;
// carries the live Mux truth for a single media asset without any Supabase
// mutation. The local mapped status is exposed alongside the raw Mux statuses
// and the live signed playback reference so callers can detect drift between
// what Supabase stores and what Mux actually reports.
export type MuxMediaAssetInspectionResult =
  | {
      mediaAssetId: string;
      status: "not_found";
    }
  | {
      mediaAssetId: string;
      status: "inspected";
      providerAssetReference: string | null;
      providerPlaybackReference: string | null;
      providerUploadReference: string | null;
      muxAssetStatus: string | null;
      muxUploadStatus: string | null;
      mediaStatus: Database["public"]["Tables"]["media_assets"]["Row"]["status"];
      muxAssetExists: boolean;
      muxUploadExists: boolean;
      signedPlaybackId: string | null;
      failureCode: string | null;
      failureMessage: string | null;
      maxResolutionTier: string | null;
      resolutionTier: string | null;
    };

// Read-only counterpart of reconcileMuxMediaAssetState. Inspects the live Mux
// state for the media asset but NEVER writes to Supabase. Use this for CMS
// diagnostics, inventory, and truth-model building. A Mux 404 on a referenced
// asset surfaces as muxAssetExists: false (and muxUploadExists on the upload),
// which the truth model maps to the MISSING classification — without mutating
// the stored row.
export async function inspectMuxMediaAssetState(
  mediaAssetId: string,
  supabaseClient?: SupabaseClient<Database>,
): Promise<MuxMediaAssetInspectionResult> {
  const supabase = await getSupabase(supabaseClient);
  const normalizedMediaAssetId = mediaAssetId.trim();

  const { data: mediaAsset, error: mediaAssetError } = await supabase
    .from("media_assets")
    .select("*")
    .eq("id", normalizedMediaAssetId)
    .maybeSingle();

  if (mediaAssetError || !mediaAsset) {
    return {
      mediaAssetId: normalizedMediaAssetId,
      status: "not_found",
    };
  }

  const core = await readMuxMediaAssetState(mediaAsset);

  return {
    mediaAssetId: normalizedMediaAssetId,
    status: "inspected",
    providerAssetReference: core.providerAssetReference,
    providerPlaybackReference: core.providerPlaybackReference,
    providerUploadReference: core.providerUploadReference,
    muxAssetStatus: core.muxAssetStatus,
    muxUploadStatus: core.muxUploadStatus,
    mediaStatus: core.mediaStatus,
    muxAssetExists: core.muxAssetExists,
    muxUploadExists: core.muxUploadExists,
    signedPlaybackId: core.signedPlaybackId,
    failureCode: core.failureCode,
    failureMessage: core.failureMessage,
    maxResolutionTier: core.maxResolutionTier,
    resolutionTier: core.resolutionTier,
  };
}

export async function reconcileMuxMediaAssetState(
  mediaAssetId: string,
  supabaseClient?: SupabaseClient<Database>,
): Promise<MuxMediaAssetReconciliationResult> {
  const supabase = await getSupabase(supabaseClient);
  const normalizedMediaAssetId = mediaAssetId.trim();

  const { data: mediaAsset, error: mediaAssetError } = await supabase
    .from("media_assets")
    .select("*")
    .eq("id", normalizedMediaAssetId)
    .maybeSingle();

  if (mediaAssetError || !mediaAsset) {
    return {
      mediaAssetId: normalizedMediaAssetId,
      status: "not_found",
    };
  }

  // Reuse the read-only shared core so inspection and reconciliation stay in
  // sync. This function is the only one that writes the result back.
  const core = await readMuxMediaAssetState(mediaAsset);

  const updatePayload: Database["public"]["Tables"]["media_assets"]["Update"] = {
    provider_name: "mux",
    status: core.mediaStatus,
    provider_upload_reference: core.providerUploadReference,
    provider_asset_reference: core.providerAssetReference,
    provider_playback_reference: core.providerPlaybackReference,
    failure_code: core.failureCode,
    failure_message: core.failureMessage,
  };

  const { error: updateError } = await supabase
    .from("media_assets")
    .update(updatePayload)
    .eq("id", normalizedMediaAssetId);

  if (updateError) {
    throw new Error("Unable to reconcile the Mux media asset state.");
  }

  return {
    mediaAssetId: normalizedMediaAssetId,
    maxResolutionTier: core.maxResolutionTier,
    muxAssetStatus: core.muxAssetStatus,
    muxUploadStatus: core.muxUploadStatus,
    providerAssetReference: core.providerAssetReference,
    providerPlaybackReference: core.providerPlaybackReference,
    providerUploadReference: core.providerUploadReference,
    resolutionTier: core.resolutionTier,
    status: "updated",
    mediaStatus: core.mediaStatus,
  };
}

type DevRehydrationTargetDefinition =
  | {
      durationToleranceSeconds: number;
      episodeNumber: 1;
      expectedDurationSeconds: number;
      label: "Aadha Takiya Episode 1";
      kind: "SERIES_EPISODE";
      seriesSlug: "aadha-takiya";
    }
  | {
      durationToleranceSeconds: number;
      expectedDurationSeconds: number;
      label: "Trial & Error Short Film";
      kind: "SHORT_FILM";
      slug: "mute-button";
    };

type DevRehydrationTargetLookup =
  | {
      episodeNumber: 1;
      id: string;
      mediaAssetId: string | null;
      kind: "SERIES_EPISODE";
      seriesSlug: "aadha-takiya";
    }
  | {
      id: string;
      kind: "SHORT_FILM";
      mediaAssetId: string | null;
      playbackReference: string | null;
      slug: "mute-button";
    };

type DevRehydrationCandidate = {
  asset: {
    duration?: number | null;
    id: string;
    playback_ids: MuxPlaybackId[] | null;
    status?: string | null;
  };
  durationDelta: number;
  playbackReference: string;
  upload: MuxUploadListRecord | null;
  hasUploadEvidence: boolean;
};

const DEV_REHYDRATION_TARGETS: DevRehydrationTargetDefinition[] = [
  {
    durationToleranceSeconds: 2,
    episodeNumber: 1,
    expectedDurationSeconds: 74.2,
    kind: "SERIES_EPISODE",
    label: "Aadha Takiya Episode 1",
    seriesSlug: "aadha-takiya",
  },
  {
    durationToleranceSeconds: 15,
    expectedDurationSeconds: 1893,
    kind: "SHORT_FILM",
    label: "Trial & Error Short Film",
    slug: "mute-button",
  },
];

async function loadDevRehydrationTarget(
  supabase: SupabaseClient<Database>,
  target: DevRehydrationTargetDefinition,
): Promise<DevRehydrationTargetLookup | null> {
  if (target.kind === "SERIES_EPISODE") {
    const { data: series, error: seriesError } = await supabase
      .from("series")
      .select("id")
      .eq("slug", target.seriesSlug)
      .eq("status", "published")
      .maybeSingle();

    if (seriesError || !series) {
      return null;
    }

    const { data: episode, error: episodeError } = await supabase
      .from("episodes")
      .select("id,media_asset_id")
      .eq("series_id", series.id)
      .eq("episode_number", target.episodeNumber)
      .eq("status", "published")
      .maybeSingle();

    if (episodeError || !episode) {
      return null;
    }

    return {
      episodeNumber: target.episodeNumber,
      id: episode.id,
      kind: "SERIES_EPISODE",
      mediaAssetId: episode.media_asset_id,
      seriesSlug: target.seriesSlug,
    };
  }

  const { data: shortFilm, error } = await supabase
    .from("short_films")
    .select("id,media_asset_id,playback_reference")
    .eq("slug", target.slug)
    .maybeSingle();

  if (error || !shortFilm) {
    return null;
  }

  return {
    id: shortFilm.id,
    kind: "SHORT_FILM",
    mediaAssetId: shortFilm.media_asset_id,
    playbackReference: shortFilm.playback_reference,
    slug: target.slug,
  };
}

function selectDevRehydrationCandidate(
  target: DevRehydrationTargetDefinition,
  assets: MuxAssetListRecord[],
  uploads: MuxUploadListRecord[],
): DevRehydrationCandidate | { status: "ambiguous" | "missing"; reason: string } {
  const uploadsByAssetId = new Map<string, MuxUploadListRecord>();

  for (const upload of uploads) {
    const assetId = upload.asset_id?.trim();
    const passthrough = upload.passthrough?.trim();

    if (!assetId || !passthrough) {
      continue;
    }

    uploadsByAssetId.set(assetId, upload);
  }

  const readyAssetSummaries = assets
    .map((asset) => {
      const assetId = asset.id?.trim();
      const playbackReference = getSignedPlaybackId(asset.playback_ids ?? null);
      const duration = typeof asset.duration === "number" ? asset.duration : null;
      const upload = assetId ? uploadsByAssetId.get(assetId) ?? null : null;

      if (!assetId || !playbackReference || duration === null) {
        return null;
      }

      return {
        assetId,
        duration,
        hasUploadEvidence: Boolean(upload),
      };
    })
    .filter((entry): entry is { assetId: string; duration: number; hasUploadEvidence: boolean } => entry !== null)
    .sort((left, right) => left.duration - right.duration);

  const candidates: DevRehydrationCandidate[] = assets
    .map((asset) => {
      const assetId = asset.id?.trim();
      const playbackReference = getSignedPlaybackId(asset.playback_ids ?? null);
      const duration = typeof asset.duration === "number" ? asset.duration : null;
      const upload = assetId ? uploadsByAssetId.get(assetId) ?? null : null;

      if (!assetId || !playbackReference || duration === null) {
        return null;
      }

      const durationDelta = Math.abs(duration - target.expectedDurationSeconds);

      return {
        asset: {
          ...asset,
          id: assetId,
          playback_ids: asset.playback_ids ?? null,
        },
        durationDelta,
        playbackReference,
        hasUploadEvidence: Boolean(upload),
        upload,
      } satisfies DevRehydrationCandidate;
    })
    .filter((candidate): candidate is DevRehydrationCandidate => candidate !== null)
    .filter((candidate) => candidate.durationDelta <= target.durationToleranceSeconds)
    .sort((left, right) => {
      if (left.hasUploadEvidence !== right.hasUploadEvidence) {
        return left.hasUploadEvidence ? -1 : 1;
      }

      return left.durationDelta - right.durationDelta;
    });

  if (candidates.length === 0) {
    return {
      reason: `No READY Mux asset matched the expected development duration profile. READY assets: ${readyAssetSummaries
        .map((asset) => `${asset.assetId}:${asset.duration.toFixed(1)}s${asset.hasUploadEvidence ? "+upload" : ""}`)
        .join(", ") || "none"}.`,
      status: "missing",
    };
  }

  const best = candidates[0];

  if (!best) {
    return {
      reason: "No READY Mux asset matched the expected development duration profile.",
      status: "missing",
    };
  }

  if (candidates.length > 1 && candidates[1].durationDelta === best.durationDelta) {
    return {
      reason: `Multiple READY Mux assets matched the same duration profile. READY assets: ${readyAssetSummaries
        .map((asset) => `${asset.assetId}:${asset.duration.toFixed(1)}s${asset.hasUploadEvidence ? "+upload" : ""}`)
        .join(", ")}.`,
      status: "ambiguous",
    };
  }

  return best;
}

async function ensureDevRehydrationMediaAsset(
  supabase: SupabaseClient<Database>,
  candidate: DevRehydrationCandidate,
): Promise<{ mediaAssetId: string; status: "created" | "reused" | "repaired" }> {
  const providerAssetReference = candidate.asset.id?.trim() ?? null;
  const providerPlaybackReference = candidate.playbackReference.trim();
  const providerUploadReference = candidate.upload?.id?.trim() ?? null;

  if (!providerAssetReference) {
    throw new Error("Mux asset identifier is required.");
  }

  let existingMediaAsset:
    | {
        id: string;
        provider_asset_reference: string | null;
        provider_name: string | null;
        provider_playback_reference: string | null;
        provider_upload_reference: string | null;
        status: Database["public"]["Tables"]["media_assets"]["Row"]["status"];
      }
    | null = null;

  const references: Array<
    | ["provider_asset_reference", string]
    | ["provider_playback_reference", string]
    | ["provider_upload_reference", string]
  > = [];

  if (providerAssetReference) {
    references.push(["provider_asset_reference", providerAssetReference]);
  }

  if (providerPlaybackReference) {
    references.push(["provider_playback_reference", providerPlaybackReference]);
  }

  if (providerUploadReference) {
    references.push(["provider_upload_reference", providerUploadReference]);
  }

  for (const [column, value] of references) {
    const { data, error } = await supabase
      .from("media_assets")
      .select("id,provider_asset_reference,provider_name,provider_playback_reference,provider_upload_reference,status")
      .eq(column, value)
      .maybeSingle();

    if (error) {
      throw new Error("Unable to inspect existing media asset rows.");
    }

    if (data) {
      existingMediaAsset = data;
      break;
    }
  }

  const desiredProviderName = "mux";
  const desiredPayload: Database["public"]["Tables"]["media_assets"]["Update"] = {
    provider_asset_reference: providerAssetReference,
    provider_name: desiredProviderName,
    provider_playback_reference: providerPlaybackReference,
    provider_upload_reference: providerUploadReference,
    status: "ready",
  };

  if (existingMediaAsset) {
    const { error: updateError } = await supabase
      .from("media_assets")
      .update(desiredPayload)
      .eq("id", existingMediaAsset.id);

    if (updateError) {
      throw new Error("Unable to repair the existing media asset row.");
    }

    const reconciliation = await reconcileMuxMediaAssetState(existingMediaAsset.id, supabase);

    if (reconciliation.status === "not_found") {
      throw new Error("Mux asset could not be reconciled after repair.");
    }

    return {
      mediaAssetId: existingMediaAsset.id,
      status: existingMediaAsset.status === "ready" ? "reused" : "repaired",
    };
  }

  const { data: createdMediaAsset, error: createError } = await supabase
    .from("media_assets")
    .insert(desiredPayload)
    .select("id")
    .single();

  if (createError || !createdMediaAsset) {
    throw new Error("Unable to create the media asset row for rehydration.");
  }

  const reconciliation = await reconcileMuxMediaAssetState(createdMediaAsset.id, supabase);

  if (reconciliation.status === "not_found") {
    throw new Error("Mux asset could not be reconciled after creation.");
  }

  return {
    mediaAssetId: createdMediaAsset.id,
    status: "created",
  };
}

function buildDevRehydrationResult(input: {
  targetResults: DevMediaRehydrationTargetResult[];
}): DevMediaRehydrationResult {
  const status = input.targetResults.every((target) => target.status === "UNCHANGED" || target.status === "REHYDRATED")
    ? "done"
    : "blocked";

  return {
    filesChanged: [
      "supabase/config.toml",
      "supabase/009_short_films.sql",
      "src/lib/mux/index.ts",
      "src/app/api/dev/mux/local-operator/route.ts",
      "scripts/mux-local-operator.mjs",
      "package.json",
      "docs/android-client-bootstrap.md",
    ],
    nextAction: status === "done" ? "None." : "Resolve the ambiguous or missing Mux asset match and run the command again.",
    providerMatchingStrategy: "READY asset + duration guard with upload linkage when present",
    securityCheck: "server-only; no raw secrets logged; no new uploads created; development-only",
    status,
    targets: input.targetResults,
  };
}

export async function rehydrateDevelopmentMuxMediaAssets(
  supabaseClient?: SupabaseClient<Database>,
): Promise<DevMediaRehydrationResult> {
  const supabase = await getSupabase(supabaseClient);
  const assets = await fetchMuxCollection<MuxAssetListRecord>("/video/v1/assets?limit=100");
  const uploads = await fetchMuxCollection<MuxUploadListRecord>("/video/v1/uploads?limit=100");
  const targetResults: DevMediaRehydrationTargetResult[] = [];

  for (const target of DEV_REHYDRATION_TARGETS) {
    const localTarget = await loadDevRehydrationTarget(supabase, target);

    if (!localTarget) {
      targetResults.push({
        label: target.label,
        mediaAssetId: null,
        providerAssetReference: null,
        providerPlaybackReference: null,
        playbackAuthorizationStatus: null,
        reason: "Canonical local content row was not found.",
        status: "NOT_FOUND",
      });
      continue;
    }

    const selectedCandidate = selectDevRehydrationCandidate(target, assets, uploads);

    if ("status" in selectedCandidate) {
      targetResults.push({
        label: target.label,
        mediaAssetId: localTarget.mediaAssetId,
        providerAssetReference: null,
        providerPlaybackReference: null,
        playbackAuthorizationStatus: null,
        reason: selectedCandidate.reason,
        status: selectedCandidate.status === "missing" ? "MISSING" : "AMBIGUOUS",
      });
      continue;
    }

    const ensuredMediaAsset = await ensureDevRehydrationMediaAsset(supabase, selectedCandidate);
    const playbackReference = selectedCandidate.playbackReference;

    if (localTarget.kind === "SERIES_EPISODE") {
      if (localTarget.mediaAssetId === ensuredMediaAsset.mediaAssetId) {
        targetResults.push({
          label: target.label,
          mediaAssetId: ensuredMediaAsset.mediaAssetId,
          providerAssetReference: selectedCandidate.asset.id?.trim() ?? null,
          providerPlaybackReference: playbackReference,
          playbackAuthorizationStatus: null,
          reason: null,
          status: "UNCHANGED",
        });
        continue;
      }

      const { error: updateEpisodeError } = await supabase
        .from("episodes")
        .update({ media_asset_id: ensuredMediaAsset.mediaAssetId })
        .eq("id", localTarget.id);

      if (updateEpisodeError) {
        throw new Error("Unable to attach the rehydrated media asset to the episode.");
      }

      targetResults.push({
        label: target.label,
        mediaAssetId: ensuredMediaAsset.mediaAssetId,
        providerAssetReference: selectedCandidate.asset.id?.trim() ?? null,
        providerPlaybackReference: playbackReference,
        playbackAuthorizationStatus: null,
        reason: ensuredMediaAsset.status === "created" ? "Created and attached a new local media asset row." : "Attached the proven READY Mux asset.",
        status: "REHYDRATED",
      });
      continue;
    }

    if (localTarget.mediaAssetId === ensuredMediaAsset.mediaAssetId && localTarget.playbackReference === playbackReference) {
      targetResults.push({
        label: target.label,
        mediaAssetId: ensuredMediaAsset.mediaAssetId,
        providerAssetReference: selectedCandidate.asset.id?.trim() ?? null,
        providerPlaybackReference: playbackReference,
        playbackAuthorizationStatus: null,
        reason: null,
        status: "UNCHANGED",
      });
      continue;
    }

    const { error: updateShortFilmError } = await supabase
      .from("short_films")
      .update({
        media_asset_id: ensuredMediaAsset.mediaAssetId,
        playback_reference: playbackReference,
      })
      .eq("id", localTarget.id);

    if (updateShortFilmError) {
      throw new Error("Unable to attach the rehydrated media asset to the short film.");
    }

    targetResults.push({
      label: target.label,
      mediaAssetId: ensuredMediaAsset.mediaAssetId,
      providerAssetReference: selectedCandidate.asset.id?.trim() ?? null,
      providerPlaybackReference: playbackReference,
      playbackAuthorizationStatus: null,
      reason: ensuredMediaAsset.status === "created" ? "Created and attached a new local media asset row." : "Attached the proven READY Mux asset.",
      status: "REHYDRATED",
    });
  }

  return buildDevRehydrationResult({ targetResults });
}

function uploadErrorsFromStatus(status: string | null | undefined) {
  if (!status) {
    return null;
  }

  return [
    {
      message: `Mux upload returned ${status}.`,
      type: "mux_upload_error",
    },
  ];
}

// Mux playback modifier claim. Must be part of the signed JWT payload itself
// (never appended unsigned outside the token) so the resolution ceiling is
// tamper-proof for signed playback IDs.
export type MuxMaxResolution = "720p" | "1440p";

export function createMuxSignedPlaybackUrl(
  playbackId: string,
  durationSeconds: number,
  maxResolution: MuxMaxResolution,
  now = Date.now(),
): MuxSignedPlaybackResult {
  const normalizedPlaybackId = playbackId.trim();

  if (!normalizedPlaybackId) {
    throw new Error("Playback ID is required.");
  }

  const { keyId } = getMuxPlaybackSigningCredentials();
  const safeDurationSeconds = Math.max(0, Math.floor(durationSeconds));
  const expiresAt = new Date(
    now + (safeDurationSeconds + MUX_PLAYBACK_BUFFER_SECONDS) * 1000,
  ).toISOString();
  const exp = Math.floor(Date.parse(expiresAt) / 1000);
  const token = signJwt(
    {
      alg: "RS256",
      kid: keyId,
      typ: "JWT",
    },
    {
      aud: "v",
      exp,
      max_resolution: maxResolution,
      sub: normalizedPlaybackId,
    },
  );

  return {
    playbackUrl: `https://stream.mux.com/${normalizedPlaybackId}.m3u8?token=${token}`,
    expiresAt,
  };
}

export function createMuxSignedPreviewPlaybackUrl(
  playbackId: string,
  previewSeconds: number,
  maxResolution: MuxMaxResolution,
  now = Date.now(),
): MuxSignedPlaybackResult {
  const normalizedPlaybackId = playbackId.trim();
  const safePreviewSeconds = Math.floor(previewSeconds);

  if (!normalizedPlaybackId) {
    throw new Error("Playback ID is required.");
  }

  if (!Number.isFinite(previewSeconds) || safePreviewSeconds <= 0) {
    throw new Error("Preview duration must be a positive number of seconds.");
  }

  const { keyId } = getMuxPlaybackSigningCredentials();
  const expiresAt = new Date(now + MUX_PREVIEW_TOKEN_TTL_SECONDS * 1000).toISOString();
  const exp = Math.floor(Date.parse(expiresAt) / 1000);
  const token = signJwt(
    {
      alg: "RS256",
      kid: keyId,
      typ: "JWT",
    },
    {
      asset_end_time: safePreviewSeconds,
      asset_start_time: 0,
      aud: "v",
      exp,
      max_resolution: maxResolution,
      sub: normalizedPlaybackId,
    },
  );

  return {
    playbackUrl: `https://stream.mux.com/${normalizedPlaybackId}.m3u8?token=${token}`,
    expiresAt,
  };
}

export function createMuxSignedThumbnailUrl(
  playbackId: string,
  options: {
    height: number;
    timeSeconds: number;
    width: number;
  },
  now = Date.now(),
): MuxSignedThumbnailResult {
  const normalizedPlaybackId = playbackId.trim();

  if (!normalizedPlaybackId) {
    throw new Error("Playback ID is required.");
  }

  const { keyId } = getMuxPlaybackSigningCredentials();
  const safeTimeSeconds = Math.max(0, options.timeSeconds);
  const safeWidth = Math.max(1, Math.floor(options.width));
  const safeHeight = Math.max(1, Math.floor(options.height));
  const expiresAt = new Date(now + MUX_PLAYBACK_BUFFER_SECONDS * 1000).toISOString();
  const exp = Math.floor(Date.parse(expiresAt) / 1000);
  const token = signJwt(
    {
      alg: "RS256",
      kid: keyId,
      typ: "JWT",
    },
    {
      aud: "t",
      exp,
      fit_mode: "smartcrop",
      height: safeHeight,
      sub: normalizedPlaybackId,
      time: safeTimeSeconds,
      width: safeWidth,
    },
  );

  return {
    expiresAt,
    thumbnailUrl: `https://image.mux.com/${normalizedPlaybackId}/thumbnail.jpg?token=${token}`,
  };
}

export async function createMuxSubtitleTextTrack(
  input: MuxSubtitleTextTrackInput,
): Promise<MuxSubtitleTextTrackResult> {
  const assetId = input.assetId.trim();
  const sourceUrl = input.sourceUrl.trim();
  const languageCode = input.languageCode.trim();
  const name = input.name.trim();

  if (!assetId) {
    throw new Error("Asset ID is required.");
  }

  if (!sourceUrl) {
    throw new Error("Subtitle source URL is required.");
  }

  if (!languageCode) {
    throw new Error("Subtitle language code is required.");
  }

  if (!name) {
    throw new Error("Subtitle track name is required.");
  }

  const response = await fetch(`https://api.mux.com/video/v1/assets/${assetId}/tracks`, {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      closed_captions: Boolean(input.closedCaptions),
      language_code: languageCode,
      name,
      text_type: "subtitles",
      type: "text",
      url: sourceUrl,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mux subtitle track creation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: {
      id?: string;
      status?: MuxSubtitleTextTrackResult["status"];
    };
  };

  const trackId = payload.data?.id?.trim();
  const status = payload.data?.status;

  if (!trackId || !status) {
    throw new Error("Mux subtitle track response was missing track details.");
  }

  return {
    assetId,
    closedCaptions: Boolean(input.closedCaptions),
    languageCode,
    name,
    status,
    trackId,
  };
}
