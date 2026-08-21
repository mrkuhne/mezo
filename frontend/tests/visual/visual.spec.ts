import { test, expect } from '@playwright/test'

/**
 * Self-baselined visual goldens: 19 goto screens + the /ritual Harvest click-through
 * = 20 screens × 2 themes = 40 snapshots per platform (mezo-mzbz added the two /ritual
 * shots: Arrival act 1 via the SCREENS list + the Harvest act 5 via the click-through test;
 * mezo-9bbc added train-heti for the new /train/week page; mezo-1khu replaced the single
 * `today` shot with one per daypart face — reggel/nap/este).
 *
 * Determinism levers (all must hold or the shots flake):
 *  - clock frozen BEFORE goto → the daypart-derived sky tint (PhoneFrame) + greeting
 *    (GreetingHeader) stay fixed even as the 60s re-derive interval keeps firing
 *    (setFixedTime keeps timers running but pins `new Date()`). The default is
 *    2026-05-21T13:42 (délután), which matches the StatusBar's hardcoded 13:42; a screen
 *    may override it via the third `SCREENS` tuple slot. The /ritual flow is reachable any
 *    time (ADR 0010 D2 — the window nudges, never locks), so it renders at 13:42.
 *  - the three `/today` shots pin BOTH levers, and both are load-bearing (mezo-1khu):
 *    `?dp=` fixes WHICH face renders (TodayPage derives the selection from the URL), while
 *    the frozen clock fixes which face is *current* — the pill DayFaceStrip marks as `now`,
 *    the greeting headline, and every time-derived row state. Freezing only the clock would
 *    still be deterministic, but pinning `?dp=` too makes each shot independent of the
 *    mock sleep anchor (wake 06:45 / bed 23:15 → reggel 06:15, nap 11:45, este 19:15), so a
 *    later seed tweak cannot silently re-point a golden at a different face.
 *  - theme via localStorage `mezo-theme` set in an init script BEFORE goto → the
 *    pre-paint script in index.html sees it and stamps data-theme.
 *  - reducedMotion 'reduce' (config) + toHaveScreenshot's default animations
 *    'disabled' → no in-flight transitions. The /ritual rz-* animation family is fully
 *    neutralized under reduced-motion (asserted by reducedMotionGuard.test.ts), so both
 *    /ritual shots settle to a deterministic end state — confetti is display:none, the
 *    Harvest CountUp renders its final value immediately, np-anim/rz-pop settle visible.
 *    Today's own island motion (blob morph, floaty capsules, L1 stagger, phase swap) is
 *    neutralized the same way, asserted by features/today/todayReducedMotion.test.ts.
 *  - wait for `document.fonts.ready` → the self-hosted fonts (Geist + Fraunces) are in
 *    before the pixel compare, else the first paint uses fallback metrics.
 */
/** `[name, path, frozenTime?]` — the third slot overrides the default frozen clock. */
const SCREENS: Array<[string, string, string?]> = [
  ['today-reggel', '/today?dp=reggel', '2026-05-21T09:12:00'],
  ['today-nap', '/today?dp=nap', '2026-05-21T13:42:00'],
  ['today-este', '/today?dp=este', '2026-05-21T21:05:00'],
  ['train', '/train'],
  ['train-heti', '/train/week'],
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
  // Napzárás act 1 (Megérkezés): goto /ritual lands on the Arrival act directly. Harvest
  // (act 5) is a separate click-through test below (it can't be reached by a bare goto).
  ['ritual-arrival', '/ritual'],
]

/** The clock every screen freezes to unless its `SCREENS` tuple overrides it. */
const DEFAULT_FROZEN = '2026-05-21T13:42:00'

for (const theme of ['light', 'dark'] as const) {
  test.describe(theme, () => {
    test.use({ colorScheme: theme })
    for (const [name, path, frozen] of SCREENS) {
      test(name, async ({ page }) => {
        await page.clock.setFixedTime(new Date(frozen ?? DEFAULT_FROZEN))
        await page.addInitScript((t) => localStorage.setItem('mezo-theme', t), theme)
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await page.evaluate(() => document.fonts.ready)
        await expect(page).toHaveScreenshot(`${name}-${theme}.png`)
      })
    }

    // Napzárás act 5 (Termés/Harvest): not reachable by a bare goto — drive the flow to it.
    // No production `?act=` deep-link exists (and none should be added just for a test); each
    // act mounts exactly one `.rz-cta` advance button and only one act renders at a time, so
    // clicking the labelled advance CTA walks Arrival → A napod íve → Ma milyen volt → Nyitott
    // hurkok → Termés. The reflection act (Ma milyen volt) is deliberately skipped via its
    // „Ma nem írok" CTA rather than typed into, so the shot stays deterministic. The Harvest
    // read is a fixed mock day seed and CountUp renders its final value immediately under
    // reduced motion, so the end state is deterministic.
    test('ritual-harvest', async ({ page }) => {
      await page.clock.setFixedTime(new Date(DEFAULT_FROZEN))
      await page.addInitScript((t) => localStorage.setItem('mezo-theme', t), theme)
      await page.goto('/ritual')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Kezdjük 🌙' }).click()  // act 1 → 2
      await page.getByRole('button', { name: 'Tovább' }).click()       // act 2 → 3
      await page.getByRole('button', { name: 'Ma nem írok' }).click()  // act 3 → 4 (reflection skipped)
      await page.getByRole('button', { name: 'Tovább' }).click()       // act 4 → 5
      await page.locator('.rz-harvest .rz-xp-num').waitFor()           // Harvest XP total rendered
      // Entering Harvest fires the mock close() award(s) — the ritual's own HABIT award plus
      // the needs-close award (mezo-dhzk), which pop as TWO stacked `.toast` entries in
      // `.toast-stack` (mock-only side effects — real mode derives account XP, never emits
      // these). They overlap the XP total, so wait them out: let at least one appear (grace),
      // then wait for the whole stack to auto-dismiss (ToastProvider AUTO_HIDE_MS), capturing a
      // clean Harvest. `setFixedTime` keeps timers running, so the auto-hide fires in
      // wall-clock time. `.toast` is count-agnostic here (not `.first()`/a single locator) so it
      // stays correct whether one or several toasts stack; each is position:fixed, so their
      // removal causes no layout shift.
      const toasts = page.locator('.toast')
      await toasts.first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => {})
      await expect(toasts).toHaveCount(0)
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(`ritual-harvest-${theme}.png`)
    })
  })
}
