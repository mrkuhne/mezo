import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Layout-invariant harness (mezo-ryb6). The screenshot-golden suite that used to live
 * here was retired — it never caught a real regression, only its own churn, and a single
 * mock-seed change (the notification badge, 3 -> 4) invalidated all 118 goldens on both
 * platforms at once.
 *
 * What remains is `layout.spec.ts`: NON-screenshot assertions that content is reachable
 * at real phone viewports. This class of bug is invisible to both other suites — jsdom
 * (vitest) computes no layout at all, and the retired goldens ran at 440x956, taller than
 * a real phone. It caught the keret-hero clipping 66 px at 852 (mezo-gllr).
 *
 * Runs against mock mode on a PER-WORKTREE port so no backend is needed and the seeds are
 * static/deterministic. The port used to be a hardcoded 4318 with `reuseExistingServer:
 * true`, which meant a vite dev server left running by ANOTHER git worktree (or another
 * agent session) was silently reused (mezo-sdbm). Uses the Chromium already cached by the
 * pinned Playwright version.
 */
// Derived from this worktree's own path, so two checkouts of the repo can never land
// on the same dev server. Override with VISUAL_PORT when you need a known port.
const WORKTREE_ROOT = path.resolve(__dirname, '../../..')
const PORT = Number(
  process.env.VISUAL_PORT ??
    43000 + (parseInt(createHash('sha1').update(WORKTREE_ROOT).digest('hex').slice(0, 6), 16) % 1000),
)
// eslint-disable-next-line no-console
console.log(`[layout] worktree ${WORKTREE_ROOT} -> dev server port ${PORT}`)

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  // Explicit (not left to Playwright's cwd-relative default): the default
  // `test-results/` resolves against the process's working directory, so it landed
  // wherever the script happened to be invoked from. Anchoring it to __dirname makes
  // the location independent of invocation cwd (mezo-7qms).
  outputDir: path.resolve(__dirname, '../../test-results'),
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 2,
    // Pin the timezone so the frozen-clock daypart derivation resolves identically on
    // every machine — a CI runner in UTC would shift the daypart-derived layout.
    timezoneId: 'Europe/Budapest',
    // Pinned Playwright (1.60) does not promote `reducedMotion` to a top-level
    // `use` option — it lives on the context. This makes the app's
    // `@media (prefers-reduced-motion: reduce)` rules take effect (they set
    // `animation: none`), so the static end-state matches what we baseline.
    contextOptions: { reducedMotion: 'reduce' },
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `VITE_USE_MOCK=true pnpm dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // NEVER reuse. With reuse on, ANY process already holding the port is adopted in
    // silence — there is no identity check a dev server can offer cheaply, and the
    // failure is invisible (see the header comment). Starting our own costs ~2s and
    // turns "screenshotted the wrong app" into "port in use", which is loud and
    // actionable. `--strictPort` makes vite fail instead of hopping to a free port,
    // which would silently break the baseURL match.
    reuseExistingServer: false,
    // Resolved relative to this config file's directory (frontend/tests/layout/),
    // so `../..` points at the frontend root where `pnpm dev` must run.
    cwd: '../..',
  },
})
