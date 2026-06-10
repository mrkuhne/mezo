import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 2,
  },
  webServer: {
    command: 'pnpm dev --port 4317',
    url: 'http://localhost:4317',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
