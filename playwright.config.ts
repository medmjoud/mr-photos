import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the PRODUCTION build (`npm run build` first)
 * with an isolated database, storage and mail folder under .data/e2e and the
 * deterministic "mock" AI provider. See scripts/e2e-server.ts.
 */
const PORT = Number(process.env.E2E_PORT ?? 3200)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'tsx scripts/e2e-server.ts',
        url: `${baseURL}/fr`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { E2E_PORT: String(PORT) },
      },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /.*\.mobile\.spec\.ts/ },
  ],
})
