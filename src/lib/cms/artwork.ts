import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ARTWORK_BUCKET_ID,
  deleteArtworkObject,
} from "@/lib/supabase/artwork";
import type { Database } from "@/types/database";

type SeriesArtworkRow = Pick<Database["public"]["Tables"]["series"]["Row"], "poster_url" | "hero_image_url">;
type EpisodeArtworkRow = Pick<Database["public"]["Tables"]["episodes"]["Row"], "thumbnail_url">;
type ShortFilmArtworkRow = Pick<Database["public"]["Tables"]["short_films"]["Row"], "poster_url" | "hero_image_url">;

function getAdminClient() {
  return createAdminClient();
}

function extractArtworkObjectPath(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const bucketPrefix = `/storage/v1/object/public/${ARTWORK_BUCKET_ID}/`;

  try {
    const url = new URL(trimmed);
    const index = url.pathname.indexOf(bucketPrefix);
    if (index >= 0) {
      return url.pathname.slice(index + bucketPrefix.length);
    }
  } catch {
    if (trimmed.startsWith(`${ARTWORK_BUCKET_ID}/`)) {
      return trimmed.slice(`${ARTWORK_BUCKET_ID}/`.length);
    }

    if (trimmed.startsWith(bucketPrefix)) {
      return trimmed.slice(bucketPrefix.length);
    }
  }

  return null;
}

async function loadReferencedArtworkObjectPaths() {
  const supabase = getAdminClient();

  const [seriesResult, shortFilmResult, episodeResult] = await Promise.all([
    supabase.from("series").select("poster_url,hero_image_url"),
    supabase.from("short_films").select("poster_url,hero_image_url"),
    supabase.from("episodes").select("thumbnail_url"),
  ]);

  if (seriesResult.error || shortFilmResult.error || episodeResult.error) {
    return { error: true as const, paths: new Set<string>() };
  }

  const paths = new Set<string>();

  for (const row of (seriesResult.data ?? []) as SeriesArtworkRow[]) {
    const posterPath = extractArtworkObjectPath(row.poster_url);
    const heroPath = extractArtworkObjectPath(row.hero_image_url);
    if (posterPath) {
      paths.add(posterPath);
    }
    if (heroPath) {
      paths.add(heroPath);
    }
  }

  for (const row of (shortFilmResult.data ?? []) as ShortFilmArtworkRow[]) {
    const posterPath = extractArtworkObjectPath(row.poster_url);
    const heroPath = extractArtworkObjectPath(row.hero_image_url);
    if (posterPath) {
      paths.add(posterPath);
    }
    if (heroPath) {
      paths.add(heroPath);
    }
  }

  for (const row of (episodeResult.data ?? []) as EpisodeArtworkRow[]) {
    const thumbnailPath = extractArtworkObjectPath(row.thumbnail_url);
    if (thumbnailPath) {
      paths.add(thumbnailPath);
    }
  }

  return { error: false as const, paths };
}

export async function cleanupArtworkObjectsAfterContentDeletion(
  artworkUrls: Array<string | null | undefined>,
) {
  const warnings: string[] = [];
  const objectPaths = Array.from(
    new Set(
      artworkUrls
        .map((url) => extractArtworkObjectPath(url))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (objectPaths.length === 0) {
    return warnings;
  }

  const referenceState = await loadReferencedArtworkObjectPaths();
  if (referenceState.error) {
    for (const objectPath of objectPaths) {
      warnings.push(`Unable to verify artwork cleanup for ${objectPath}; it was preserved for retry.`);
    }

    return warnings;
  }

  for (const objectPath of objectPaths) {
    if (referenceState.paths.has(objectPath)) {
      continue;
    }

    try {
      await deleteArtworkObject(objectPath);
    } catch {
      warnings.push(`Artwork cleanup failed for ${objectPath}; it was preserved for retry.`);
    }
  }

  return warnings;
}

export { extractArtworkObjectPath };
