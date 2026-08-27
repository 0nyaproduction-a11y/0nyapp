import appJson from "./app.json";

const GOOGLE_ANDROID_SAMPLE_ADMOB_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const ADMOB_ANDROID_APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;
const ADMOB_ANDROID_AD_UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;

const baseExpoConfig = appJson.expo;
const admobAndroidAppId = process.env.ADMOB_ANDROID_APP_ID?.trim();
const admobRewardedAdUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID?.trim();
const isProductionBuild = process.env.EAS_BUILD_PROFILE === "production";
const basePlugins = (baseExpoConfig.plugins ?? []).filter(
  (plugin) =>
    typeof plugin !== "string" ||
    (plugin !== "expo-build-properties" && plugin !== "react-native-google-mobile-ads"),
);

function resolveAndroidAdMobAppId() {
  if (admobAndroidAppId && ADMOB_ANDROID_APP_ID_PATTERN.test(admobAndroidAppId)) {
    return admobAndroidAppId;
  }

  const issue = !admobAndroidAppId
    ? "missing"
    : ADMOB_ANDROID_AD_UNIT_ID_PATTERN.test(admobAndroidAppId)
      ? "an ad-unit ID"
      : "invalid";

  if (isProductionBuild) {
    throw new Error(`ADMOB_ANDROID_APP_ID is ${issue}. Provide a valid AdMob Android app ID.`);
  }

  console.warn(
    `ADMOB_ANDROID_APP_ID is ${issue}; using Google's Android sample AdMob app ID for this non-production build.`,
  );

  return GOOGLE_ANDROID_SAMPLE_ADMOB_APP_ID;
}

const androidAdMobAppId = resolveAndroidAdMobAppId();

const appConfig = {
  ...baseExpoConfig,
  extra: {
    ...baseExpoConfig.extra,
    ...(admobRewardedAdUnitId ? { admobRewardedAdUnitId } : {}),
  },
  plugins: [
    ...basePlugins,
    [
      "expo-build-properties",
      {
        android: {
          extraProguardRules: "-keep class com.google.android.gms.internal.consent_sdk.** { *; }",
        },
      },
    ],
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: androidAdMobAppId,
        delayAppMeasurementInit: true,
      },
    ],
  ],
};

export default appConfig;
