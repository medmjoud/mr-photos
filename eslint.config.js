//  @ts-check
import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      '.output/**',
      '.nitro/**',
      '.tanstack/**',
      '.data/**',
      'node_modules/**',
      'src/routeTree.gen.ts',
      'drizzle/**',
      'playwright-report/**',
      'test-results/**',
      'eslint.config.js',
      'prettier.config.js',
    ],
  },
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'pnpm/json-enforce-catalog': 'off',
      'import/consistent-type-specifier-style': 'off',
    },
  },
]
