import { defineConfig, devices } from '@playwright/test'

/**
 * Visual baseline harness — self-baselined `toHaveScreenshot` goldens.
 *
 * LOCAL-ONLY (darwin baselines committed under `visual.spec.ts-snapshots/`).
 * Runs against mock mode on a dedicated port (4318) so no backend is needed and
 * the seeds are static/deterministic. Uses the Chromium already cached by the
 * pinned Playwright version — do NOT `playwright install` new browsers.
 *
 * Determinism (see visual.spec.ts): the clock is frozen before navigation so the
 * daypart-derived sky tint + greeting stay fixed, animations are disabled, and we
 * wait for `document.fonts.ready` before every screenshot.
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { toHaveScreenshot: { maxDiffPixels: 120 } },
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 2,
    // Pin the timezone so the frozen-clock daypart derivation (see visual.spec.ts)
    // resolves identically on every machine — a CI runner in UTC would otherwise
    // shift the daypart-derived sky tint + greeting away from the darwin goldens.
    timezoneId: 'Europe/Budapest',
    // Pinned Playwright (1.60) does not promote `reducedMotion` to a top-level
    // `use` option — it lives on the context. This makes the app's
    // `@media (prefers-reduced-motion: reduce)` rules take effect (they set
    // `animation: none`), so the static end-state matches what we baseline.
    contextOptions: { reducedMotion: 'reduce' },
    baseURL: 'http://localhost:4318',
  },
  webServer: {
    command: 'VITE_USE_MOCK=true pnpm dev --port 4318',
    url: 'http://localhost:4318',
    reuseExistingServer: true,
    // Resolved relative to this config file's directory (frontend/tests/visual/),
    // so `../..` points at the frontend root where `pnpm dev` must run.
    cwd: '../..',
  },
})
