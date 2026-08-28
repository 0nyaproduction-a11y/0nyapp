type MobileEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  apiBaseUrl: string;
  canonicalSiteUrl: string | null;
  admobRewardedAdUnitId: string | null;
  devBillingHarnessEnabled: boolean;
  muxTestPlaybackEnabled: boolean;
  shortFilmMuxTestPlaybackEnabled: boolean;
};

function readEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function readBooleanEnv(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function getMobileEnv(): MobileEnv {
  const canonicalSiteUrl = process.env.EXPO_PUBLIC_ONYA_CANONICAL_URL?.trim();
  const admobRewardedAdUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID?.trim();
  const devBillingHarnessEnabled = readBooleanEnv(process.env.EXPO_PUBLIC_ONYA_DEV_BILLING_HARNESS);
  const muxTestPlaybackEnabled = readBooleanEnv(process.env.EXPO_PUBLIC_ONYA_TEST_MUX_PLAYBACK);
  const shortFilmMuxTestPlaybackEnabled = readBooleanEnv(
    process.env.EXPO_PUBLIC_ONYA_TEST_SHORT_FILM_MUX_PLAYBACK,
  );

  return {
    supabaseUrl: readEnv(
      "EXPO_PUBLIC_SUPABASE_URL",
      process.env.EXPO_PUBLIC_SUPABASE_URL,
    ),
    supabasePublishableKey: readEnv(
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    apiBaseUrl: readEnv(
      "EXPO_PUBLIC_ONYA_API_BASE_URL",
      process.env.EXPO_PUBLIC_ONYA_API_BASE_URL,
    ).replace(/\/$/, ""),
    canonicalSiteUrl: canonicalSiteUrl ? canonicalSiteUrl.replace(/\/$/, "") : null,
    admobRewardedAdUnitId: admobRewardedAdUnitId ? admobRewardedAdUnitId : null,
    devBillingHarnessEnabled,
    muxTestPlaybackEnabled,
    shortFilmMuxTestPlaybackEnabled,
  };
}
