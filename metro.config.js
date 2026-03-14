const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = mergeConfig(defaultConfig, {
  resolver: {
    extraNodeModules: {
      crypto: require.resolve('react-native-quick-crypto'),
      buffer: require.resolve('buffer'),
      process: require.resolve('process/browser'),
      stream: require.resolve('stream-browserify'),
      string_decoder: require.resolve('string_decoder'),
      events: require.resolve('events'),
      util: require.resolve('util'),
      vm: require.resolve('vm-browserify'),
    },
  },
});
