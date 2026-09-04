import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'

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

// Minden kalauzt látottnak seedelünk: ezek a tesztek MÉRNEK és KATTINTANAK, egy
// auto-open sheet pedig mindkettőt elrontja (mezo-gb1s.6 — lásd `kalauzSeed.ts`).
test.beforeEach(async ({ page }) => { await seedKalauzSeen(page) })

/** Real-phone heights the goldens' 956 does not cover. */
const PHONE_VIEWPORTS = [
  { name: 'iphone-15-pro', width: 393, height: 852 },
  { name: 'small-android', width: 360, height: 800 },
]

for (const vp of PHONE_VIEWPORTS) {
  test(`Fuel settings page stays horizontally contained and fully reachable @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
    await page.goto('/fuel/settings')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const overflow = await page.locator('.fset-page').evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

    const slots = page.getByRole('button', { name: 'Étkezési ablakok szerkesztése' })
    const save = page.getByRole('button', { name: 'Mentés' })
    await slots.scrollIntoViewIfNeeded()
    await expect(slots).toBeVisible()
    await expect(save).toBeVisible()

    const spacing = await page.evaluate(() => {
      const slotsRect = document.querySelector('.fset-slots')!.getBoundingClientRect()
      const saveRect = document.querySelector('.fset-savebar')!.getBoundingClientRect()
      return { slotsBottom: Math.round(slotsRect.bottom), saveTop: Math.round(saveRect.top) }
    })
    expect(spacing.slotsBottom).toBeLessThanOrEqual(spacing.saveTop)
  })

  test(`fuel · the Logolás hero tile and the /fuel/log blocks are reachable, never clipped @ ${vp.name}`, async ({ page }) => {
    // mezo-byo1: the horizontal window swimlane dissolved — the hub carries ONE Logolás
    // hero tile and the whole day's logging lives on /fuel/log as VERTICALLY stacked
    // blocks. The invariant this file exists for is unchanged: content must be REACHABLE —
    // either it fits, or the page scrolls to it, never eaten by a clipping ancestor.
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
    await page.goto('/fuel')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const hub = await page.evaluate(() => {
      const tile = document.querySelector('.fh-logtile') as HTMLElement | null
      const sc = document.querySelector('.screen-content') as HTMLElement
      const scRect = sc.getBoundingClientRect()
      const tileBottom = tile
        ? Math.round(tile.getBoundingClientRect().bottom - scRect.top + sc.scrollTop)
        : 0
      return {
        hasTile: !!tile,
        tileBottom,
        scrollHeight: sc.scrollHeight,
        pageScrollable: sc.scrollHeight > sc.clientHeight,
        contentOverflow: Math.round(sc.scrollHeight - sc.clientHeight),
      }
    })
    expect(hub.hasTile, 'the Fuel hub renders its Logolás hero tile').toBe(true)
    expect(
      hub.tileBottom,
      `the hero tile's bottom (${hub.tileBottom}px) sits past the scroller's reachable extent (${hub.scrollHeight}px)`
    ).toBeLessThanOrEqual(hub.scrollHeight)
    if (hub.contentOverflow > 0) expect(hub.pageScrollable).toBe(true)

    await page.goto('/fuel/log')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const log = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.flog-blk')) as HTMLElement[]
      const body = document.querySelector('.mz-page-body') as HTMLElement | null
      const bodyCs = body ? getComputedStyle(body) : null
      const lastBottom = blocks.length && body
        ? Math.round(blocks[blocks.length - 1].getBoundingClientRect().bottom
            - body.getBoundingClientRect().top + body.scrollTop)
        : 0
      return {
        blockCount: blocks.length,
        // The page body is the vertical scroller the blocks live in.
        bodyScrollsY: bodyCs ? ['auto', 'scroll'].includes(bodyCs.overflowY) : false,
        lastBottom,
        bodyScrollHeight: body ? body.scrollHeight : 0,
      }
    })
    // The mock demo day schedules windows + the trailing Ablakon kívül block.
    expect(log.blockCount, 'the /fuel/log page stacks its window blocks').toBeGreaterThan(1)
    expect(log.bodyScrollsY, 'the log page body scrolls vertically rather than cropping blocks').toBe(true)
    expect(
      log.lastBottom,
      `the last block's bottom (${log.lastBottom}px) sits past the body's reachable extent (${log.bodyScrollHeight}px)`
    ).toBeLessThanOrEqual(log.bodyScrollHeight)
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

test('header · kitapad, kompakt magasság és a lap-chrome offsetje (mezo-8az6)', async ({ page }) => {
  // Spec §5 (docs/superpowers/specs/2026-09-03-header-aurora-design.md) ígérte ezt a
  // regressziós tesztet: a shell-fejléc (`.app-head`) kitapad a görgetőport (`.screen-content`)
  // tetejéhez és a küszöb (14px) fölött kompakt magasságra (--mzh-head-cond-h: 44px) húzódik;
  // a lap saját sticky chrome-ja (`.sticky-top`) ehhez képest tapad ki, sosem csúszhat a
  // fejléc alá; a fejléc nélküli oldalakon (AppLayout.tsx hideChrome) viszont nincs mi alá
  // tapadni, ott a `.sticky-top`-nak a görgetőport tetejéhez KELL tapadnia (top ≈ 0), nem
  // 44px-cel lejjebb.
  // /fuel (not /nap): the Nap hub's panel exactly fills a 393×852 viewport with no
  // overflow, so `.screen-content` cannot be scrolled there — /fuel's longer hub
  // reliably overflows, which the condensed-header transition needs to trigger.
  await page.setViewportSize({ width: 393, height: 852 })
  await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
  await page.goto('/fuel')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  await page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    sc.scrollTop = 40
    sc.dispatchEvent(new Event('scroll'))
  })

  await expect(page.locator('.app-head')).toHaveClass(/is-cond/)
  // Let the 250ms padding/margin transition (prototype.css `--duration-normal`) settle
  // before measuring — mid-transition the rect height is neither the expanded nor the
  // condensed value.
  await page.waitForTimeout(350)

  const withHead = await page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    const head = document.querySelector('.app-head') as HTMLElement
    const sticky = document.querySelector('.sticky-top') as HTMLElement | null
    const scRect = sc.getBoundingClientRect()
    const headRect = head.getBoundingClientRect()
    return {
      headTop: Math.round(headRect.top - scRect.top),
      headHeight: Math.round(headRect.height),
      stickyTopBelowHead: sticky
        ? Math.round(sticky.getBoundingClientRect().top - headRect.bottom)
        : null,
    }
  })
  expect(withHead.headTop, 'a kompakt fejléc a görgetőport tetejéhez tapad').toBe(0)
  expect(withHead.headHeight, 'a kompakt fejléc magassága a --mzh-head-cond-h token (44px)').toBe(44)
  if (withHead.stickyTopBelowHead !== null) {
    expect(
      withHead.stickyTopBelowHead,
      'a lap .sticky-top-ja nem csúszhat a fejléc alá'
    ).toBeGreaterThanOrEqual(0)
  }

  // Chrome nélküli oldal: nincs .app-head, a .sticky-top a görgetőport tetejéhez tapad,
  // NEM 44px-cel lejjebb (az 1. finding regressziója: üres sáv a lap tetején).
  await page.goto('/train/session')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  const chromeFree = await page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    const sticky = sc.querySelector('.sticky-top') as HTMLElement | null
    return {
      hasHead: !!document.querySelector('.app-head'),
      stickyTop: sticky
        ? Math.round(sticky.getBoundingClientRect().top - sc.getBoundingClientRect().top)
        : null,
    }
  })
  expect(chromeFree.hasHead, '/train/session nem renderel shell-fejlécet').toBe(false)
  expect(chromeFree.stickyTop, "a lap .sticky-top-ja tapad, üres sáv nélkül").toBe(0)
})

test('fuel · a Kamra-picker sorai sok találatnál sem lapulnak össze', async ({ page }) => {
  // mezo-bq2t: `.fkp-item` carried `overflow: hidden`, which zeroes the flex-item auto
  // min-height — so the picker list's `max-height: 400px` flex column squashed every row
  // down to ~20px once there were more hits than fit. `flex: none` is the fix; this test
  // pins the row height so it cannot regress silently.
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/fuel/log')
  // The first openable window CTA → navigates to /fuel/log/uj → Kamra source tile → picker.
  await page.getByRole('button', { name: /^(Logold|Pótold) · / }).first().click()
  await page.getByRole('button', { name: 'Kamra · hozzáadás' }).click()
  const rows = page.locator('.fkp-item')
  await expect(rows.first()).toBeVisible()
  const heights = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))
  expect(heights.length).toBeGreaterThan(4)
  // A healthy row is ~114px; the squash bug collapsed every row to ~20px.
  expect(Math.min(...heights)).toBeGreaterThan(60)
})
