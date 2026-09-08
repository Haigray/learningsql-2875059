// The app imports the engines straight from ../engine, so Metro has to watch
// above the project root. That is deliberate: one tested engine, not a copy.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.resolve(projectRoot, '..')];   // relocation-os/app
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
