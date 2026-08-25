import * as SecureStore from "expo-secure-store";
import type { SubtitleTrack } from "expo-video";

const SUBTITLE_PREFERENCE_KEY = "0nya.subtitle-preference";

export type SubtitlePreference = {
  enabled: boolean;
  preferredLanguageCode: string | null;
};

const DEFAULT_SUBTITLE_PREFERENCE: SubtitlePreference = {
  enabled: false,
  preferredLanguageCode: null,
};

function normalizeLanguageCode(languageCode: string) {
  return languageCode.trim().toLowerCase();
}

function getLanguageVariants(languageCode: string) {
  const normalized = normalizeLanguageCode(languageCode);
  const primary = normalized.split("-", 1)[0];

  return primary && primary !== normalized ? [normalized, primary] : [normalized];
}

export async function getSubtitlePreference(): Promise<SubtitlePreference> {
  const value = await SecureStore.getItemAsync(SUBTITLE_PREFERENCE_KEY);

  if (!value) {
    return DEFAULT_SUBTITLE_PREFERENCE;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SubtitlePreference>;

    return {
      enabled: Boolean(parsed.enabled),
      preferredLanguageCode:
        typeof parsed.preferredLanguageCode === "string" && parsed.preferredLanguageCode.trim()
          ? normalizeLanguageCode(parsed.preferredLanguageCode)
          : null,
    };
  } catch {
    console.warn("Unable to parse stored subtitle preference.");
    return DEFAULT_SUBTITLE_PREFERENCE;
  }
}

export async function setSubtitlePreference(preference: SubtitlePreference) {
  await SecureStore.setItemAsync(
    SUBTITLE_PREFERENCE_KEY,
    JSON.stringify({
      enabled: preference.enabled,
      preferredLanguageCode: preference.preferredLanguageCode
        ? normalizeLanguageCode(preference.preferredLanguageCode)
        : null,
    }),
  );
}

export function resolvePreferredSubtitleTrack(
  tracks: SubtitleTrack[],
  preference: SubtitlePreference,
) {
  if (!preference.enabled || tracks.length === 0) {
    return null;
  }

  const preferredLanguageCode = preference.preferredLanguageCode?.trim();

  if (preferredLanguageCode) {
    const preferredVariants = getLanguageVariants(preferredLanguageCode);
    const matchingTrack = tracks.find((track) =>
      preferredVariants.includes(normalizeLanguageCode(track.language)),
    );

    if (matchingTrack) {
      return matchingTrack;
    }
  }

  return tracks.find((track) => track.isDefault) ?? tracks[0] ?? null;
}

export function getSubtitleTrackLabel(track: SubtitleTrack) {
  return track.name?.trim() || track.label.trim() || track.language.trim();
}

export function getSubtitleTrackSelectionKey(track: SubtitleTrack) {
  return (
    track.id?.trim() ||
    `${track.language.trim().toLowerCase()}|${track.label.trim().toLowerCase()}|${
      track.name?.trim().toLowerCase() ?? ""
    }`
  );
}
