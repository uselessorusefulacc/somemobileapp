const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// The Runable platform proxies bundle requests relative to the monorepo root.
// So metro must treat the monorepo root as the project root.
const monoRoot = path.resolve(__dirname, "../..");
const config = getDefaultConfig(__dirname);

// Override the project root so bundle paths resolve correctly
config.projectRoot = monoRoot;
config.watchFolders = [monoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monoRoot, "node_modules"),
];

module.exports = config;
