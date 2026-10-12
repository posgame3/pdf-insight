import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.wrangler/**', 'web/public/pdfjs/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'error',
      eqeqeq: 'error',
    },
  },
  {
    files: ['web/src/**/*.{ts,tsx}', 'web/test/**/*.{ts,tsx}'],
    extends: [jsxA11y.flatConfigs.recommended],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'] }],
    },
  },
  {
    files: ['**/test/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    rules: {
      // Asymmetric matchers such as expect.stringContaining() are typed as any by design.
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['worker/src/log.ts'],
    rules: { 'no-console': ['error', { allow: ['warn'] }] },
  },
  {
    files: ['.claude/hooks/**/*.mjs'],
    rules: { 'no-console': ['error', { allow: ['error'] }] },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
