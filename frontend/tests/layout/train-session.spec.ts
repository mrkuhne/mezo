import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/**
 * Folyadék F4 (mezo-n4wf5.4) — the in-workout flow at the narrowest phone: the session page (one exercise on top, the
 * others as rows, the dock portalled into the phone frame), a session sheet, both closing ceremonies and the review.
 * Modelled on layout.spec.ts's Eligazítás check. The invariants:
 *   · nothing pushes the page (or a sheet) sideways;
 *   · a floating bar — the dock, a ceremony's foot — never covers the last content once you scroll to the end;
 *   · a sheet that fits does not scroll (a closing text link's 44px hit area stays inside the scroller — kit rule);
 *   · a screen swapped in without a route change starts at the top.
 * The harness runs with reduced motion, so a ceremony paints its end state on the first frame.
 */
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
  await page.setViewportSize({ width: 320, height: 700 })
})

const ready = async (page: Page) => {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

/** The page scroller's horizontal overflow, and every laid-out element of `root` that reaches past the viewport. */
const sideways = (page: Page, root: string) => page.evaluate((sel) => {
  const sc = document.querySelector('.screen-content') as HTMLElement
  const out = Array.from(document.querySelectorAll(`${sel} *`)).filter((el) => {
    if (el.closest('svg') || el.closest('.sr-only')) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5)
  }).map((el) => (el as HTMLElement).className || el.tagName)
  return { overflow: sc.scrollWidth - sc.clientWidth, doc: document.documentElement.scrollWidth - innerWidth, out: out.slice(0, 5) }
}, root)

const expectContained = async (page: Page, root: string) => {
  const s = await sideways(page, root)
  expect(s.overflow, `${root}: the scroller overflows sideways`).toBeLessThanOrEqual(1)
  expect(s.doc, `${root}: the document overflows sideways`).toBeLessThanOrEqual(0)
  expect(s.out, `${root}: elements reach past the viewport`).toEqual([])
}

const toBottom = async (page: Page) => {
  await page.locator('.screen-content').evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }))
  await page.waitForTimeout(150)
}

/**
 * The sheet that holds `text`: is it inside the viewport, does it overflow sideways, and how much does its inside scroll.
 * Addressed by its content and measured only once it is the ONLY sheet and has stopped moving — a sheet that is still
 * leaving (the menu, when the prompt it opened is already up) must never be the one measured.
 */
const sheetBox = async (page: Page, text: string) => {
  await expect(page.locator('.sheet')).toHaveCount(1)
  const sheet = page.locator('.sheet', { hasText: text })
  await expect(sheet).toBeVisible()
  await expect.poll(async () => {
    const a = await sheet.boundingBox()
    await page.waitForTimeout(80)
    const b = await sheet.boundingBox()
    return a && b ? Math.abs(a.y - b.y) + Math.abs(a.height - b.height) : 1
  }).toBe(0)
  return sheet.evaluate((el) => {
    const sh = el as HTMLElement
    const sc = sh.querySelector('.sheet-scroll') as HTMLElement
    const r = sh.getBoundingClientRect()
    const frame = (document.querySelector('.phone-screen') as HTMLElement).getBoundingClientRect()
    return {
      cls: sh.className,
      inside: r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
      sideways: sh.scrollWidth - sh.clientWidth,
      scrolls: sc.scrollHeight - sc.clientHeight,
      // below the frame's max height the sheet FITS: its inside must not scroll at all
      fits: r.height < frame.height * 0.86 - 2,
    }
  })
}

async function startSession(page: Page) {
  await page.goto('/train/session')
  await ready(page)
  await page.getByRole('button', { name: /^Indulás/ }).click()
  await expect(page.locator('.ek-page')).toBeVisible()
}

test('train · the session page stays contained and the dock never covers the last content @ 320px', async ({ page }) => {
  await startSession(page)
  await expect(page.locator('.ek-hero')).toBeVisible()
  // The new skin only: no card list, no glass, nothing of the old session classes.
  expect(await page.locator('.ek-page [class*="wo-"], .ek-page [class*="wos-"], .ek-page .glass').count()).toBe(0)
  await expectContained(page, '.ek-page')

  // The hero's set grid is inside its card, and the tick is a 44px target.
  const grid = await page.evaluate(() => {
    const hero = (document.querySelector('.ek-hero') as HTMLElement).getBoundingClientRect()
    const sets = (document.querySelector('.ek-hero .ex-sets') as HTMLElement).getBoundingClientRect()
    const tick = (document.querySelector('.ek-hero .ex-sets .tk') as HTMLElement).getBoundingClientRect()
    return { left: sets.left - hero.left, right: hero.right - sets.right, tick: Math.min(tick.width, tick.height) }
  })
  expect(grid.left).toBeGreaterThanOrEqual(0)
  expect(grid.right).toBeGreaterThanOrEqual(0)
  expect(grid.tick).toBeGreaterThanOrEqual(40)

  // Resting: the dock is still inside the frame, and at this width its label gives way to the timer and two buttons.
  await page.getByRole('button', { name: /szett mentése$/ }).first().click()
  const dock = page.locator('.ex-dock.is-resting')
  await expect(dock).toBeVisible()
  const resting = await dock.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const label = el.querySelector('.ex-rest small') as HTMLElement
    const btns = Array.from(el.querySelectorAll('button')).map((b) => b.getBoundingClientRect())
    return {
      sideways: el.scrollWidth - el.clientWidth, left: r.left, right: r.right, bottom: r.bottom,
      label: getComputedStyle(label).display,
      buttonsInside: btns.every((b) => b.left >= r.left - 0.5 && b.right <= r.right + 0.5),
    }
  })
  expect(resting.sideways).toBeLessThanOrEqual(1)
  expect(resting.left).toBeGreaterThanOrEqual(0)
  expect(resting.right).toBeLessThanOrEqual(320)
  expect(resting.bottom).toBeLessThanOrEqual(700)
  expect(resting.label).toBe('none')
  expect(resting.buttonsInside).toBe(true)
  await page.getByRole('button', { name: 'Tovább', exact: true }).click()

  // The title row is pinned at the top of the scroller; at the end of the page the last card clears the dock.
  await toBottom(page)
  const end = await page.evaluate(() => {
    const sc = (document.querySelector('.screen-content') as HTMLElement).getBoundingClientRect()
    const top = (document.querySelector('.ek-page > .fo-ptop') as HTMLElement).getBoundingClientRect()
    const cards = Array.from(document.querySelectorAll('.ek-page > .fo-card')) as HTMLElement[]
    const last = cards[cards.length - 1].getBoundingClientRect()
    const dockTop = (document.querySelector('.ex-dock') as HTMLElement).getBoundingClientRect().top
    return { titleTop: Math.round(top.top - sc.top), lastBottom: last.bottom, dockTop }
  })
  expect(end.titleTop, 'the title row stays pinned').toBe(0)
  expect(end.lastBottom, 'the dock covers the last card').toBeLessThanOrEqual(end.dockTop)
  await expectContained(page, '.ek-page')
})

test('train · the session sheets stay inside the frame and a sheet that fits does not scroll @ 320px', async ({ page }) => {
  await startSession(page)
  await page.getByRole('button', { name: /szett mentése$/ }).first().click()
  await page.getByRole('button', { name: 'Tovább', exact: true }).click()

  // The menu: a list of rows; every row is reachable inside the sheet.
  await page.getByRole('button', { name: /· további műveletek$/ }).click()
  const menu = page.getByRole('dialog')
  await expect(menu.getByText('Gyakorlat kihagyása')).toBeVisible()
  let box = await sheetBox(page, 'Gyakorlat kihagyása')
  expect(box.cls).toContain('fo-sheet')
  expect(box.cls).not.toContain('glass')
  expect(box.inside).toBe(true)
  expect(box.sideways).toBeLessThanOrEqual(1)
  await menu.getByText('Gyakorlat kihagyása').scrollIntoViewIfNeeded()
  await expect(menu.getByText('Gyakorlat kihagyása')).toBeInViewport()
  await menu.getByRole('button', { name: 'Bezárás' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // The extra-set prompt ENDS in a text link („Csak ma"): it fits, so its inside must not scroll — the link's 44px hit
  // area has its room inside the scroller (kit rule for every `.fo-sheet`).
  await page.getByRole('button', { name: /· további műveletek$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Szett hozzáadása/ }).click()
  const prompt = page.getByRole('dialog')
  await expect(prompt.getByRole('button', { name: 'Csak ma' })).toBeVisible()
  box = await sheetBox(page, 'Csak ma')
  expect(box.inside).toBe(true)
  expect(box.sideways).toBeLessThanOrEqual(1)
  expect(box.fits, 'the extra-set prompt is a short sheet at 320×700').toBe(true)
  expect(box.scrolls, 'a sheet that fits must not scroll (stray scroll under the closing link)').toBeLessThanOrEqual(0)
  const link = await prompt.getByRole('button', { name: 'Csak ma' }).evaluate((el) => {
    const after = getComputedStyle(el, '::after')
    return { h: Math.max(el.getBoundingClientRect().height, parseFloat(after.height) || 0) }
  })
  expect(link.h, 'the closing link keeps its 44px target').toBeGreaterThanOrEqual(44)
  await prompt.getByRole('button', { name: 'Csak ma' }).click()
  await expect(page.locator('.sheet')).toHaveCount(0)

  // The finish confirm: the tally on the primary, the pending rows, both ways out in view.
  await toBottom(page)
  await page.getByRole('button', { name: 'Edzés befejezése' }).click()
  const fin = page.getByRole('dialog')
  await expect(fin.getByRole('button', { name: /Befejezem így/ })).toBeVisible()
  box = await sheetBox(page, 'Befejezem így')
  expect(box.inside).toBe(true)
  expect(box.sideways).toBeLessThanOrEqual(1)
  await fin.getByRole('button', { name: 'Mégse, visszamegyek' }).scrollIntoViewIfNeeded()
  await expect(fin.getByRole('button', { name: 'Mégse, visszamegyek' })).toBeInViewport()
})

test('train · the workout ceremony: both steps contained, each starts at the top, the foot clears the last content @ 320px', async ({ page }) => {
  await startSession(page)
  await page.getByRole('button', { name: /szett mentése$/ }).first().click()
  await page.getByRole('button', { name: 'Tovább', exact: true }).click()
  await toBottom(page)
  await page.getByRole('button', { name: 'Edzés befejezése' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Befejezem így/ }).click()

  // Step one: the stage. Reached from the BOTTOM of the session page — it must open at its top.
  await expect(page.getByRole('heading', { level: 1, name: 'Edzés lezárva' })).toBeVisible()
  await expect(page.locator('.fo-cer.told')).toBeVisible()
  expect(await page.locator('.screen-content').evaluate((el) => el.scrollTop)).toBe(0)
  expect(await page.locator('.ec-page [class^="cer-"], .ec-page [class*=" cer-"], .ec-page .glass, .ex-dock').count()).toBe(0)
  await expectContained(page, '.ec-page')
  const stage = await page.evaluate(() => {
    const card = (document.querySelector('.fo-cer-stage') as HTMLElement).getBoundingClientRect()
    const cup = (document.querySelector('.fo-cup') as HTMLElement).getBoundingClientRect()
    const stars = (document.querySelector('.fo-cer-stars') as HTMLElement).getBoundingClientRect()
    return { cupIn: cup.left >= card.left && cup.right <= card.right, starsIn: stars.left >= card.left - 0.5 && stars.right <= card.right + 0.5 }
  })
  expect(stage.cupIn).toBe(true)
  expect(stage.starsIn).toBe(true)

  const footClears = () => page.evaluate(() => {
    const foot = (document.querySelector('.ec-page > .fo-foot') as HTMLElement).getBoundingClientRect()
    const content = Array.from(document.querySelectorAll('.ec-page .fo-card, .ec-page .fo-note, .ec-page .fo-hero')) as HTMLElement[]
    const lastBottom = Math.max(...content.map((el) => el.getBoundingClientRect().bottom))
    return { lastBottom, footTop: foot.top, footBottom: foot.bottom }
  })
  await toBottom(page)
  let f = await footClears()
  expect(f.lastBottom, 'the foot covers the last content of step one').toBeLessThanOrEqual(f.footTop)
  expect(f.footBottom).toBeLessThanOrEqual(700)

  // Step two — opened from the bottom of step one, it starts at the top; the note stays above the button.
  await page.getByRole('button', { name: /^Részletek/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Részletek' })).toBeVisible()
  expect(await page.locator('.screen-content').evaluate((el) => el.scrollTop)).toBe(0)
  await expectContained(page, '.ec-page')
  await toBottom(page)
  f = await footClears()
  expect(f.lastBottom, 'the foot covers the note on step two').toBeLessThanOrEqual(f.footTop)
  await expect(page.getByLabel('Hogy ment?')).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Vissza az értékeléshez' })).toBeInViewport()
})

test('train · the sport closing screen is contained and its foot clears the last content @ 320px', async ({ page }) => {
  await page.goto('/train/sport/log')
  await ready(page)
  await page.getByRole('button', { name: /Röplabda/ }).click()
  await page.getByRole('button', { name: /^Naplózom/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mozgás lezárva' })).toBeVisible()
  await expect(page.locator('.fo-cer.told')).toBeVisible()
  // The XP stands on the screen; the level-up overlay does not cover a ceremony.
  expect(await page.locator('.levelup, .lvu-body').count()).toBe(0)
  expect(await page.locator('.screen-content').evaluate((el) => el.scrollTop)).toBe(0)
  await expectContained(page, '.ec-page')
  await toBottom(page)
  const f = await page.evaluate(() => {
    const foot = (document.querySelector('.ec-page > .fo-foot') as HTMLElement).getBoundingClientRect()
    const content = Array.from(document.querySelectorAll('.ec-page .fo-card, .ec-page .fo-note, .ec-page .fo-hero')) as HTMLElement[]
    return { lastBottom: Math.max(...content.map((el) => el.getBoundingClientRect().bottom)), footTop: foot.top, footBottom: foot.bottom }
  })
  expect(f.lastBottom, 'the foot covers the last content').toBeLessThanOrEqual(f.footTop)
  expect(f.footBottom).toBeLessThanOrEqual(700)
  await expect(page.getByRole('button', { name: 'Vissza a mai napra' })).toBeInViewport()
})

test('train · the review and one exercise of it stay contained, and the bottom bar never covers the end @ 320px', async ({ page }) => {
  await page.goto('/train/review/wd-mock-1')
  await ready(page)
  await expect(page.locator('.eo-page')).toBeVisible()
  expect(await page.locator('.eo-page [class*="wsum-"], .eo-page [class*="wr-"], .eo-page .glass').count()).toBe(0)
  await expectContained(page, '.eo-page')
  // The hero's tubes are inside the hero.
  const tubes = await page.evaluate(() => {
    const hero = (document.querySelector('.eo-page .fo-hero') as HTMLElement).getBoundingClientRect()
    return Array.from(document.querySelectorAll('.eo-extubes .fo-vial')).every((v) => {
      const r = v.getBoundingClientRect()
      return r.left >= hero.left - 0.5 && r.right <= hero.right + 0.5
    })
  })
  expect(tubes).toBe(true)

  const endClearsNav = () => page.evaluate(() => {
    const nav = (document.querySelector('.fo-nav') as HTMLElement).getBoundingClientRect()
    const kids = Array.from(document.querySelectorAll('.eo-page > *')) as HTMLElement[]
    const lastBottom = Math.max(...kids.map((el) => el.getBoundingClientRect().bottom))
    return { lastBottom, navTop: nav.top }
  })
  await toBottom(page)
  let e = await endClearsNav()
  expect(e.lastBottom, 'the bottom bar covers the end of the review').toBeLessThanOrEqual(e.navTop)

  // One exercise: its set tubes, the numbers and the set rows.
  await page.locator('.screen-content').evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' }))
  await page.locator('.eo-exlist').getByRole('button', { name: /Chest Supported Row/ }).click()
  await expect(page.locator('.eo-settubes')).toBeVisible()
  await expectContained(page, '.eo-page')
  await toBottom(page)
  e = await endClearsNav()
  expect(e.lastBottom, 'the bottom bar covers the end of the exercise view').toBeLessThanOrEqual(e.navTop)
})
