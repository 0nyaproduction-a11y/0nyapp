import type { ConfigContext, ExpoConfig } from "expo/config";
import appJson from "./app.json";

const GOOGLE_ANDROID_SAMPLE_ADMOB_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const GOOGLE_IOS_SAMPLE_ADMOB_APP_ID = "ca-app-pub-3940256099942544~1458002511";
const ADMOB_ANDROID_APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;
const ADMOB_ANDROID_AD_UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;

const admobAndroidAppId = process.env.ADMOB_ANDROID_APP_ID?.trim();
const admobRewardedAdUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID?.trim();
const isProductionBuild = process.env.EAS_BUILD_PROFILE === "production";

type ExpoPlugin = NonNullable<ExpoConfig["plugins"]>[number];

function getPluginName(plugin: ExpoPlugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function resolveAndroidAdMobAppId() {
  if (!isProductionBuild) {
    if (admobAndroidAppId && admobAndroidAppId !== GOOGLE_ANDROID_SAMPLE_ADMOB_APP_ID) {
      console.warn(
        "Ignoring ADMOB_ANDROID_APP_ID for non-production build; using Google's Android sample AdMob app ID.",
      );
    } else if (!admobAndroidAppId) {
      console.warn(
        "ADMOB_ANDROID_APP_ID is missing; using Google's Android sample AdMob app ID for this non-production build.",
      );
    }

    return GOOGLE_ANDROID_SAMPLE_ADMOB_APP_ID;
  }

  if (admobAndroidAppId && ADMOB_ANDROID_APP_ID_PATTERN.test(admobAndroidAppId)) {
    return admobAndroidAppId;
  }

  const issue = !admobAndroidAppId
    ? "missing"
    : ADMOB_ANDROID_AD_UNIT_ID_PATTERN.test(admobAndroidAppId)
      ? "an ad-unit ID"
      : "invalid";
  throw new Error(`ADMOB_ANDROID_APP_ID is ${issue}. Provide a valid AdMob Android app ID.`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const staticExpoConfig = appJson.expo as ExpoConfig;
  const baseExpoConfig: ExpoConfig = { ...config, ...staticExpoConfig };
  const basePlugins = (baseExpoConfig.plugins ?? []).filter(
    (plugin) =>
      getPluginName(plugin) !== "expo-build-properties" &&
      getPluginName(plugin) !== "react-native-google-mobile-ads",
  );
  const androidAdMobAppId = resolveAndroidAdMobAppId();

  return {
    ...baseExpoConfig,
    userInterfaceStyle: "light",
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
          iosAppId: GOOGLE_IOS_SAMPLE_ADMOB_APP_ID,
        },
      ],
    ] as ExpoConfig["plugins"],
  };
};
