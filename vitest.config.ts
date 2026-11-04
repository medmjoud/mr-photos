import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      APP_ENV: 'test',
      DATABASE_URL: 'file::memory:',
      MODERATION_PROVIDER: 'none',
    },
  },
})
