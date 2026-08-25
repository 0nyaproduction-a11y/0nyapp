import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const ARTWORK_BUCKET_ID = "content-artwork" as const;

export const ARTWORK_KINDS = [
  "series-poster",
  "series-hero",
  "episode-thumbnail",
  "short-film-poster",
  "short-film-hero",
] as const;

export type ArtworkKind = (typeof ARTWORK_KINDS)[number];

export type ArtworkMimeType = "image/jpeg" | "image/png" | "image/webp";

const MIME_TYPE_TO_EXTENSION: Record<ArtworkMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const KIND_TO_PATH = {
  "series-poster": (targetId: string, fileName: string) =>
    `series/${targetId}/poster/${fileName}`,
  "series-hero": (targetId: string, fileName: string) =>
    `series/${targetId}/hero/${fileName}`,
  "episode-thumbnail": (targetId: string, fileName: string) =>
    `episodes/${targetId}/thumbnail/${fileName}`,
  "short-film-poster": (targetId: string, fileName: string) =>
    `short-films/${targetId}/poster/${fileName}`,
  "short-film-hero": (targetId: string, fileName: string) =>
    `short-films/${targetId}/hero/${fileName}`,
} satisfies Record<ArtworkKind, (targetId: string, fileName: string) => string>;

function assertArtworkKind(kind: string): ArtworkKind {
  if (!ARTWORK_KINDS.includes(kind as ArtworkKind)) {
    throw new Error(`Unsupported artwork kind: ${kind}`);
  }

  return kind as ArtworkKind;
}

function normalizeTargetId(targetId: string) {
  const trimmed = targetId.trim();

  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new Error("Invalid artwork target identifier.");
  }

  return trimmed;
}

function normalizeMimeType(mimeType: string): ArtworkMimeType {
  const normalized = mimeType.trim().toLowerCase().split(";", 1)[0];

  if (normalized === "image/jpeg" || normalized === "image/png" || normalized === "image/webp") {
    return normalized;
  }

  throw new Error(`Unsupported artwork MIME type: ${mimeType}`);
}

export function buildArtworkObjectPath(
  kind: string,
  targetId: string,
  mimeType: string,
) {
  const resolvedKind = assertArtworkKind(kind);
  const resolvedTargetId = normalizeTargetId(targetId);
  const resolvedMimeType = normalizeMimeType(mimeType);
  const fileName = `${randomUUID().replace(/-/g, "")}.${MIME_TYPE_TO_EXTENSION[resolvedMimeType]}`;

  return KIND_TO_PATH[resolvedKind](resolvedTargetId, fileName);
}

export function getArtworkPublicUrl(objectPath: string) {
  const supabase = createAdminClient();
  return supabase.storage.from(ARTWORK_BUCKET_ID).getPublicUrl(objectPath).data.publicUrl;
}

export async function createArtworkUploadIntent(params: {
  kind: string;
  mimeType: string;
  targetId: string;
}) {
  const objectPath = buildArtworkObjectPath(params.kind, params.targetId, params.mimeType);
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(ARTWORK_BUCKET_ID).createSignedUploadUrl(objectPath);

  if (error || !data) {
    throw new Error("Unable to create artwork upload intent.");
  }

  return {
    bucket: ARTWORK_BUCKET_ID,
    mimeType: normalizeMimeType(params.mimeType),
    objectPath,
    publicUrl: getArtworkPublicUrl(objectPath),
    signedUploadUrl: data.signedUrl,
    token: data.token,
  };
}

export async function deleteArtworkObject(objectPath: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(ARTWORK_BUCKET_ID).remove([objectPath]);

  if (error) {
    throw new Error("Unable to delete artwork object.");
  }
}
