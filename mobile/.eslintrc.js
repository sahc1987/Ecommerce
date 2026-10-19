module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void promise()` marks a deliberate fire-and-forget call; allow it as a
    // statement, keep it banned inside expressions.
    'no-void': ['error', {allowAsStatement: true}],
  },
};
