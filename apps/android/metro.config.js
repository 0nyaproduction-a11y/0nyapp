const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import("expo/metro-config").MetroConfig} */
const config = getDefaultConfig(__dirname);

config.watchFolders = [path.resolve(__dirname, "../..")];
config.resolver.blockList = [
  /.*[/\\]\.next[/\\].*/,
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "expo-secure-store") {
    return {
      filePath: path.resolve(__dirname, "src/lib/webSecureStoreShim.js"),
      type: "sourceFile",
    };
  }

  if (platform === "web" && moduleName === "react-native-google-mobile-ads") {
    return {
      filePath: path.resolve(__dirname, "src/lib/webGoogleMobileAdsShim.js"),
      type: "sourceFile",
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
