/* eslint-env jest */
// Native modules have no JavaScript implementation under Jest; use the mocks
// the libraries ship, or minimal stand-ins.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
