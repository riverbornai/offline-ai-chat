const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

// Ensure proper polyfills are loaded
config.resolver.alias = {
  ...config.resolver.alias,
  crypto: 'react-native-get-random-values',
};

// Add support for model files (.gguf) and other assets
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'gguf',  // Model files
  'bin',   // Binary files
  'model', // Model files
  'zip',   // Zip files for bundled data
];

// Source extensions for React Native
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'jsx',
  'js',
  'ts',
  'tsx',
];

// Transform configuration
config.transformer = {
  ...config.transformer,
  // Enable minification for production
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};

module.exports = config; 