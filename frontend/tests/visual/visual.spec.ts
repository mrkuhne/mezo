import { test, expect } from '@playwright/test'

/**
 * Self-baselined visual goldens: 15 key screens × 2 themes = 30 snapshots.
 *
 * Determinism levers (all must hold or the shots flake):
 *  - clock frozen to 2026-05-21T13:42 (délután) BEFORE goto → the daypart-derived
 *    sky tint (PhoneFrame) + greeting (GreetingHeader) stay fixed even as the 60s
 *    re-derive interval keeps firing (setFixedTime keeps timers running but pins
 *    `new Date()`), and it matches the StatusBar's hardcoded 13:42.
 *  - theme via localStorage `mezo-theme` set in an init script BEFORE goto → the
 *    pre-paint script in index.html sees it and stamps data-theme.
 *  - reducedMotion 'reduce' (config) + toHaveScreenshot's default animations
 *    'disabled' → no in-flight transitions.
 *  - wait for `document.fonts.ready` → the self-hosted fonts (Bricolage + Jakarta) are in
 *    before the pixel compare, else the first paint uses fallback metrics.
 */
const SCREENS: Array<[string, string]> = [
  ['today', '/today'],
  ['train', '/train'],
  ['train-gym', '/train/gym'],
  ['train-session', '/train/session'],
  ['fuel', '/fuel'],
  ['fuel-terv', '/fuel/plan'],
  ['me', '/me'],
  ['me-cel', '/me/goals'],
  ['insights-mintak', '/insights'],
  ['insights-heti', '/insights/weekly'],
  ['insights-memoar', '/insights/memoir'],
  ['insights-tudastar', '/insights/knowledge'],
  ['insights-chat', '/insights/chat'],
  ['insights-elorejelzesek', '/insights/predictions'],
  ['insights-kiserletek', '/insights/experiments'],
]

for (const theme of ['light', 'dark'] as const) {
  test.describe(theme, () => {
    test.use({ colorScheme: theme })
    for (const [name, path] of SCREENS) {
      test(name, async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
        await page.addInitScript((t) => localStorage.setItem('mezo-theme', t), theme)
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await page.evaluate(() => document.fonts.ready)
        await expect(page).toHaveScreenshot(`${name}-${theme}.png`)
      })
    }
  })
}
