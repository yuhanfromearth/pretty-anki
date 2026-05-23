// @ts-check

import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.tanstack/**',
      '**/.output/**',
      '**/.nitro/**',
      '**/coverage/**',
      '**/*.gen.ts',
      'apps/ui/src/routeTree.gen.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{mjs,cjs,js}', '**/scripts/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  }
);
