import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/**
 * Folyadék F5 (mezo-n4wf5.5) — the Fuel domain in the new skin AND in both languages: every hub and every
 * sub-page mock mode can open, at the width the programme designs for (390) and the one it must survive (320),
 * in Hungarian and in English (the mock account follows the device cache `mezo-lang`, bible N1.11 — the same
 * switch `language-en.spec.ts` uses). One parametrised block, the same invariants per route:
 *
 *  - the page scroller (and the document) never scrolls sideways;
 *  - at 390 no `.fo-btn` label wraps onto a second line;
 *  - every sprite `<use>` points at a symbol that exists (a missing icon renders as nothing, silently);
 *  - the page opens with exactly ONE hero (`.fo-hero`) — the ranking the old „depth & focus" guards pinned;
 *  - the frame is the right one: a hub has the four top tabs and no back button, a sub-page back + title;
 *  - nothing inside the page wears the retired skin (`fmx- fkx- fsx- ftx- fset- …`, `.glass`, `.uv-*`, `.mz-page`);
 *  - the console stays clean;
 *  - in English no visible text carries a Hungarian accented letter — except what the USER or the SERVER
 *    stored with a record (see `storedNames` and `SERVER_PROSE`), and a short list of unaccented Hungarian
 *    words never stands alone as a button, link or heading (bible N1.13: the accent detector cannot see them);
 *  - the last block of the page can be scrolled clear of the bottom bar.
 *
 * Every loop asserts that its set is NOT EMPTY, or states the zero on purpose (bible N1.7).
 * Mock mode, frozen clock: 2026-05-21 13:42 is the mock's live day.
 */

interface FuelRoute {
  path: string
  hub?: true
  /** `.fo-btn` controls the page shows on arrival (same count in both languages). 0 is stated on purpose. */
  btns: number
  /** the quick-log button is hidden on pages with their own bottom action bar */
  fab: boolean
  /** Settings pages are drawn without the five-drop bar (`nonav`) */
  nav?: false
}

const ROUTES: FuelRoute[] = [
  { path: '/fuel', hub: true, btns: 3, fab: true },
  { path: '/fuel/stack', hub: true, btns: 1, fab: true },
  // Trendek acts through its week stepper, the day vessels and the pattern rows — no kit button
  { path: '/fuel/trendek', hub: true, btns: 0, fab: true },
  { path: '/fuel/konyha', hub: true, btns: 1, fab: true },
  { path: '/fuel/log/uj', btns: 2, fab: false },
  { path: '/fuel/etkezes/m1', btns: 1, fab: true },
  { path: '/fuel/etkezes/m1/ertekeles', btns: 1, fab: true },
  { path: '/fuel/tanulas', btns: 1, fab: true },
  { path: '/fuel/stack/protocol', btns: 1, fab: true },
  // step 1 of the add wizard is a search field and a list of rows — no kit button until step 2
  { path: '/fuel/stack/manage/add', btns: 0, fab: false },
  { path: '/fuel/gyogyszer', btns: 1, fab: true },
  { path: '/fuel/kamra', btns: 2, fab: true },
  { path: '/fuel/kamra/ing-tojas', btns: 1, fab: true },
  { path: '/fuel/recipes', btns: 1, fab: true },
  { path: '/fuel/recipes/rec-1', btns: 2, fab: true },
  { path: '/fuel/recipes/rec-1/ertekeles', btns: 1, fab: true },
  { path: '/fuel/recipes/new', btns: 3, fab: false },
  // the Műhely talks through its goal pills and the composer's round send button
  { path: '/fuel/recipes/muhely', btns: 0, fab: true },
  { path: '/settings/fuel', btns: 1, fab: false, nav: false },
  { path: '/settings/fuel/slots', btns: 1, fab: false, nav: false },
]

const WIDTHS = [{ width: 390, height: 844 }, { width: 320, height: 700 }]
const LANGS = ['hu', 'en'] as const

/** Classes of the retired Fuel skin and of the dark glass world: none may be worn inside a Fuel page. */
const OLD_SKIN = ['fmx-', 'fkx-', 'fkk-', 'fsx-', 'fmd-', 'ftx-', 'fset-', 'fsl-', 'fcx-', 'fln-', 'fwl-', 'flp-', 'fkp-', 'stk-',
  'logflow-', 'flognew-', 'wsh-', 'uvl-'].map((p) => `[class*="${p}"]`).join(', ') + ', .glass, .uv-halo, .uv-flat, .uv-empty, .uv-sheet, .mz-page'

/**
 * English, allowlist 1 — names the USER stored (recipes, pantry items and their brands, supplements, logged meals)
 * and the titles of stored patterns. They are data: they stay as typed whatever the app language is. Read from the
 * mock seed files themselves (the `name:` / `brand:` / `title:` values), so the list cannot drift from the seed and
 * holds nothing that is not there.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))
const SEED_FILES = ['data/fuel/fuel.ts', 'data/fuel/pantry.ts', 'data/insights/insights.ts']
const HU = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/
const storedNames = Array.from(new Set(SEED_FILES.flatMap((file) => {
  const src = readFileSync(path.resolve(HERE, '../../src', file), 'utf8')
  return Array.from(src.matchAll(/\b(?:name|brand|title)\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/g)).map((m) => m[2])
}).filter((name) => HU.test(name)))).sort((a, b) => b.length - a.length)

/**
 * English, allowlist 2 — prose the SERVER wrote into a record when it was saved (the rating's dimension rows and
 * tips, the meal's / recipe's summary sentence, a supplement's timing reason). On the real backend these follow the
 * account language at write time (7810fbeb7); the mock seed stores them in Hungarian. Selectors, not texts.
 */
const SERVER_PROSE = [
  '.fe-page .fo-hero-sub', // the stored summary of a meal / recipe on its page and its rating page
  '.fe-dims', // the eight rating aspects: stored label + stored reading
  '.fe-impc', // the rating's stored tips
  '.fc-page .fo-txt', // a recipe's stored summary
  '.fk-list .fo-row .g > small', // the protocol: each item's stored timing reason
].join(', ')
/** Known leftover, not Fuel's: the insights domain's feedback chips („Segített / Nem talált") are converted with Mezo (bible F2.12). */
const NOT_CONVERTED = '.fbk-chips'

/** N1.13 — unaccented Hungarian the accent detector cannot see: never the whole text of a control or a heading in English. */
const HU_WORDS = ['Mai', 'Ma', 'Tegnap', 'Kamra', 'Recept', 'Receptek', 'Konyha', 'Trendek', 'Vissza', 'Mentés', 'Reggeli', 'Vacsora',
  'Uzsonna', 'Mind', 'Protokoll', 'Bevettem', 'Kihagyom', 'Logolás', 'Adag', 'Keret']

async function open(page: Page, route: string, lang: 'hu' | 'en') {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
  if (lang === 'en') await page.addInitScript(() => localStorage.setItem('mezo-lang', 'en'))
  await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
  await page.goto(route)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.screen-content .fo-page')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', lang)
}

/** Where the lit top tab sits in its row: the air on each side (negative = cut off), and whether the row scrolls. */
const litTab = (page: Page) => page.evaluate(() => {
  const nav = document.querySelector('.fo-top .fo-tabs') as HTMLElement
  const row = nav.getBoundingClientRect()
  const pill = nav.querySelector('a[aria-current="page"]')!.getBoundingClientRect()
  return { left: Math.round(pill.left - row.left), right: Math.round(row.right - pill.right), scrolls: nav.scrollWidth > nav.clientWidth + 1, scrollLeft: nav.scrollLeft, name: nav.querySelector('a[aria-current="page"]')!.textContent }
})

for (const lang of LANGS) {
  for (const vp of WIDTHS) {
    for (const route of ROUTES) {
      test(`Fuel · Folyadék · ${lang} · ${route.path} @ ${vp.width}px: contained, one hero, icons whole, no old skin`, async ({ page }) => {
        const errors: string[] = []
        page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
        page.on('pageerror', (err) => errors.push(`uncaught: ${err.message}`))
        await page.setViewportSize(vp)
        await open(page, route.path, lang)

        const m = await page.evaluate(({ oldSkin }) => {
          const sc = document.querySelector('.screen-content') as HTMLElement
          const pg = sc.querySelector('.fo-page') as HTMLElement
          const shown = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
          // text lines of a button: distinct line boxes of its text nodes (an icon is not a line)
          const lines = (el: Element) => {
            const tops: number[] = []
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              if (!n.textContent?.trim()) continue
              // a button's second line on purpose (`+ Logolás ide` / `még ráér`) is a <small> under the label
              if (n.parentElement?.closest('small')) continue
              const range = document.createRange()
              range.selectNodeContents(n)
              for (const r of Array.from(range.getClientRects())) if (r.width > 1) tops.push(r.top)
            }
            tops.sort((a, b) => a - b)
            return tops.reduce((count, top, i) => count + (i === 0 || top - tops[i - 1] > 6 ? 1 : 0), 0)
          }
          const btns = Array.from(pg.querySelectorAll('.fo-btn')).filter(shown)
          const uses = Array.from(document.querySelectorAll('.screen-content use, .fo-nav use'))
          return {
            pageOverflow: sc.scrollWidth - sc.clientWidth,
            docOverflow: document.documentElement.scrollWidth - innerWidth,
            heroes: Array.from(pg.querySelectorAll('.fo-hero')).filter(shown).map((el) => {
              const r = el.getBoundingClientRect()
              return { left: r.left, right: r.right, width: r.width }
            }),
            btns: btns.length,
            wrapped: btns.filter((el) => lines(el) > 1).map((el) => el.textContent),
            controls: Array.from(pg.querySelectorAll('button, a, input, textarea')).filter(shown).length,
            uses: uses.length,
            missing: uses.map((u) => u.getAttribute('href') ?? u.getAttribute('xlink:href') ?? '(no href)')
              .filter((href) => !href.startsWith('#') || !document.getElementById(href.slice(1))),
            old: Array.from(pg.querySelectorAll(oldSkin)).map((el) => `${el.tagName.toLowerCase()}.${typeof el.className === 'string' ? el.className : ''}`),
            viewport: innerWidth,
          }
        }, { oldSkin: OLD_SKIN })

        expect(m.pageOverflow, 'the page scroller scrolls sideways').toBeLessThanOrEqual(1)
        expect(m.docOverflow, 'the document scrolls sideways').toBeLessThanOrEqual(0)
        expect(m.heroes.length, 'a Fuel page opens with exactly one hero').toBe(1)
        expect(m.heroes[0].left).toBeGreaterThanOrEqual(-0.5)
        expect(m.heroes[0].right).toBeLessThanOrEqual(m.viewport + 0.5)
        expect(m.heroes[0].width).toBeGreaterThan(m.viewport * 0.8)
        // the wrap check measures a known, non-empty set — or a zero stated in ROUTES, with the page's other
        // controls standing in so a blank page cannot pass
        expect(m.btns, 'the number of kit buttons on arrival').toBe(route.btns)
        expect(m.controls, 'the page offers something to act on').toBeGreaterThan(0) // the empty Gyógyszer page: its one button
        if (vp.width === 390) expect(m.wrapped, 'a .fo-btn label wraps at 390').toEqual([])
        expect(m.uses, 'the page draws icons from the sprite').toBeGreaterThan(0)
        expect(m.missing, 'a sprite <use> points at a symbol that does not exist').toEqual([])
        expect(m.old, 'an element still wears the retired skin').toEqual([])
        await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')

        // ── the frame ────────────────────────────────────────────────────────────────────────
        const bar = page.locator('.fo-top')
        await expect(bar.getByRole('heading', { level: 1 })).toHaveText(/\S/)
        await expect(page.locator('h1')).toHaveCount(1)
        if (route.hub) {
          await expect(page.locator('.fo-top.sub')).toHaveCount(0)
          await expect(bar.locator('.fo-tabs a')).toHaveCount(4)
          await expect(bar.locator('.fo-tabs a[aria-current="page"]')).toHaveCount(1)
          await expect(bar.locator('.fo-back')).toHaveCount(0)
          // the lit tab is whole inside the row's visible box, whatever the row had to scroll (bible F5.5)
          const lit = await litTab(page)
          expect(lit.left, 'the lit tab starts left of the tab row').toBeGreaterThanOrEqual(0)
          expect(lit.right, 'the lit tab ends right of the tab row').toBeGreaterThanOrEqual(0)
        } else {
          await expect(page.locator('.fo-top.sub')).toHaveCount(1)
          await expect(bar.locator('.fo-tabs')).toHaveCount(0)
          await expect(bar.locator('.fo-back')).toBeVisible()
          await expect(bar.locator('.fo-title small')).toHaveText(/\S/)
        }
        await expect(page.locator('.fo-fab')).toHaveCount(route.fab ? 1 : 0)
        await expect(page.locator('.fo-nav')).toHaveCount(route.nav === false ? 0 : 1)

        // ── English: nothing Hungarian is left on the screen but what was stored with a record ────────
        if (lang === 'en') {
          const text = await page.evaluate(({ names, prose, skip, words }) => {
            const shown = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
            const HU = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/
            const roots = [document.querySelector('.screen-content .fo-page')!, document.querySelector('.fo-top .fo-title')!]
            const left: string[] = []
            let seen = 0
            for (const root of roots) {
              const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
              for (let n = walker.nextNode(); n; n = walker.nextNode()) {
                const el = n.parentElement!
                const raw = n.textContent?.trim() ?? ''
                if (!raw || !shown(el)) continue
                seen++
                if (!HU.test(raw) || el.closest(prose) || el.closest(skip)) continue
                // a stored name may sit inside a catalogue sentence („<recipe> · today"): take the names out, the rest must be clean
                let rest = raw
                for (const name of names) rest = rest.split(name).join(' ')
                if (HU.test(rest)) left.push(raw)
              }
            }
            const alone = Array.from(document.querySelectorAll('.screen-content .fo-page button, .screen-content .fo-page a, .screen-content .fo-page h2, .screen-content .fo-page h3, .fo-top h1, .fo-top .fo-tabs a'))
              .filter(shown).map((el) => (el.textContent ?? '').trim().replace(/\s*\d+$/, ''))
            return { seen, left, controls: alone.length, hungarian: alone.filter((t) => words.some((w) => w.toLowerCase() === t.toLowerCase())) }
          }, { names: storedNames, prose: SERVER_PROSE, skip: NOT_CONVERTED, words: HU_WORDS })
          expect(storedNames.length, 'the seed names were read').toBeGreaterThan(20)
          expect(text.seen, 'the page shows text to check').toBeGreaterThan(8)
          expect(text.left, 'Hungarian text on an English screen').toEqual([])
          expect(text.controls, 'controls and headings to check').toBeGreaterThan(1) // at least the title and one control
          expect(text.hungarian, 'a Hungarian word stands alone on a control or heading').toEqual([])
        }

        // ── the end of the page clears the bottom bar (the foot bar, where the page has one) ───────
        if (route.nav !== false) {
          const end = await page.evaluate(() => {
            const sc = document.querySelector('.screen-content') as HTMLElement
            sc.style.scrollBehavior = 'auto'
            sc.scrollTop = sc.scrollHeight
            const pageEl = sc.querySelector('.fo-page') as HTMLElement
            const last = (pageEl.querySelector(':scope > .fo-foot') ?? pageEl.lastElementChild) as HTMLElement
            return { bottom: last.getBoundingClientRect().bottom, navTop: document.querySelector('.fo-nav')!.getBoundingClientRect().top, last: last.className }
          })
          expect(end.bottom, `the page's last block (.${end.last}) ends under the bottom bar`).toBeLessThanOrEqual(end.navTop - 1)
        } else {
          // no bottom bar: the last block (or the page's own foot bar) ends inside the viewport
          const end = await page.evaluate(() => {
            const sc = document.querySelector('.screen-content') as HTMLElement
            sc.style.scrollBehavior = 'auto'
            sc.scrollTop = sc.scrollHeight
            const pageEl = sc.querySelector('.fo-page') as HTMLElement
            const last = (pageEl.querySelector(':scope > .fo-foot') ?? pageEl.lastElementChild) as HTMLElement
            return { bottom: last.getBoundingClientRect().bottom, vh: innerHeight }
          })
          expect(end.bottom).toBeLessThanOrEqual(end.vh + 0.5)
        }

        expect(errors, 'the console reported an error').toEqual([])
      })
    }
  }
}

// ── Reduced motion on the four hubs: the levels stand at their final height, nothing waits for an entrance ──
// The harness already runs with `reducedMotion: 'reduce'` (playwright.config.ts); it is set here again so the test
// says what it depends on. A level that only reaches its height through an animation, or a block whose entrance
// starts at `opacity: 0`, would be measured empty / invisible; an endless wave must not run at all.
for (const route of ROUTES.filter((r) => r.hub)) {
  test(`Fuel · Folyadék · ${route.path} under reduced motion: levels at their final height, nothing stuck invisible`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, route.path, 'hu')
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)

    const measure = () => page.evaluate(() => {
      const shown = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      const root = document.querySelector('.screen-content .fo-page')!
      // every liquid a Fuel hub draws: the hero's own graphic (bowl / capsules / week vessels / pot — SVG shapes and
      // the capsule / vessel fills), kit levels, level tiles
      const levels = Array.from(root.querySelectorAll('.fo-hero svg path, .fo-hero svg rect, .fo-hero svg circle, .fk-caps i, .fr-tb > i, .fo-level > i, .fo-stat.lv'))
      return {
        levels: levels.map((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10}@${Math.round(r.top)}` }),
        filled: levels.filter(shown).length,
        invisible: Array.from(root.querySelectorAll('*')).filter(shown).filter((el) => getComputedStyle(el).opacity === '0')
          .map((el) => `${el.tagName.toLowerCase()}.${typeof el.className === 'string' ? el.className : (el as SVGElement).className.baseVal}`),
        hidden: Array.from(root.querySelectorAll('.fo-hero, .fo-card, .fo-sec')).filter((el) => getComputedStyle(el).visibility === 'hidden').length,
        running: document.getAnimations().filter((a) => a.playState === 'running' && root.contains((a.effect as KeyframeEffect | null)?.target ?? null)).length,
      }
    })

    const first = await measure()
    expect(first.levels.length, 'the hub draws levels').toBeGreaterThan(0)
    expect(first.filled, 'at least one level holds liquid on arrival').toBeGreaterThan(0)
    expect(first.invisible, 'a rendered block is stuck at opacity 0').toEqual([])
    expect(first.hidden).toBe(0)
    expect(first.running, 'an animation still runs under reduced motion').toBe(0)
    // ...and they are FINAL: nothing grows or moves after arrival
    await page.waitForTimeout(900)
    const later = await measure()
    expect(later.levels).toEqual(first.levels)
    expect(later.invisible).toEqual([])
  })
}

// ── The four English tab names do not fit 320 px: the row scrolls, and the lit tab is always on screen (F5.5) ──
// A frame rule (app/TopTabs), checked where it bites: on arrival at each Fuel hub and after every switch, forwards
// and back, without the PAGE moving sideways. The row must really scroll here, or the check proves nothing.
test('Fuel · Folyadék · en @ 320px: the lit top tab is on screen on arrival and after every switch', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  const hubs = ROUTES.filter((r) => r.hub)
  expect(hubs.length).toBe(4)
  for (const hub of hubs) {
    await open(page, hub.path, 'en')
    const lit = await litTab(page)
    expect(lit.scrolls, 'the English tab row is wider than a 320 px screen').toBe(true)
    expect(lit.left, `${hub.path}: ${lit.name} starts left of the row on arrival`).toBeGreaterThanOrEqual(0)
    expect(lit.right, `${hub.path}: ${lit.name} ends right of the row on arrival`).toBeGreaterThanOrEqual(0)
  }
  // the last hub opened is Kitchen (the row is scrolled to its end): walk the tabs back and forth in place
  for (const name of ['Trends', 'Today', 'Kitchen', 'Supplements', 'Today']) {
    await page.locator('.fo-top .fo-tabs').getByRole('link', { name, exact: true }).click()
    await expect(page.locator('.fo-top .fo-tabs a[aria-current="page"]')).toHaveText(name)
    const lit = await litTab(page)
    expect(lit.left, `${name} starts left of the row after the switch`).toBeGreaterThanOrEqual(0)
    expect(lit.right, `${name} ends right of the row after the switch`).toBeGreaterThanOrEqual(0)
    expect(await page.evaluate(() => document.documentElement.scrollLeft + (document.querySelector('.screen-content') as HTMLElement).scrollLeft)).toBe(0)
  }
})
