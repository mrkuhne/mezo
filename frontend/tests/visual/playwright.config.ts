import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Visual baseline harness — self-baselined `toHaveScreenshot` goldens.
 *
 * TWO-PLATFORM goldens under `visual.spec.ts-snapshots/`: darwin (local runs,
 * `pnpm test:visual:update`) + linux (the CI `test-visual` gate; regenerate via
 * `gh workflow run update-visual-baselines.yml -r <branch>`, mezo-uz4g).
 * Runs against mock mode on a PER-WORKTREE port so no backend is needed and the
 * seeds are static/deterministic. The port used to be a hardcoded 4318 with
 * `reuseExistingServer: true`, which meant a vite dev server left running by ANOTHER
 * git worktree (or another agent session) was silently reused — Playwright then
 * screenshotted the other tree's UI with no warning at all. Measured: 93% of pixels
 * differed when a foreign server held the port, and in the `--update-snapshots`
 * direction it would have written that foreign UI straight into the goldens. It
 * happened twice in the mezo-iizd.9 round (mezo-sdbm). Uses the Chromium already cached by the
 * pinned Playwright version — do NOT `playwright install` new browsers.
 *
 * Determinism (see visual.spec.ts): the clock is frozen before navigation so the
 * daypart-derived sky tint + greeting stay fixed, animations are disabled, and we
 * wait for `document.fonts.ready` before every screenshot.
 */
// Derived from this worktree's own path, so two checkouts of the repo can never land
// on the same dev server. Override with VISUAL_PORT when you need a known port.
const WORKTREE_ROOT = path.resolve(__dirname, '../../..')
const PORT = Number(
  process.env.VISUAL_PORT ??
    43000 + (parseInt(createHash('sha1').update(WORKTREE_ROOT).digest('hex').slice(0, 6), 16) % 1000),
)
// eslint-disable-next-line no-console
console.log(`[visual] worktree ${WORKTREE_ROOT} -> dev server port ${PORT}`)

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  // Explicit (not left to Playwright's cwd-relative default): the default
  // `test-results/` is resolved relative to the process's working directory,
  // not this config file, so it silently landed wherever `pnpm test:visual`
  // happened to be invoked from (frontend/test-results/, since the script's
  // cwd is `frontend/`) instead of the `frontend/tests/visual/test-results/`
  // path the CI upload step assumed — which is why "Upload visual diffs on
  // failure" always found nothing (mezo-7qms). Anchoring it to __dirname
  // makes the location independent of invocation cwd.
  outputDir: path.resolve(__dirname, '../../test-results'),
  // mezo-kf4f — MÉRT értékek, nem tippeltek. A korábbi `maxDiffPixels: 120` (default
  // threshold 0.2 mellett) egy egész új fejléc-gombot átengedett (~38 px, PR #401), és a
  // DayOrb tónus-átkötését (mezo-x5va) is: annak YIQ-deltája ~101, a pixelmatch határa
  // viszont `35215 * threshold^2` = 352 a 0.1-es küszöbön, 1409 a 0.2-esen.
  // Darwin-mérés (97 shot, a goldenek a kóddal egyezőre generálva): a valódi renderzaj
  // MINDEN küszöbön 0 px egészen 0.03-ig — a 120-as tartalék tehát semmit nem védett.
  // 0.05-nél a tónus-eltolódás 319–491 px-ként jelenik meg, vagyis bőven a zaj fölött.
  // A `maxDiffPixels: 20` NEM a zaj fedezése: a mérés szerint a padló mindkét platformon
  // 0 px (darwin 3 futás, linux CI 2 futás). A 20 szűk tartalék egy alkalmi, egy-két
  // pixeles ingadozásra, és 16-szor kisebb a legkisebb MÉRT valódi jelnél (319 px), tehát
  // érdemi érzékenységet nem áldoz. Egy nulla tűrésű vizuális kaput, ami flake-el, előbb-
  // utóbb kikapcsolnak — az rosszabb, mint egy 20 pixeles vakfolt. Ha ez a szám valaha
  // hazudik, MÉRJ újra (a recept a mezo-kf4f-en), ne emeld tapasztalatból.
  expect: { toHaveScreenshot: { threshold: 0.05, maxDiffPixels: 20 } },
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
    // Resolved relative to this config file's directory (frontend/tests/visual/),
    // so `../..` points at the frontend root where `pnpm dev` must run.
    cwd: '../..',
  },
})
