import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/**
 * Folyadék F2 (mezo-n4wf5.2) — the Nap domain in the new skin, every converted route at the two
 * phone widths the programme designs for (390) and must survive (320). One parametrised block,
 * the same handful of invariants per route:
 *
 *  - the page scroller never scrolls sideways;
 *  - the hero (a `.fo-hero` card or a `.fo-tank`) lies inside the viewport's width;
 *  - at 390 no `.fo-btn` label wraps onto a second line;
 *  - the frame is the right one: a HUB page has the title bar with the domain's four top tabs and
 *    no back button, a SUB-page has back + title and no tabs, both keep the five-drop bottom bar;
 *    the Napzárás (`/ritual`) is chrome-free and LIGHT, with its foot bar's primary button
 *    visible and on top;
 *  - the last block of the page (or its foot bar) can be scrolled clear of the bottom bar;
 *  - the quick-log button is there exactly where it should be.
 *
 * Mock mode, frozen clock: 2026-05-21 13:42 is the mock's live day (see layout.spec.ts · A napom).
 */

type Frame =
  | { kind: 'hub'; tab: 'Mai' | 'A napom' | 'Beszélgetés' | 'Rutin'; title: string }
  | { kind: 'sub'; title: string | RegExp }
  | { kind: 'bare' }

interface NapRoute { path: string; frame: Frame; fab: boolean; hero?: false }

const ROUTES: NapRoute[] = [
  { path: '/nap', frame: { kind: 'hub', tab: 'Mai', title: 'Ma' }, fab: false },
  { path: '/nap/napom', frame: { kind: 'hub', tab: 'A napom', title: 'A napom' }, fab: true },
  // a past day keeps the hub face: top tabs shown, no back button (was a sub-page before F2)
  { path: '/nap/napom/2026-05-18', frame: { kind: 'hub', tab: 'A napom', title: 'A napom' }, fab: true },
  { path: '/nap/uzenetek', frame: { kind: 'hub', tab: 'Beszélgetés', title: 'Beszélgetés' }, fab: true },
  { path: '/nap/rutin', frame: { kind: 'hub', tab: 'Rutin', title: 'Rutin' }, fab: true },
  { path: '/nap/eletjel', frame: { kind: 'sub', title: 'Életjelek' }, fab: true },
  { path: '/nap/kuldetesek', frame: { kind: 'sub', title: 'Napi küldetések' }, fab: true },
  { path: '/nap/checkin', frame: { kind: 'sub', title: 'Check-in' }, fab: true },
  // the picker page has no hero: its body is the quick-log grid itself
  { path: '/nap/gyors', frame: { kind: 'sub', title: 'Gyors logolás' }, fab: false, hero: false },
  { path: '/nap/rutin/epites', frame: { kind: 'sub', title: 'Rutinok' }, fab: true },
  { path: '/nap/rutin/lanc/MORNING', frame: { kind: 'sub', title: 'Reggeli rutin lánc' }, fab: true },
  { path: '/nap/rutin/szokasok', frame: { kind: 'sub', title: 'Szokásaid' }, fab: true },
  { path: '/nap/rutin/szokas/morning_coffee', frame: { kind: 'sub', title: 'Gombakávé' }, fab: true },
  { path: '/nap/rutin/szokas/morning_coffee/szerkesztes', frame: { kind: 'sub', title: 'Szerkesztés' }, fab: true },
  // the new-habit wizard: its own foot bar, and no quick-log button over it
  { path: '/nap/rutin/uj', frame: { kind: 'sub', title: /.+/ }, fab: false },
  { path: '/ritual', frame: { kind: 'bare' }, fab: false },
]

const WIDTHS = [{ width: 390, height: 844 }, { width: 320, height: 700 }]

async function open(page: Page, path: string) {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
  await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
  // yesterday's review marked seen, so /nap/napom renders the live day, not morning mode
  await page.addInitScript(() => { localStorage.setItem('napom.seen.2026-05-20', '1') })
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.fo-page')).toBeVisible()
}

for (const vp of WIDTHS) {
  for (const route of ROUTES) {
    test(`Nap · Folyadék · ${route.path} @ ${vp.width}px: contained, hero in view, the right frame`, async ({ page }) => {
      await page.setViewportSize(vp)
      await open(page, route.path)

      const m = await page.evaluate(() => {
        const sc = document.querySelector('.screen-content') as HTMLElement
        const shown = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
        // text lines of a button: distinct line boxes of its text nodes (an icon is not a line)
        const lines = (el: Element) => {
          const tops: number[] = []
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent?.trim()) continue
            const range = document.createRange()
            range.selectNodeContents(n)
            for (const r of Array.from(range.getClientRects())) if (r.width > 1) tops.push(r.top)
          }
          tops.sort((a, b) => a - b)
          return tops.reduce((count, top, i) => count + (i === 0 || top - tops[i - 1] > 6 ? 1 : 0), 0)
        }
        return {
          pageOverflow: sc.scrollWidth - sc.clientWidth,
          docOverflow: document.documentElement.scrollWidth - innerWidth,
          heroes: Array.from(document.querySelectorAll('.fo-page .fo-hero, .fo-page .fo-tank')).filter(shown).map((el) => {
            const r = el.getBoundingClientRect()
            return { left: r.left, right: r.right, width: r.width }
          }),
          wrapped: Array.from(document.querySelectorAll('.fo-btn')).filter(shown).filter((el) => lines(el) > 1).map((el) => el.textContent),
          viewport: innerWidth,
        }
      })
      expect(m.pageOverflow, 'the page scroller scrolls sideways').toBeLessThanOrEqual(1)
      expect(m.docOverflow, 'the document scrolls sideways').toBeLessThanOrEqual(0)
      if (route.hero === false) {
        await expect(page.locator('.quicklog')).toBeVisible()
        const box = (await page.locator('.quicklog').boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5)
      } else {
        expect(m.heroes.length, 'the page opens with a hero').toBeGreaterThan(0)
        for (const hero of m.heroes) {
          expect(hero.left).toBeGreaterThanOrEqual(-0.5)
          expect(hero.right).toBeLessThanOrEqual(m.viewport + 0.5)
          expect(hero.width).toBeGreaterThan(m.viewport * 0.8)
        }
      }
      if (vp.width === 390) expect(m.wrapped, 'a .fo-btn label wraps at 390').toEqual([])
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')

      // ── the frame ──────────────────────────────────────────────────────────────────────────
      const nav = page.getByRole('navigation', { name: 'Területek', exact: true })
      const { frame } = route
      if (frame.kind === 'bare') {
        // Napzárás: no title bar, no bottom bar — its own foot bar carries the way forward.
        await expect(page.locator('.fo-top, .fo-nav, .fo-fab')).toHaveCount(0)
        const primary = page.locator('.fo-foot .fo-btn')
        await expect(primary).toHaveCount(1)
        await expect(primary).toBeVisible()
        await expect(primary).toBeInViewport({ ratio: 1 })
        const foot = await page.evaluate(() => {
          const btn = document.querySelector('.fo-foot .fo-btn') as HTMLElement
          const r = btn.getBoundingClientRect()
          const others = Array.from(document.querySelectorAll('.fo-foot button')).filter((b) => b !== btn).map((b) => b.getBoundingClientRect())
          const hit = (x: number, y: number) => { const el = document.elementFromPoint(x, y); return el === btn || btn.contains(el) }
          return {
            height: r.height, left: r.left, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight,
            // nothing lies over it: its centre and the middle of each edge hit the button itself
            // (not the corners — the pill's rounding leaves them outside the button's own shape)
            onTop: [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 6, r.top + r.height / 2], [r.right - 6, r.top + r.height / 2],
              [r.left + r.width / 2, r.top + 4], [r.left + r.width / 2, r.bottom - 4]].every(([x, y]) => hit(x, y)),
            clearOfSiblings: others.every((o) => o.right <= r.left + 0.5 || o.left >= r.right - 0.5 || o.bottom <= r.top + 0.5 || o.top >= r.bottom - 0.5),
          }
        })
        expect(foot.height).toBeGreaterThanOrEqual(44)
        expect(foot.left).toBeGreaterThanOrEqual(0)
        expect(foot.right).toBeLessThanOrEqual(foot.vw + 0.5)
        expect(foot.bottom).toBeLessThanOrEqual(foot.vh + 0.5)
        expect(foot.onTop, 'something covers the foot bar\'s primary button').toBe(true)
        expect(foot.clearOfSiblings, 'the primary button overlaps another foot control').toBe(true)
        return
      }

      await expect(nav).toBeVisible()
      await expect(nav.getByRole('link')).toHaveCount(5)
      await expect(nav.locator('[aria-current="true"]')).toHaveText('Nap')
      const bar = page.locator('.fo-top')
      await expect(bar).toBeVisible()
      await expect(bar.getByRole('heading', { level: 1 })).toHaveText(frame.title)
      const tabs = page.getByRole('navigation', { name: 'Nap oldalai', exact: true })
      if (frame.kind === 'hub') {
        await expect(page.locator('.fo-top.sub')).toHaveCount(0)
        await expect(tabs.getByRole('link')).toHaveCount(4)
        await expect(tabs.locator('[aria-current="page"]')).toHaveCount(1)
        await expect(tabs.locator('[aria-current="page"]')).toContainText(frame.tab)
        await expect(page.getByRole('button', { name: /^Vissza/ })).toHaveCount(0)
      } else {
        await expect(page.locator('.fo-top.sub')).toHaveCount(1)
        await expect(tabs).toHaveCount(0)
        await expect(bar.locator('.fo-tabs')).toHaveCount(0)
        await expect(bar.getByRole('button', { name: 'Vissza' })).toBeVisible()
        // the context line above the title says where the sub-page belongs (never empty)
        await expect(bar.locator('.fo-title small')).toHaveText(/\S/)
        const row = await bar.evaluate((el) => {
          const box = (s: string) => el.querySelector(s)!.getBoundingClientRect()
          return { backRight: box('.fo-back').right, titleLeft: box('.fo-title').left }
        })
        expect(row.backRight).toBeLessThanOrEqual(row.titleLeft + 0.5)
      }

      await expect(page.locator('.fo-fab')).toHaveCount(route.fab ? 1 : 0)

      // ── the end of the page clears the bottom bar (the foot bar, where the page has one) ───
      const end = await page.evaluate(() => {
        const sc = document.querySelector('.screen-content') as HTMLElement
        sc.style.scrollBehavior = 'auto'
        sc.scrollTop = sc.scrollHeight
        const pageEl = document.querySelector('.fo-page') as HTMLElement
        const last = (pageEl.querySelector(':scope > .fo-foot') ?? pageEl.lastElementChild) as HTMLElement
        return { bottom: last.getBoundingClientRect().bottom, navTop: document.querySelector('.fo-nav')!.getBoundingClientRect().top, last: last.className }
      })
      expect(end.bottom, `the page's last block (.${end.last}) ends under the bottom bar`).toBeLessThanOrEqual(end.navTop - 1)
    })
  }
}

// ── Reduced motion: the levels stand at their final height, nothing waits for an entrance ──────
// The harness already runs with `reducedMotion: 'reduce'` (playwright.config.ts); it is set here
// again so the test says what it depends on. A level that only reaches its height through an
// animation, or a block whose entrance starts at `opacity: 0`, would be measured empty/invisible.
for (const path of ['/nap', '/nap/rutin']) {
  test(`Nap · Folyadék · ${path} under reduced motion: levels at their final height, nothing stuck invisible`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, path)
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)

    const measure = () => page.evaluate(() => {
      const shown = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      const size = (s: string) => Array.from(document.querySelectorAll(s)).map((el) => {
        const r = el.getBoundingClientRect()
        return `${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10}`
      })
      const root = document.querySelector('.fo-page')!
      return {
        // every liquid the page draws: tank body, vial columns, level bars, mini capsules
        levels: size('.fo-page .fo-tank-liq, .fo-page .fo-tube > .l, .fo-page .fo-level > i, .fo-page .fo-mini .t > i'),
        filled: Array.from(document.querySelectorAll('.fo-page .fo-tank-liq, .fo-page .fo-tube > .l, .fo-page .fo-level > i')).filter(shown).length,
        invisible: Array.from(root.querySelectorAll('*')).filter(shown).filter((el) => getComputedStyle(el).opacity === '0')
          .map((el) => `${el.tagName.toLowerCase()}.${typeof el.className === 'string' ? el.className : ''}`),
        hidden: Array.from(root.querySelectorAll('.fo-hero, .fo-tank, .fo-card, .fo-sec')).filter((el) => getComputedStyle(el).visibility === 'hidden').length,
        running: document.getAnimations().filter((a) => a.playState === 'running' && root.contains((a.effect as KeyframeEffect | null)?.target ?? null)).length,
      }
    })

    const first = await measure()
    expect(first.levels.length, 'the page draws levels').toBeGreaterThan(0)
    expect(first.filled, 'at least one level holds liquid on arrival').toBeGreaterThan(0)
    expect(first.invisible, 'a rendered block is stuck at opacity 0').toEqual([])
    expect(first.hidden).toBe(0)
    expect(first.running, 'an animation still runs under reduced motion').toBe(0)
    // ...and they are FINAL: nothing grows after arrival
    await page.waitForTimeout(900)
    const later = await measure()
    expect(later.levels).toEqual(first.levels)
    expect(later.invisible).toEqual([])
  })
}
