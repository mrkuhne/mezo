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
  test(`fuel hub · the window swimlane is reachable and never clips @ ${vp.name}`, async ({ page }) => {
    // Design 2.0 (mezo-d20.4.1): the Island/`.isl-big` language is retired — the hub's
    // eating windows live in a horizontally scrolling swimlane. The invariant this file
    // exists for is unchanged: content must be REACHABLE, never eaten by an ancestor that
    // clips without a scrollbar. For the lane that means it scrolls HORIZONTALLY (its own
    // overflow-x) while the page scrolls vertically to it — and no tile may be taller than
    // the lane's own box.
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
    await page.goto('/fuel')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const m = await page.evaluate(() => {
      const lane = document.querySelector('.fh-lane') as HTMLElement | null
      const tiles = lane ? Array.from(lane.querySelectorAll('.fh-wtile')) as HTMLElement[] : []
      const sc = document.querySelector('.screen-content') as HTMLElement
      const laneCs = lane ? getComputedStyle(lane) : null
      return {
        hasLane: !!lane,
        tileCount: tiles.length,
        // A tile taller than the lane's own box is content clipped with no way to reach it.
        tallestOverflow: lane
          ? Math.max(0, ...tiles.map(t => Math.round(t.getBoundingClientRect().height - lane.getBoundingClientRect().height)))
          : 0,
        // The lane must be the thing that scrolls sideways, not a silently-cropping box.
        laneScrollsX: laneCs ? ['auto', 'scroll'].includes(laneCs.overflowX) : false,
        pageScrollable: sc.scrollHeight > sc.clientHeight,
        contentOverflow: Math.round(sc.scrollHeight - sc.clientHeight),
      }
    })

    expect(m.hasLane, 'the Fuel hub renders its window swimlane').toBe(true)
    expect(m.tileCount, 'the mock demo day schedules eating windows').toBeGreaterThan(0)
    expect(m.tallestOverflow, `a window tile overflows the lane by ${m.tallestOverflow}px`).toBe(0)
    expect(m.laneScrollsX, 'the lane scrolls horizontally rather than cropping tiles').toBe(true)
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
  await page.goto('/nap?dp=nap')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  const m = await page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    // Design 2.0 (mezo-d20.2.1): the day spine's panel is the Nap hub now — same invariant.
    const dayview = document.querySelector('.nap-hub') as HTMLElement | null

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

  expect(m.hasDayview, 'the nap daypart renders its .nap-hub panel').toBe(true)
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
