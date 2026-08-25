import appJson from "./app.json";

const baseExpoConfig = appJson.expo;
const admobAndroidAppId = process.env.ADMOB_ANDROID_APP_ID?.trim();
const admobRewardedAdUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID?.trim();
const basePlugins = (baseExpoConfig.plugins ?? []).filter(
  (plugin) =>
    typeof plugin !== "string" ||
    (plugin !== "expo-build-properties" && plugin !== "react-native-google-mobile-ads"),
);

if (!admobAndroidAppId) {
  console.warn("ADMOB APP ID VALUE REQUIRED before native build.");
}

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
        androidAppId: admobAndroidAppId,
        delayAppMeasurementInit: true,
      },
    ],
  ],
};

export default appConfig;
