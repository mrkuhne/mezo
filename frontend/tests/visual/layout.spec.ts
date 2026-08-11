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

test("today's day view is fully reachable @ iphone-15-pro", async ({ page }) => {
  // ADR 0025 supersedes ADR 0022's "L0 nem görgethető" rule: Today's sky-of-islands (which
  // this file used to pin as non-scrolling, mirroring Fuel's fixed-height `.isl.isl-big`) is
  // gone — `.dayview` is a normal, unclipped panel inside the app's one `.screen-content`
  // scroller, same as any other screen. The invariant this test protects is unchanged from
  // the file header above, though: content must be REACHABLE — either it fits, or the page
  // scrolls to it, never silently eaten by a fixed-height `overflow: hidden` ancestor
  // (the original mezo-gllr bug this file exists to catch).
  await page.setViewportSize({ width: 393, height: 852 })
  await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
  await page.goto('/today?dp=nap')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  const m = await page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    const dayview = document.querySelector('.dayview') as HTMLElement | null

    // Walk from `.dayview` up to (not including) the app's own scroller, looking for an
    // ancestor that is ACTIVELY clipping its content — `overflow: hidden`/`-y: hidden` AND
    // its content taller than its own rendered box. That is the general shape of the
    // mezo-gllr bug (a fixed-height flex `.isl.isl-big` silently ate a CTA row with no
    // scrollbar anywhere to reach it); under ADR 0025 there should be no such box between
    // `.dayview` and the page's one scroller at all.
    let clipped = 0
    let node: HTMLElement | null = dayview
    while (node && node !== sc) {
      const cs = getComputedStyle(node)
      if (cs.overflowY === 'hidden' || cs.overflow === 'hidden') {
        clipped = Math.max(clipped, Math.round(node.scrollHeight - node.clientHeight))
      }
      node = node.parentElement
    }

    // Every interactive control inside the day view must sit within the scroller's actual
    // content extent — i.e. reachable by scrolling `.screen-content`, not floating past its
    // `scrollHeight` (which would mean SOME ancestor is cropping it without anyone noticing).
    const scRect = sc.getBoundingClientRect()
    const buttons = dayview ? Array.from(dayview.querySelectorAll('button')) : []
    const maxButtonBottom = buttons.reduce((max, b) => {
      const r = b.getBoundingClientRect()
      return Math.max(max, Math.round(r.bottom - scRect.top + sc.scrollTop))
    }, 0)

    return {
      hasDayview: !!dayview,
      buttonCount: buttons.length,
      clipped,
      maxButtonBottom,
      scrollHeight: sc.scrollHeight,
      pageScrollable: sc.scrollHeight > sc.clientHeight,
      contentOverflow: Math.round(sc.scrollHeight - sc.clientHeight),
    }
  })

  expect(m.hasDayview, 'the nap daypart renders its .dayview panel').toBe(true)
  expect(m.buttonCount, 'the day view renders at least one control').toBeGreaterThan(0)
  expect(m.clipped, `an ancestor between .dayview and .screen-content clips ${m.clipped}px of content`).toBeLessThanOrEqual(0)
  expect(
    m.maxButtonBottom,
    `a control's bottom edge (${m.maxButtonBottom}px) sits past the scroller's reachable extent (${m.scrollHeight}px)`
  ).toBeLessThanOrEqual(m.scrollHeight)
  // If the day view genuinely needs more room than the viewport gives it, the page must
  // scroll to reach it — the one thing a clipped fixed-height box could not do.
  if (m.contentOverflow > 0) expect(m.pageScrollable).toBe(true)
})
