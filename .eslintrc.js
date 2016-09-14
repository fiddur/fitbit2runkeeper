module.exports = {
  'extends': 'airbnb',
  'installedESLint': true,
  'plugins': [
    'react',
    'jsx-a11y',
    'import',
  ],
  'rules': {
    'semi': ['error', 'never'],
    'no-multi-spaces': 0,
    'key-spacing': ['error', {'align': 'value'}],
    'no-nested-ternary': 0,
    'no-console': 0,
    'no-unused-vars': ['error', { argsIgnorePattern: 'next' }],
    'arrow-parens': ['error', 'as-needed'],
  },
}
