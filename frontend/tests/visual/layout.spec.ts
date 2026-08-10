import { test, expect } from '@playwright/test'

/**
 * Layout invariants (mezo-gllr) — non-screenshot Playwright checks in the same harness
 * as the goldens, because this class of bug is invisible to BOTH other suites:
 *
 *  - jsdom (vitest) computes no layout at all, so a clipped island measures fine there;
 *  - the goldens run at the config's 440×956 viewport, which is TALLER than a real phone
 *    (iPhone 15 Pro ≈ 852 CSS px). The keret-hero regression cleared 956 by 1.5 px and
 *    clipped 66 px at 852 — green goldens, broken phone.
 *
 * So: assert the invariants directly, at phone-sized viewports. The rule these encode is
 * "content is reachable" — either it fits, or the page scrolls to it. Never clipped into
 * nothing by an `overflow: hidden` island.
 */

/** Real-phone heights the goldens' 956 does not cover. */
const PHONE_VIEWPORTS = [
  { name: 'iphone-15-pro', width: 393, height: 852 },
  { name: 'small-android', width: 360, height: 800 },
]

for (const vp of PHONE_VIEWPORTS) {
  test(`fuel mai · no clipped island content @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
    await page.goto('/fuel')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const m = await page.evaluate(() => {
      const big = document.querySelector('.isl.isl-big') as HTMLElement | null
      const view = big?.querySelector('.isl-bigview') as HTMLElement | null
      const cta = big?.querySelector('.cta-sage') as HTMLElement | null
      const sc = document.querySelector('.screen-content') as HTMLElement
      return {
        hasBig: !!big,
        clipped: big && view ? Math.round(view.scrollHeight - big.getBoundingClientRect().height) : 0,
        // How far the primary CTA's bottom sits BELOW the island's own bottom edge.
        // Positive ⇒ the button is outside the clipping box ⇒ unreachable.
        ctaOverhang: big && cta
          ? Math.round(cta.getBoundingClientRect().bottom - big.getBoundingClientRect().bottom)
          : 0,
        pageScrollable: sc.scrollHeight > sc.clientHeight,
        contentOverflow: Math.round(sc.scrollHeight - sc.clientHeight),
      }
    })

    expect(m.hasBig, 'the mock demo day has a NOW window, so one island is big').toBe(true)
    expect(m.clipped, `island content clipped by ${m.clipped}px`).toBeLessThanOrEqual(0)
    expect(m.ctaOverhang, 'the Logold CTA must sit inside its island').toBeLessThanOrEqual(0)
    // If the sky genuinely needs more room than the viewport gives it, the page must scroll
    // to reach it — the one thing the flex-fill sky could not do.
    if (m.contentOverflow > 0) expect(m.pageScrollable).toBe(true)
  })
}

test('today sky still fills the viewport without scrolling @ iphone-15-pro', async ({ page }) => {
  // The non-scrolling three-islands sky is Today's own design (ADR 0022 "L0 nem görgethető").
  // Fuel opted out of it (keret-hero above the sky); Today must NOT have.
  await page.setViewportSize({ width: 393, height: 852 })
  await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
  await page.goto('/today?dp=nap')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  const m = await page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    const big = document.querySelector('.isl.isl-big') as HTMLElement | null
    const view = big?.querySelector('.isl-bigview') as HTMLElement | null
    return {
      pageScrollable: sc.scrollHeight > sc.clientHeight,
      clipped: big && view ? Math.round(view.scrollHeight - big.getBoundingClientRect().height) : 0,
    }
  })
  expect(m.pageScrollable).toBe(false)
  expect(m.clipped).toBeLessThanOrEqual(0)
})
