import type { ConfigContext, ExpoConfig } from "expo/config";
import appJson from "./app.json";

export default ({ config }: ConfigContext): ExpoConfig => {
  const staticExpoConfig = appJson.expo as ExpoConfig;
  const baseExpoConfig: ExpoConfig = { ...config, ...staticExpoConfig };

  return {
    ...baseExpoConfig,
    plugins: [...(baseExpoConfig.plugins ?? []), "expo-font"],
  };
};
