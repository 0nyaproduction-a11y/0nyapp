import { resolveMediaUrl } from "./media";

const PLACEHOLDER_ARTWORK = "/logo-og.jpg";

export function hasRenderableShortFilmArtwork(value?: string | null) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 && trimmed !== PLACEHOLDER_ARTWORK;
}

export function resolveShortFilmArtwork(heroImage?: string | null, poster?: string | null) {
  const candidate = hasRenderableShortFilmArtwork(heroImage)
    ? heroImage!.trim()
    : hasRenderableShortFilmArtwork(poster)
      ? poster!.trim()
      : undefined;

  return resolveMediaUrl(candidate) ?? undefined;
}
