// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  globalIgnores(['dist/*', '.expo/*', 'node_modules/*', 'ios/*', 'android/*', 'coverage/*', 'web-build/*']),
  {
    // Os `eslint-disable` de require() do código (imagens, módulos nativos) ficam como documentação.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      // Regras do React Compiler (a app não o usa): os padrões com ref/setState em efeitos são deliberados e testados, mudá-los mexia no comportamento.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/globals': 'off',
      // Só estilo: Array<T> contra T[] obrigava a reescrever tipos em vários ficheiros.
      '@typescript-eslint/array-type': 'off',
    },
  },
  {
    // jest.mock tem de vir antes dos imports e os mocks usam require: a ordem é o padrão do jest.
    files: ['__tests__/**', 'jest.setup.ts'],
    rules: {
      'import/first': 'off',
      'import/no-duplicates': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: { __dirname: 'readonly' } },
  },
]);
