module.exports = {
  preset: '@react-native/jest-preset',
  // Jest only runs CommonJS; these packages ship ES modules for React Native,
  // so let Babel transpile them like the app's own code.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native[^/]*|@react-native[^/]*|@react-navigation|react-redux|@reduxjs/toolkit|redux|immer|reselect)/)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
