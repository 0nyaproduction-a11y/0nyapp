import "server-only";

import {
  normalizeContentDescriptors,
  normalizeContentRating,
  type ContentDescriptor,
  type ContentRating,
} from "@/lib/classification";
import { cleanupArtworkObjectsAfterContentDeletion, extractArtworkObjectPath } from "@/lib/cms/artwork";
import { cleanupMediaAssetsAfterContentDeletion } from "@/lib/cms/media";
import { createAdminClient } from "@/lib/supabase/admin";
import { ARTWORK_BUCKET_ID } from "@/lib/supabase/artwork";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export type ShortFilmRow = Database["public"]["Tables"]["short_films"]["Row"];
export type ShortFilmStatus = ShortFilmRow["status"];

export type ShortFilmInput = {
  title: string;
  slug: string;
  synopsis: string | null;
  posterUrl: string | null;
  heroImageUrl: string | null;
  creatorReference: string | null;
  durationSeconds: number;
  language: string | null;
  contentRating: ContentRating | null;
  contentDescriptors: ContentDescriptor[];
  status: ShortFilmStatus;
  publishAt: string | null;
  midrollEnabled: boolean;
  midrollTimecodes: number[];
  postrollEnabled: boolean;
  chaiEnabled: boolean;
}

export type ShortFilmValidationError = { field: string; message: string };

export type ShortFilmActionResult =
  | { success: true; shortFilm: ShortFilmRow }
  | { success: false; errors: ShortFilmValidationError[] };

export type ShortFilmDeletePreview = {
  blockers: string[];
  shortFilm: ShortFilmRow | null;
};

export type ShortFilmDeleteResult =
  | { success: true; shortFilmId: string; slug: string; cleanupWarnings: string[] }
  | { success: false; message: string; blockers?: string[] };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SHORT_FILM_STATUSES: ShortFilmStatus[] = ["draft", "published", "archived"];

function getAdminClient() {
  return createAdminClient();
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

function isValidDateTime(value: string) {
  return !Number.isNaN(Date.parse(value));
}

async function artworkObjectExists(objectPath: string, supabase: ReturnType<typeof getAdminClient>) {
  const normalizedObjectPath = objectPath.trim().replace(/^\/+/, "");
  const pathParts = normalizedObjectPath.split("/").filter(Boolean);
  const fileName = pathParts.at(-1);

  if (!fileName) {
    return false;
  }

  const folderPath = pathParts.slice(0, -1).join("/");
  const { data, error } = await supabase.storage.from(ARTWORK_BUCKET_ID).list(folderPath, {
    limit: 100,
    search: fileName,
  });

  if (error || !data) {
    return false;
  }

  return data.some((object) => object.name === fileName);
}

function extractTrustedArtworkObjectPath(value: string) {
  const objectPath = extractArtworkObjectPath(value);

  if (!objectPath) {
    return null;
  }

  try {
    const artworkUrl = new URL(value.trim());
    const expectedOrigin = new URL(getSupabaseEnv().url).origin;

    if (artworkUrl.origin !== expectedOrigin) {
      return null;
    }
  } catch {
    // Existing server-side artwork helpers also accept stored bucket/path values.
  }

  return objectPath;
}

export function validateShortFilmInput(input: ShortFilmInput): ShortFilmValidationError[] {
  const errors: ShortFilmValidationError[] = [];

  if (!input.title.trim()) {
    errors.push({ field: "title", message: "Title is required." });
  }

  if (!SLUG_PATTERN.test(input.slug)) {
    errors.push({
      field: "slug",
      message: "Slug must be lowercase letters, numbers, and hyphens only (e.g. my-short-film).",
    });
  }

  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 0) {
    errors.push({ field: "durationSeconds", message: "Runtime must be zero or a positive whole number." });
  }

  if (!SHORT_FILM_STATUSES.includes(input.status)) {
    errors.push({ field: "status", message: "Unsupported status." });
  }

  if (input.publishAt && !isValidDateTime(input.publishAt)) {
    errors.push({ field: "publishAt", message: "Publish time must be a valid date and time." });
  }

  if (input.contentRating && !normalizeContentRating(input.contentRating)) {
    errors.push({ field: "contentRating", message: "Unsupported content rating." });
  }

  for (const descriptor of input.contentDescriptors) {
    if (!normalizeContentDescriptors([descriptor]).includes(descriptor)) {
      errors.push({ field: "contentDescriptors", message: `Unsupported content descriptor: ${descriptor}.` });
      break;
    }
  }

  for (const timecode of input.midrollTimecodes) {
    if (!Number.isInteger(timecode) || timecode < 0) {
      errors.push({ field: "midrollTimecodes", message: "Mid-roll timecodes must be zero or positive whole numbers." });
      break;
    }
  }

  // Mirrors the DB CHECK (009): midroll_enabled requires at least one timecode.
  if (input.midrollEnabled && input.midrollTimecodes.length === 0) {
    errors.push({
      field: "midrollTimecodes",
      message: "Mid-roll timecodes are required when mid-roll is enabled.",
    });
  }

  if (input.midrollEnabled) {
    // Each insertion point must fall strictly inside the runtime: a mid-roll ad
    // at t=0 or at/after the end has nothing to precede/follow. The per-timecode
    // integer check above stays lenient when mid-roll is disabled (vestigial).
    for (const timecode of input.midrollTimecodes) {
      if (timecode <= 0 || timecode >= input.durationSeconds) {
        errors.push({
          field: "midrollTimecodes",
          message: "Mid-roll timecodes must fall within the short film runtime.",
        });
        break;
      }
    }

    const uniqueTimecodes = new Set(input.midrollTimecodes);
    if (uniqueTimecodes.size !== input.midrollTimecodes.length) {
      errors.push({
        field: "midrollTimecodes",
        message: "Mid-roll timecodes must be unique.",
      });
    }
  }

  if (input.status === "published") {
    if (!input.posterUrl || !input.posterUrl.trim()) {
      errors.push({ field: "posterUrl", message: "Poster artwork is required to publish." });
    }
  }

  return errors;
}

export async function listShortFilmsForAdmin(): Promise<ShortFilmRow[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("short_films")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function getShortFilmForAdminById(id: string): Promise<ShortFilmRow | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("short_films").select("*").eq("id", id).maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function createShortFilm(input: ShortFilmInput): Promise<ShortFilmActionResult> {
  const errors = validateShortFilmInput(input);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("short_films")
    .insert({
      slug: input.slug,
      title: input.title.trim(),
      synopsis: input.synopsis,
      poster_url: input.posterUrl,
      hero_image_url: input.heroImageUrl,
      creator_reference: input.creatorReference,
      duration_seconds: input.durationSeconds,
      language: input.language,
      content_rating: input.contentRating,
      content_descriptors: input.contentDescriptors,
      status: input.status,
      publish_at: input.publishAt,
      midroll_enabled: input.midrollEnabled,
      midroll_timecodes: input.midrollTimecodes,
      postroll_enabled: input.postrollEnabled,
      chai_enabled: input.chaiEnabled,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { success: false, errors: [{ field: "slug", message: "That slug is already in use." }] };
    }

    return { success: false, errors: [{ field: "form", message: "Unable to create short film." }] };
  }

  return { success: true, shortFilm: data };
}

export async function updateShortFilm(id: string, input: ShortFilmInput): Promise<ShortFilmActionResult> {
  const errors = validateShortFilmInput(input);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("short_films")
    .update({
      slug: input.slug,
      title: input.title.trim(),
      synopsis: input.synopsis,
      poster_url: input.posterUrl,
      hero_image_url: input.heroImageUrl,
      creator_reference: input.creatorReference,
      duration_seconds: input.durationSeconds,
      language: input.language,
      content_rating: input.contentRating,
      content_descriptors: input.contentDescriptors,
      status: input.status,
      publish_at: input.publishAt,
      midroll_enabled: input.midrollEnabled,
      midroll_timecodes: input.midrollTimecodes,
      postroll_enabled: input.postrollEnabled,
      chai_enabled: input.chaiEnabled,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { success: false, errors: [{ field: "slug", message: "That slug is already in use." }] };
    }

    return { success: false, errors: [{ field: "form", message: "Unable to update short film." }] };
  }

  return { success: true, shortFilm: data };
}

export async function verifyShortFilmPublishIntegrity(
  row: Pick<ShortFilmRow, "poster_url" | "media_asset_id">,
  supabase = getAdminClient(),
): Promise<ShortFilmValidationError[]> {
  const errors: ShortFilmValidationError[] = [];

  if (!row.poster_url || !row.poster_url.trim()) {
    errors.push({ field: "posterUrl", message: "Poster artwork is required to publish." });
  } else {
    const posterObjectPath = extractTrustedArtworkObjectPath(row.poster_url);
    const hasPosterObject = posterObjectPath
      ? await artworkObjectExists(posterObjectPath, supabase)
      : false;

    if (!hasPosterObject) {
      errors.push({ field: "posterUrl", message: "Poster artwork file is missing or unavailable." });
    }
  }

  // Playback readiness is derived from the assigned media_asset, matching the
  // exact source resolveShortFilmPlayback() reads (media_assets.status and
  // .provider_playback_reference). short_films.playback_reference is a
  // legacy/dev-only column that the production assignment path
  // (assignShortFilmMediaAsset) never writes and playback never reads, so it
  // must not gate publish.
  if (!row.media_asset_id) {
    errors.push({ field: "mediaAsset", message: "A ready media asset must be assigned before publishing." });
  } else {
    const { data: mediaAsset } = await supabase
      .from("media_assets")
      .select("status,provider_playback_reference")
      .eq("id", row.media_asset_id)
      .maybeSingle();

    if (!mediaAsset) {
      errors.push({ field: "mediaAsset", message: "Assigned media asset was not found." });
    } else if (mediaAsset.status !== "ready") {
      errors.push({ field: "mediaAsset", message: "Playback media is not ready." });
    } else if (!mediaAsset.provider_playback_reference || !mediaAsset.provider_playback_reference.trim()) {
      errors.push({ field: "mediaAsset", message: "Playback media is missing a signed playback reference." });
    }
  }

  return errors;
}

export async function updateShortFilmStatus(
  id: string,
  status: ShortFilmStatus,
): Promise<ShortFilmActionResult> {
  if (!SHORT_FILM_STATUSES.includes(status)) {
    return { success: false, errors: [{ field: "status", message: "Unsupported status." }] };
  }

  const supabase = getAdminClient();
  const existing = await getShortFilmForAdminById(id);

  if (status === "published") {
    if (!existing) {
      return { success: false, errors: [{ field: "status", message: "Short film not found." }] };
    }

    const integrityErrors = await verifyShortFilmPublishIntegrity(existing, supabase);
    if (integrityErrors.length > 0) {
      return { success: false, errors: integrityErrors };
    }
  }

  const { data, error } = await supabase
    .from("short_films")
    .update({ status })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { success: false, errors: [{ field: "status", message: "Unable to update status." }] };
  }

  return { success: true, shortFilm: data };
}

export async function persistShortFilmArtwork(
  id: string,
  field: "poster_url" | "hero_image_url",
  publicUrl: string,
): Promise<ShortFilmActionResult> {
  const supabase = getAdminClient();
  const update = field === "poster_url" ? { poster_url: publicUrl } : { hero_image_url: publicUrl };
  const { data, error } = await supabase
    .from("short_films")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { success: false, errors: [{ field, message: "Unable to save artwork." }] };
  }

  return { success: true, shortFilm: data };
}

async function inspectShortFilmDeletion(id: string): Promise<ShortFilmDeletePreview> {
  const supabase = getAdminClient();
  const blockers: string[] = [];

  const [shortFilmResult, ledgerEntriesResult, tipRequestsResult, coinTransactionsResult] = await Promise.all([
    supabase.from("short_films").select("*").eq("id", id).maybeSingle(),
    supabase.from("chai_ledger_entries").select("id").eq("short_film_id", id).limit(1),
    supabase.from("chai_tip_requests").select("id").eq("short_film_id", id).limit(1),
    supabase.from("coin_transactions").select("id").eq("short_film_id", id).limit(1),
  ]);

  if (shortFilmResult.error || !shortFilmResult.data) {
    return { blockers: ["Short film not found."], shortFilm: null };
  }

  const shortFilm = shortFilmResult.data;

  if (shortFilm.status === "published") {
    blockers.push("Archive this short film before deleting it.");
  }

  if (ledgerEntriesResult.error || tipRequestsResult.error || coinTransactionsResult.error) {
    blockers.push("Unable to inspect short-film dependencies right now.");
    return { blockers, shortFilm };
  }

  if ((ledgerEntriesResult.data ?? []).length > 0) {
    blockers.push("Chai ledger history exists for this short film.");
  }

  if ((tipRequestsResult.data ?? []).length > 0) {
    blockers.push("Chai tip requests exist for this short film.");
  }

  if ((coinTransactionsResult.data ?? []).length > 0) {
    blockers.push("Coin transaction history exists for this short film.");
  }

  return { blockers, shortFilm };
}

export async function getShortFilmDeletePreview(id: string) {
  return inspectShortFilmDeletion(id);
}

export async function deleteShortFilm(id: string): Promise<ShortFilmDeleteResult> {
  const preview = await inspectShortFilmDeletion(id);

  if (!preview.shortFilm) {
    return { success: false, message: "Short film not found." };
  }

  if (preview.blockers.length > 0) {
    return {
      success: false,
      message: "Resolve the blockers before deleting this short film.",
      blockers: preview.blockers,
    };
  }

  const supabase = getAdminClient();
  const { error } = await supabase.from("short_films").delete().eq("id", id);

  if (error) {
    return { success: false, message: "Unable to delete short film." };
  }

  const shortFilm = preview.shortFilm;
  const cleanupArtworkWarnings = await cleanupArtworkObjectsAfterContentDeletion([
    shortFilm.poster_url,
    shortFilm.hero_image_url,
  ]);
  const cleanupWarnings = await cleanupMediaAssetsAfterContentDeletion([shortFilm.media_asset_id ?? ""]);

  return {
    success: true,
    shortFilmId: id,
    slug: shortFilm.slug,
    cleanupWarnings: [...cleanupArtworkWarnings, ...cleanupWarnings],
  };
}
