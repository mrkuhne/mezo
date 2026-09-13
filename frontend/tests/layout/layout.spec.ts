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

  test(`fuel · the Mai blocks and the logger are reachable, never clipped @ ${vp.name}`, async ({ page }) => {
    // Fuel Titanium (mezo-33k6 / mezo-qt5q): the Logolás hero tile and `/fuel/log` are gone —
    // the day's blocks moved ONTO the Mai and the logger is `/fuel/log/uj`. The invariant this
    // file exists for is unchanged: content must be REACHABLE — either it fits, or the page
    // scrolls to it, never eaten by a clipping ancestor.
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
    await page.goto('/fuel')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const hub = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.fmx-block')) as HTMLElement[]
      const sc = document.querySelector('.screen-content') as HTMLElement
      const scRect = sc.getBoundingClientRect()
      const bottomOf = (el: HTMLElement) =>
        Math.round(el.getBoundingClientRect().bottom - scRect.top + sc.scrollTop)
      const generic = document.querySelector('.fmx-loggeneric') as HTMLElement | null
      return {
        blockCount: blocks.length,
        lastBlockBottom: blocks.length ? bottomOf(blocks[blocks.length - 1]) : 0,
        // The generic log entry is the LAST thing on the page — if it is reachable, everything is.
        genericBottom: generic ? bottomOf(generic) : 0,
        hasGeneric: !!generic,
        scrollHeight: sc.scrollHeight,
        pageScrollable: sc.scrollHeight > sc.clientHeight,
        contentOverflow: Math.round(sc.scrollHeight - sc.clientHeight),
      }
    })
    expect(hub.blockCount, 'the Mai stacks the day\'s meal blocks').toBeGreaterThan(1)
    expect(hub.hasGeneric, 'the Mai keeps the generic log entry below the blocks').toBe(true)
    expect(
      hub.lastBlockBottom,
      `the last block's bottom (${hub.lastBlockBottom}px) sits past the scroller's reachable extent (${hub.scrollHeight}px)`
    ).toBeLessThanOrEqual(hub.scrollHeight)
    expect(
      hub.genericBottom,
      `the generic log entry's bottom (${hub.genericBottom}px) sits past the scroller's reachable extent (${hub.scrollHeight}px)`
    ).toBeLessThanOrEqual(hub.scrollHeight)
    if (hub.contentOverflow > 0) expect(hub.pageScrollable).toBe(true)

    await page.goto('/fuel/log/uj')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const logger = await page.evaluate(() => {
      const sc = document.querySelector('.screen-content') as HTMLElement
      const scRect = sc.getBoundingClientRect()
      const modes = Array.from(document.querySelectorAll('.fmx-mode')) as HTMLElement[]
      const last = modes.length ? modes[modes.length - 1] : null
      return {
        modeCount: modes.length,
        lastModeRight: last ? Math.round(last.getBoundingClientRect().right) : 0,
        scRight: Math.round(scRect.right),
        noHorizontalOverflow: sc.scrollWidth <= sc.clientWidth + 1,
      }
    })
    // The camera-first shell offers exactly the four approved ways in, and none of them may
    // sit off the right edge on the narrowest phone.
    expect(logger.modeCount, 'the logger shows its four ways in').toBe(4)
    expect(logger.noHorizontalOverflow, 'the logger never scrolls sideways').toBe(true)
    expect(logger.lastModeRight).toBeLessThanOrEqual(logger.scRight + 1)
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
  // tetejéhez és a küszöb (14px) fölött kompakt magasságra (--mzh-head-cond-h: 46px) húzódik;
  // a lap saját sticky chrome-ja (`.sticky-top`) ehhez képest tapad ki, sosem csúszhat a
  // fejléc alá; a fejléc nélküli oldalakon (AppLayout.tsx hideChrome) viszont nincs mi alá
  // tapadni, ott a `.sticky-top`-nak a görgetőport tetejéhez KELL tapadnia (top ≈ 0), nem
  // 46px-cel lejjebb.
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
  expect(withHead.headHeight, 'a kompakt fejléc magassága a --mzh-head-cond-h token (46px)').toBe(46)
  if (withHead.stickyTopBelowHead !== null) {
    expect(
      withHead.stickyTopBelowHead,
      'a lap .sticky-top-ja nem csúszhat a fejléc alá'
    ).toBeGreaterThanOrEqual(0)
  }

  // Chrome nélküli oldal: nincs .app-head, a .sticky-top a görgetőport tetejéhez tapad,
  // NEM 46px-cel lejjebb (az 1. finding regressziója: üres sáv a lap tetején).
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
  // Fuel Titanium (mezo-qt5q): `/fuel/log` is retired — the day's blocks live on the Mai, and
  // an unlogged block is the door into the camera-first logger. From there the Gépelés route
  // owns the manual pickers (S1c.2, mezo-33k6) → Kamra source tile → picker.
  await page.goto('/fuel')
  await page.waitForLoadState('networkidle')
  await page.locator('.fmx-block:not(.is-done) .fmx-block-log').first().click()
  await page.waitForURL(/\/fuel\/log\/uj/)
  await page.getByRole('tab', { name: /Gépelés/ }).click()
  await page.getByRole('button', { name: 'Kamra · hozzáadás' }).click()
  const rows = page.locator('.fkp-item')
  await expect(rows.first()).toBeVisible()
  const heights = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))
  expect(heights.length).toBeGreaterThan(4)
  // A healthy row is ~114px; the squash bug collapsed every row to ~20px.
  expect(Math.min(...heights)).toBeGreaterThan(60)
})

for (const width of [320, 390, 430]) {
  test(`Stack hub stays contained and reachable @ ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 })
    await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
    await page.goto('/fuel/stack')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const scroller = page.locator('.screen-content')
    const size = await scroller.evaluate(element => ({
      scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
    }))
    expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth + 1)

    // Fuel Titanium S2 (mezo-g2vl): a négy csempés mozaik helyén a mai lista idősávokban áll,
    // alatta a KÉT ajtó (Protokoll, Új elem). A kikötés változatlan: minden elérhető marad.
    for (const name of [/Protokoll/, /Új elem/]) {
      await expect(page.getByRole('button', { name }).first()).toBeVisible()
    }
    const lastTile = page.locator('.fsx-poster').last()
    await lastTile.scrollIntoViewIfNeeded()
    await expect(lastTile).toBeVisible()

    const check = page.locator('.fsx-check').first()
    const box = await check.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })
}

// Fuel Titanium (mezo-qt5q): `/fuel/stack/today`, `/fuel/stack/meals` and the four `manage/*`
// pages are RETIRED — they redirect now, so "the last card of that page" no longer names
// anything. The invariant they protected (the last row is reachable above the shell chrome)
// moves to the pages that actually carry the depth today, the new destinations included.
const FUEL_DEPTH: Array<[string, string]> = [
  ['/fuel', '.fmx-block'],
  ['/fuel/stack', '.fsx-poster'],
  ['/fuel/stack/protocol', '.fsx-proto-line'],
  ['/fuel/trendek', '.ftx-pattern, .ftx-horizon'],
  ['/fuel/konyha', '.fkx-poster'],
]

for (const [path, lastSelector] of FUEL_DEPTH) {
  test(`Fuel page last card stays above shell chrome · ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 })
    await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const last = page.locator(lastSelector).last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeVisible()
    const reachable = await last.evaluate(element => {
      const scroller = document.querySelector('.screen-content')!.getBoundingClientRect()
      const tabbar = document.querySelector('.tab-bar')?.getBoundingClientRect()
      const card = element.getBoundingClientRect()
      const visibleBottom = Math.min(scroller.bottom, tabbar?.top ?? scroller.bottom)
      return { top: card.top, bottom: card.bottom, viewportTop: scroller.top, visibleBottom }
    })
    expect(reachable.top).toBeGreaterThanOrEqual(reachable.viewportTop - 1)
    expect(reachable.bottom).toBeLessThanOrEqual(reachable.visibleBottom + 1)
  })
}

// Cél command centre (mezo-ricj.6): the approved artifact is a seven-screen system, not
// one pretty hub. Pin the whole route family at the three widths in the handoff so a detail
// card, plan lane or decision row can never quietly widen the document on a smaller phone.
const GOAL_ROUTES: Array<[string, string]> = [
  ['hub', '/me/goals/weight'],
  ['diet', '/me/goals/weight/diet'],
  ['segment', '/me/goals/weight/segment'],
  ['plans', '/me/goals/weight/plans'],
  ['guards', '/me/goals/weight/guards'],
  ['settings', '/me/goals/weight/settings'],
  ['suggestion', '/me/goals/weight/suggestions/sug-weekly-w17'],
]

for (const width of [320, 390, 430]) {
  for (const [name, path] of GOAL_ROUTES) {
    test(`Cél · ${name} stays inside the viewport @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 820 })
      await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => document.fonts.ready)

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }
}

test('Cél suggestion keeps every before/after value on one baseline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 })
  await page.goto('/me/goals/weight/suggestions/sug-weekly-w17')
  await page.waitForLoadState('networkidle')
  const offsets = await page.locator('.gdiff-row').evaluateAll(rows => rows.map(row => {
    const current = row.querySelector('.gdiff-current strong')!.getBoundingClientRect()
    const proposed = row.querySelector('.gdiff-proposed strong')!.getBoundingClientRect()
    return Math.abs(current.top - proposed.top)
  }))
  expect(offsets.length).toBeGreaterThan(0)
  for (const offset of offsets) expect(offset).toBeLessThanOrEqual(1)
})

test('Cél suggestion primary decision stays clear of the shell tabbar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.goto('/me/goals/weight/suggestions/sug-weekly-w17')
  await page.waitForLoadState('networkidle')
  const apply = page.locator('.gs-apply')
  await apply.scrollIntoViewIfNeeded()
  const spacing = await page.evaluate(() => {
    const cta = document.querySelector('.gs-apply')!.getBoundingClientRect()
    const tabbar = document.querySelector('.tab-bar')!.getBoundingClientRect()
    return { ctaBottom: cta.bottom, tabbarTop: tabbar.top }
  })
  expect(spacing.ctaBottom).toBeLessThanOrEqual(spacing.tabbarTop - 1)
})

test('Cél diet kcal values remain readable at 200% text size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 })
  await page.goto('/me/goals/weight/diet')
  await page.waitForLoadState('networkidle')
  // Browser text-only zoom scales glyphs without enlarging the containing cards. Chromium
  // does not expose that user preference directly, so reproduce its relevant pressure on
  // every kcal datum and assert both wrapping/reflow and clipping explicitly.
  await page.addStyleTag({ content: `
    .mz-bignum, .goal-diet-comparison strong, .goal-diet-uniform strong {
      font-size: 200% !important;
    }
  ` })
  const kcal = page.getByText(/kcal$/)
  expect(await kcal.count()).toBeGreaterThan(0)
  const clipped = await kcal.evaluateAll(values => values.map(value => {
    const element = value as HTMLElement
    const box = element.getBoundingClientRect()
    const parent = element.parentElement!.getBoundingClientRect()
    const style = getComputedStyle(element)
    return style.overflow === 'hidden'
      || box.left < parent.left - 1
      || box.right > parent.right + 1
  }))
  expect(clipped).not.toContain(true)
})

// ── Fuel: hosszú nevek nem feszíthetik szét a kártyát (mezo-jb84) ────────────────────────────
// Éles hiba volt: a napló valódi étel-nevei hosszabbak a demó-napénál, és egy „Csirke alsócomb
// bőrrel, sült, Édesburgonya…" sor 375 px-es sávban 667 px-esre feszítette a blokkot — a kártya
// jobb széle egyszerűen levágódott. Ugyanez jött vissza a Receptek, a Kamra és a recept-részletek
// lapján is. A levágás (`nowrap` + `ellipsis`) rendben volt; a SÁV nem: egy grid- vagy flex-gyerek
// alapértelmezett `min-width: auto`-ja a teljes szöveget engedi min-contentnek.
//
// A kör MINDEN felhasználói szöveget hosszúra cserél — nem csak az egysorosakat —, és megköveteli,
// hogy a lap attól se kezdjen oldalra görögni. A tördelhető szöveg ettől csak magasabb lesz; ami
// szélesedik, az a hiba. A ház statikus felirat-primitívjei (eyebrow / label-mono / overline) ki
// vannak hagyva: azok fix szövegek, ellenük védekezni semmi ellen védekezés volna.
const LONG = 'Csirke alsócomb bőrrel sült Édesburgonya sütve brokkoli párolva olívaolajjal és magvakkal'

for (const path of ['/fuel', '/fuel/stack', '/fuel/stack/protocol', '/fuel/trendek',
  '/fuel/konyha', '/fuel/recipes', '/fuel/kamra', '/fuel/log/uj']) {
  test(`Fuel · hosszú nevek sem feszítik szét a lapot · ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    // A lapok a saját adatukra várnak: `networkidle` után is állhatnak még csontvázon.
    await page.waitForFunction(() => {
      const scroller = document.querySelector('.screen-content')
      return !!scroller && scroller.textContent!.trim().length > 120
    }, undefined, { timeout: 10_000 }).catch(() => {
      throw new Error(`${path} 10 mp után sem rendert érdemi tartalmat — a kör vakon futna.`)
    })

    const stretched = await page.evaluate((long: string) => {
      const scroller = document.querySelector('.screen-content') as HTMLElement
      // Vízszintesen görgethető sávon belül az átlógás SZÁNDÉKOS — azt nem bántjuk.
      const inScrollX = (el: Element) => {
        for (let p = el.parentElement; p && p !== scroller; p = p.parentElement) {
          if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return true
        }
        return false
      }
      let touched = 0
      for (const el of Array.from(scroller.querySelectorAll('*'))) {
        if (el.children.length) continue
        const text = el.textContent?.trim()
        if (!text) continue
        if (el.closest('.eyebrow, .label-mono, .overline, .fmx-score')) continue
        if (inScrollX(el)) continue
        // Csak a NÉV-szerű szövegeket nyújtjuk: egy számjegy, egy mértékegység vagy egy rövid
        // chip sosem lesz hosszú, és ellenük védekezni semmi ellen védekezés volna.
        if (text.length < 10) continue
        el.textContent = long
        touched += 1
      }
      return touched
    }, LONG)

    await page.waitForTimeout(120)
    const size = await page.locator('.screen-content').evaluate(el => ({
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
    }))
    // A csere darabszáma nem KÖVETELMÉNY: van lap, ahol minden szöveg rövid (számok, chipek).
    // Ott a kör a természetes elrendezést méri, ami ugyanilyen érvényes állítás — a lényeg, hogy
    // a lap SEMMILYEN tartalommal ne kezdjen oldalra görögni.
    expect(
      size.scrollWidth,
      `${path} vízszintesen görög (${size.scrollWidth}px a ${size.clientWidth}px-es sávban); `
      + `${stretched} hosszúra cserélt szöveggel`
    ).toBeLessThanOrEqual(size.clientWidth + 1)
  })
}
