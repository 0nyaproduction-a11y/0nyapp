import * as SecureStore from "expo-secure-store";

const AUTOPLAY_NEXT_PREFERENCE_KEY = "0nya.autoplay-next-preference";
const NEW_RELEASE_NOTIFICATIONS_PREFERENCE_KEY = "0nya.new-release-notifications-preference";
const MARKETING_NOTIFICATIONS_PREFERENCE_KEY = "0nya.marketing-notifications-preference";
const APP_LANGUAGE_PREFERENCE_KEY = "0nya.app-language-preference";
const PICTURE_IN_PICTURE_PREFERENCE_KEY = "0nya.picture-in-picture-preference";

export type StoredAppLanguage = "en" | "hi";

export async function getAppLanguagePreference(): Promise<StoredAppLanguage> {
  try {
    const value = await SecureStore.getItemAsync(APP_LANGUAGE_PREFERENCE_KEY);
    if (value === "en" || value === "hi") {
      return value;
    }
    return "en";
  } catch {
    return "en";
  }
}

export async function setAppLanguagePreference(value: StoredAppLanguage) {
  try {
    await SecureStore.setItemAsync(APP_LANGUAGE_PREFERENCE_KEY, value);
  } catch {
    console.warn("Unable to save app language preference.");
  }
}

async function readBooleanPreference(key: string, fallback: boolean): Promise<boolean> {
  const value = await SecureStore.getItemAsync(key);

  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "boolean" ? parsed : fallback;
  } catch {
    console.warn(`Unable to parse stored preference for ${key}.`);
    return fallback;
  }
}

async function writeBooleanPreference(key: string, value: boolean) {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch {
    console.warn(`Unable to save preference for ${key}.`);
  }
}

export async function getAutoplayNextPreference(): Promise<boolean> {
  return readBooleanPreference(AUTOPLAY_NEXT_PREFERENCE_KEY, true);
}

export async function setAutoplayNextPreference(value: boolean) {
  await writeBooleanPreference(AUTOPLAY_NEXT_PREFERENCE_KEY, value);
}

export async function getNewReleaseNotificationsPreference(): Promise<boolean> {
  return readBooleanPreference(NEW_RELEASE_NOTIFICATIONS_PREFERENCE_KEY, false);
}

export async function setNewReleaseNotificationsPreference(value: boolean) {
  await writeBooleanPreference(NEW_RELEASE_NOTIFICATIONS_PREFERENCE_KEY, value);
}

export async function getMarketingNotificationsPreference(): Promise<boolean> {
  return readBooleanPreference(MARKETING_NOTIFICATIONS_PREFERENCE_KEY, false);
}

export async function setMarketingNotificationsPreference(value: boolean) {
  await writeBooleanPreference(MARKETING_NOTIFICATIONS_PREFERENCE_KEY, value);
}

export async function getPictureInPicturePreference(): Promise<boolean> {
  return readBooleanPreference(PICTURE_IN_PICTURE_PREFERENCE_KEY, true);
}

export async function setPictureInPicturePreference(value: boolean) {
  await writeBooleanPreference(PICTURE_IN_PICTURE_PREFERENCE_KEY, value);
}
