// Lint config for the Node packages (apps/api, infra, libs/shared).
// apps/web has its own eslint.config.js with the React rules; ESLint uses the
// config file closest to each linted file, so the two never overlap.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/cdk.out/**', '**/coverage/**', 'apps/web/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
