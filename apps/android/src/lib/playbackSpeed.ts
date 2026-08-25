import * as SecureStore from "expo-secure-store";

const PLAYBACK_SPEED_PREFERENCE_KEY = "0nya.playback-speed-preference";

export const PLAYBACK_SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEED_OPTIONS)[number];

const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 1;

export async function getPlaybackSpeedPreference(): Promise<PlaybackSpeed> {
  const value = await SecureStore.getItemAsync(PLAYBACK_SPEED_PREFERENCE_KEY);

  if (!value) {
    return DEFAULT_PLAYBACK_SPEED;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_PLAYBACK_SPEED;
  }

  return normalizePlaybackSpeed(parsed);
}

export async function setPlaybackSpeedPreference(playbackSpeed: number) {
  await SecureStore.setItemAsync(
    PLAYBACK_SPEED_PREFERENCE_KEY,
    String(normalizePlaybackSpeed(playbackSpeed)),
  );
}

export function normalizePlaybackSpeed(playbackSpeed: number): PlaybackSpeed {
  const exactMatch = PLAYBACK_SPEED_OPTIONS.find((option) => option === playbackSpeed);

  return exactMatch ?? DEFAULT_PLAYBACK_SPEED;
}

export function formatPlaybackSpeed(playbackSpeed: number) {
  const normalized = normalizePlaybackSpeed(playbackSpeed);
  return `${Number(normalized.toFixed(2)).toString()}x`;
}
