const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Support bundling .sqlite databases as assets
config.resolver.assetExts.push("sqlite");
config.resolver.assetExts.push("wasm");
config.resolver.sourceExts.push("wasm");

module.exports = withNativeWind(config, { input: "./src/global.css" });
