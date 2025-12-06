module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'google',
  ],
  rules: {
    // Override Airbnb style and format rules
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'linebreak-style': ['error', 'unix'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-console': 'off', // Allow console for Cloud Functions
    'max-len': ['error', { 'code': 160, 'ignoreUrls': true }],
    'object-curly-spacing': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline', 'never'],
    'arrow-parens': ['error', 'as-needed'],
    'prefer-const': 'error',
  },
};