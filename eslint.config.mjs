import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  require: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  fetch: 'readonly',
};

export default [
  {
    // Build output and tool output only. Source `.js` files (test/*.js, bin/) are linted.
    ignores: ['dist/', 'node_modules/', 'coverage/', 'test-results/'],
  },
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: nodeGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      // stdout carries the MCP JSON-RPC stream; log to stderr only
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'no-case-declarations': 'off',
      'no-undef': 'off', // TypeScript handles this
      'no-unused-vars': 'off', // Use TypeScript ESLint version instead
    },
  },
  {
    // scripts/ and test/ TypeScript: not in tsconfig.json (src only), so no `project`.
    files: ['scripts/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: nodeGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off', // TypeScript handles this
      'no-unused-vars': 'off', // Use TypeScript ESLint version instead
      'no-case-declarations': 'off',
    },
  },
  {
    // Plain Node scripts and tests (.js and .mjs).
    files: ['scripts/**/*.{js,mjs}', 'test/**/*.{js,mjs}', 'bin/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals,
    },
  },
];
