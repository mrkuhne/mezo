import { defineConfig, devices } from '@playwright/test'

/**
 * Visual baseline harness — self-baselined `toHaveScreenshot` goldens.
 *
 * TWO-PLATFORM goldens under `visual.spec.ts-snapshots/`: darwin (local runs,
 * `pnpm test:visual:update`) + linux (the CI `test-visual` gate; regenerate via
 * `gh workflow run update-visual-baselines.yml -r <branch>`, mezo-uz4g).
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
