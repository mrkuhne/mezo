import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'
import { brokenChipWords } from './wordWrap'

/**
 * Kihagyás S3 (mezo-q4xt2.3) — the Fuel Mai at the narrowest phone: the „Kihagyom" link beside „+ Logolás ide",
 * the skipped meal block with its three ways on (clear of the floating „+"), the meal skip reason sheet (six reason
 * tiles, the duration row wrapping) and the stomach-bug GUIDANCE hero with its tips (label, water glass, seven
 * chips). Mock mode keeps the recovery period in the query cache, so the guidance is reached with an in-app route
 * change after starting the period on the Nap hub. Assertions keep slack: CI fonts are wider than local ones.
 *
 * Folyadék F5 (mezo-n4wf5.5) — the same surfaces in the new markup: a block is a kit card `.fa-blk` (`.open`,
 * `.is-skipped`), its action row `.fa-la` (`.fa-log` + the `.fa-skip` text link), the skipped state a Fuel-shared
 * tip + `.fa-ska`; the reason sheet is the kit sheet `.fa-why` with `.fa-whyg > button` tiles and the shared
 * duration row (`.trm-kmdc`); the guidance is the amber hero `.fa-gh` (water glass `.fa-gl`) and the tips card
 * `.fa-gtips` (`.fx-tip` rows, `.fa-easy` chips).
 */
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

const SLACK = 8

async function pageOverflow(page: Page) {
  return page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    return sc.scrollWidth - sc.clientWidth
  })
}

/** Every `inner` element lies inside the first `outer` ancestor box, left and right. */
async function insideOf(page: Page, outer: string, inner: string) {
  return page.evaluate(({ outer, inner }) => {
    const out = document.querySelector(outer) as HTMLElement
    const o = out.getBoundingClientRect()
    const els = Array.from(out.querySelectorAll(inner)) as HTMLElement[]
    return {
      count: els.length,
      leaks: els.filter((el) => {
        const r = el.getBoundingClientRect()
        return r.left < o.left - 0.5 || r.right > o.right + 0.5
      }).length,
      minSlack: Math.min(...els.map((el) => o.right - el.getBoundingClientRect().right)),
    }
  }, { outer, inner })
}

test('Fuel Mai · Kihagyom row and the skipped block stay contained, clear of the „+" @ 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.clock.setFixedTime(new Date('2026-05-21T13:30:00'))
  await page.goto('/fuel')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  // (b) the „+ Logolás ide" + „Kihagyom" row: both inside the card, „Kihagyom" whole
  const row = page.locator('.fa-blk.open .fa-la').first()
  await row.scrollIntoViewIfNeeded()
  await expect(row.locator('.fa-skip')).toBeVisible()
  const rowBox = await page.evaluate(() => {
    const frow = document.querySelector('.fa-blk.open .fa-la') as HTMLElement
    const card = frow.closest('.fa-blk') as HTMLElement
    const c = card.getBoundingClientRect()
    const kids = Array.from(frow.children) as HTMLElement[]
    const skip = frow.querySelector('.fa-skip') as HTMLElement
    return {
      kids: kids.length,
      slack: Math.min(...kids.map((k) => c.right - k.getBoundingClientRect().right)),
      left: Math.min(...kids.map((k) => k.getBoundingClientRect().left - c.left)),
      skipWhole: skip.scrollWidth <= skip.clientWidth + 1,
      skipText: (skip.textContent ?? '').trim(),
      // the text link is drawn small; its 44 px touch area is the kit's `::after`
      skipArea: parseFloat(getComputedStyle(skip, '::after').height),
    }
  })
  expect(rowBox.kids).toBe(2)
  expect(rowBox.slack).toBeGreaterThanOrEqual(0)
  expect(rowBox.left).toBeGreaterThanOrEqual(0)
  expect(rowBox.skipWhole).toBe(true)
  expect(rowBox.skipText).toContain('Kihagyom')
  expect(rowBox.skipArea).toBeGreaterThanOrEqual(44)
  expect(await brokenChipWords(page, '.fa-blk.open .fa-skip')).toEqual([])

  // (d) the reason sheet: six reason tiles in a regular grid, the duration row wrapping inside the sheet
  await page.getByRole('button', { name: /Uzsonna kihagyása/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Miért marad ki?' })).toBeVisible()
  const chips = await dialog.locator('.fa-whyg > button').evaluateAll((els) =>
    els.map((el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } }))
  expect(chips).toHaveLength(6)
  // three columns × two rows (prototype `mealwhy`); every tile is a 44 px target
  expect(new Set(chips.map((c) => c.l)).size).toBe(3)
  expect(new Set(chips.map((c) => c.t)).size).toBe(2)
  expect(Math.min(...chips.map((c) => Math.min(c.w, c.h)))).toBeGreaterThanOrEqual(44)
  await dialog.getByRole('button', { name: 'Gyomorrontás' }).click()
  await expect(dialog.getByText('Meddig tarthat?')).toBeVisible()
  const sheet = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const items = Array.from(el.querySelectorAll('.fa-whyg > button, .trm-kmdc button, .fo-acts .fo-btn, .fo-acts .fo-lk')) as HTMLElement[]
    const dur = Array.from(el.querySelectorAll('.trm-kmdc button')) as HTMLElement[]
    return {
      scroll: el.scrollWidth, width: el.clientWidth, items: items.length,
      minSlack: Math.min(...items.map((c) => r.right - c.getBoundingClientRect().right)),
      durRows: new Set(dur.map((b) => Math.round(b.getBoundingClientRect().top))).size,
      durCount: dur.length,
      durMinH: Math.min(...dur.map((b) => b.getBoundingClientRect().height)),
    }
  })
  expect(sheet.scroll).toBeLessThanOrEqual(sheet.width + 1)
  expect(sheet.items).toBe(6 + 4 + 2)
  expect(sheet.minSlack).toBeGreaterThanOrEqual(0)
  expect(sheet.durCount).toBe(4)
  expect(sheet.durRows).toBeGreaterThan(1) // the row wraps at 320 instead of leaving the sheet
  expect(sheet.durMinH).toBeGreaterThanOrEqual(44)
  expect(await brokenChipWords(page, '.fa-why .fa-whyg > button > span:last-child, .fa-why .trm-kmdc > button')).toEqual([])
  // real slack, not a lucky fit (bible F4.1): the widest word of a reason tile leaves ≥ 12 px in its tile on this
  // machine, so the wider fonts of the CI runner cannot break it
  const slack = await dialog.locator('.fa-whyg > button > span:last-child').evaluateAll((els) => Math.min(...els.map((el) => {
    const box = (el.parentElement as HTMLElement).clientWidth - 4
    const node = el.firstChild as Text
    let widest = 0
    for (const m of (node.textContent ?? '').matchAll(/\S+/g)) {
      const r = document.createRange(); r.setStart(node, m.index!); r.setEnd(node, m.index! + m[0].length)
      widest = Math.max(widest, r.getBoundingClientRect().width)
    }
    return box - widest
  })))
  expect(slack).toBeGreaterThanOrEqual(12)
  await dialog.getByRole('button', { name: 'Most nem mondom' }).click()
  await expect(dialog).toBeHidden()

  // (a) the skipped block: three ways on inside the card, none under the floating „+"
  const block = page.locator('.fa-blk.is-skipped')
  await expect(block).toBeVisible()
  await block.scrollIntoViewIfNeeded()
  await expect(block.getByRole('button', { name: 'Mégis ettem' })).toBeVisible()
  const pills = await insideOf(page, '.fa-blk.is-skipped', '.fa-ska > *')
  expect(pills.count).toBe(3)
  expect(pills.leaks).toBe(0)
  expect(pills.minSlack).toBeGreaterThanOrEqual(0)
  const skd = await insideOf(page, '.fa-blk.is-skipped', '.fa-skipped .fx-tip')
  expect(skd.count).toBe(1)
  expect(skd.leaks).toBe(0)
  const fab = page.locator('.fo-fab')
  await expect(fab).toBeVisible()
  // lift the block to the middle first: what is measured is whether the page CAN show the three controls clear
  // of the „+", not where the scroller happened to stop
  await block.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const overlaps = await page.evaluate(() => {
    const f = (document.querySelector('.fo-fab') as HTMLElement).getBoundingClientRect()
    return Array.from(document.querySelectorAll('.fa-blk.is-skipped .fa-ska > *')).filter((el) => {
      const r = el.getBoundingClientRect()
      return r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top
    }).length
  })
  expect(overlaps).toBe(0)
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
})

test('Fuel Mai · the stomach-bug GUIDANCE card stays contained @ 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.clock.setFixedTime(new Date('2026-05-21T10:12:00'))
  await page.goto('/nap')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  await page.getByRole('button', { name: 'Nem vagyok jól' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Gyomorrontás' }).click()
  await dialog.getByRole('button', { name: '2–3 nap' }).click()
  await dialog.getByRole('button', { name: 'Kímélő mód bekapcsolása' }).click()
  await expect(dialog).toBeHidden({ timeout: 5000 })

  // an in-app route change keeps the mock query cache (a reload would drop the period)
  await page.evaluate(() => {
    window.history.pushState({}, '', '/fuel')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  // the guidance: the amber hero (label, water glass, verdict) and the tips card under it
  const hero = page.locator('.fo-hero.fa-gh')
  await expect(hero).toBeVisible()
  await expect(hero.locator('.fo-hero-lbl')).toHaveText(/Kímélő mód · Gyomorrontás/)
  await expect(page.locator('.fo-page .fo-hero')).toHaveCount(1)

  const label = await insideOf(page, '.fa-gh', '.fo-hero-lbl')
  expect(label.count).toBe(1)
  expect(label.leaks).toBe(0)
  expect(label.minSlack).toBeGreaterThanOrEqual(0)
  const water = await insideOf(page, '.fa-gh', '.fa-gl')
  expect(water.count).toBe(1)
  expect(water.leaks).toBe(0)
  expect(water.minSlack).toBeGreaterThanOrEqual(SLACK / 2)
  const acts = await insideOf(page, '.fa-gh', '.fo-hero-acts > *')
  expect(acts.count).toBe(2) // „+ Víz" and „Mikor fordulj orvoshoz?"
  expect(acts.leaks).toBe(0)
  const tips = page.locator('.fa-gtips')
  await tips.scrollIntoViewIfNeeded()
  const tipRows = await insideOf(page, '.fa-gtips', '.fx-tip')
  expect(tipRows.count).toBe(3)
  expect(tipRows.leaks).toBe(0)
  const chips = await insideOf(page, '.fa-gtips', '.fa-easy span')
  expect(chips.count).toBe(7)
  expect(chips.leaks).toBe(0)
  expect(chips.minSlack).toBeGreaterThanOrEqual(0)
  const own = await page.evaluate(() => {
    const boxes = [document.querySelector('.fa-gh'), document.querySelector('.fa-gtips')] as HTMLElement[]
    return { left: Math.min(...boxes.map((c) => c.getBoundingClientRect().left)), right: Math.max(...boxes.map((c) => c.getBoundingClientRect().right)),
      viewport: window.innerWidth,
      rows: boxes.flatMap((c) => Array.from(c.querySelectorAll('.fa-gl, .fa-easy, .fx-tip, .fo-hero-acts .fo-lk'))).filter((el) => el.scrollWidth > el.clientWidth + 1).length }
  })
  expect(own.left).toBeGreaterThanOrEqual(0)
  expect(own.right).toBeLessThanOrEqual(own.viewport + 0.5)
  expect(own.rows).toBe(0)
  expect(await brokenChipWords(page, '.fa-easy span')).toEqual([])
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
})
