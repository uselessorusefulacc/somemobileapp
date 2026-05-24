const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monoRoot = path.resolve(__dirname, "../..");

const config = getDefaultConfig(projectRoot);

// Allow metro to watch monorepo node_modules too
config.watchFolders = [monoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monoRoot, "node_modules"),
];

module.exports = config;
