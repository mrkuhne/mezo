import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'
import { brokenChipWords } from './wordWrap'

/**
 * Kihagyás S3 (mezo-q4xt2.3) — the Fuel Mai at the narrowest phone: the „Kihagyom" row, the skipped
 * meal block with its three pills (clear of the floating „+"), the meal skip reason sheet (six chips
 * in two columns, the duration row wrapping) and the stomach-bug GUIDANCE card (eyebrow, water row,
 * seven chips). Mock mode keeps the recovery period in the query cache, so the GUIDANCE card is
 * reached with an in-app route change after starting the period on the Nap hub. Assertions keep
 * ≥ 8 px of slack: CI fonts are wider than local ones (S2 lesson).
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

  // (b) the „Logolás ide" + „Kihagyom" row: both inside the card, „Kihagyom" whole
  const row = page.locator('.fmx-frow').first()
  await row.scrollIntoViewIfNeeded()
  await expect(row.locator('.fmx-fskip')).toBeVisible()
  const rowBox = await page.evaluate(() => {
    const frow = document.querySelector('.fmx-frow') as HTMLElement
    const card = frow.closest('.fmx-block') as HTMLElement
    const c = card.getBoundingClientRect()
    const kids = Array.from(frow.children) as HTMLElement[]
    const skip = frow.querySelector('.fmx-fskip') as HTMLElement
    return {
      slack: Math.min(...kids.map((k) => c.right - k.getBoundingClientRect().right)),
      left: Math.min(...kids.map((k) => k.getBoundingClientRect().left - c.left)),
      skipWhole: skip.scrollWidth <= skip.clientWidth + 1,
      skipText: (skip.textContent ?? '').trim(),
    }
  })
  expect(rowBox.slack).toBeGreaterThanOrEqual(0)
  expect(rowBox.left).toBeGreaterThanOrEqual(0)
  expect(rowBox.skipWhole).toBe(true)
  expect(rowBox.skipText).toContain('Kihagyom')
  expect(await brokenChipWords(page, '.fmx-fskip')).toEqual([])

  // (d) the reason sheet: six chips in two columns, the duration row wrapping inside the sheet
  await page.getByRole('button', { name: /Uzsonna kihagyása/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Miért marad ki?' })).toBeVisible()
  const chips = await dialog.locator('.trm-whyc').evaluateAll((els) =>
    els.map((el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top) } }))
  expect(chips).toHaveLength(6)
  expect(new Set(chips.map((c) => c.l)).size).toBe(2)
  expect(new Set(chips.map((c) => c.t)).size).toBe(3)
  await dialog.getByRole('button', { name: 'Gyomorrontás' }).click()
  await expect(dialog.getByText('Meddig tarthat?')).toBeVisible()
  const sheet = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const items = Array.from(el.querySelectorAll('.trm-whyc, .trm-kmdc button, .uvl-cta, .uvl-ghost')) as HTMLElement[]
    const dur = Array.from(el.querySelectorAll('.trm-kmdc button')) as HTMLElement[]
    return {
      scroll: el.scrollWidth, width: el.clientWidth,
      minSlack: Math.min(...items.map((c) => r.right - c.getBoundingClientRect().right)),
      durRows: new Set(dur.map((b) => Math.round(b.getBoundingClientRect().top))).size,
      durCount: dur.length,
    }
  })
  expect(sheet.scroll).toBeLessThanOrEqual(sheet.width + 1)
  expect(sheet.minSlack).toBeGreaterThanOrEqual(0)
  expect(sheet.durCount).toBeGreaterThan(1)
  expect(await brokenChipWords(page, '.trm-whysheet .trm-whyc > span, .trm-whysheet .trm-kmdc > button')).toEqual([])
  await dialog.getByRole('button', { name: 'Most nem mondom' }).click()
  await expect(dialog).toBeHidden()

  // (a) the skipped block: three pills inside the card, none under the floating „+"
  const block = page.locator('.fmx-block.is-skipped')
  await expect(block).toBeVisible()
  await block.scrollIntoViewIfNeeded()
  await expect(block.getByRole('button', { name: 'Mégis ettem' })).toBeVisible()
  const pills = await insideOf(page, '.fmx-block.is-skipped', '.fmx-skacts .fmx-skact')
  expect(pills.count).toBe(3)
  expect(pills.leaks).toBe(0)
  expect(pills.minSlack).toBeGreaterThanOrEqual(0)
  const skd = await insideOf(page, '.fmx-block.is-skipped', '.fmx-skipd')
  expect(skd.leaks).toBe(0)
  const fab = page.locator('.quicklog-fab')
  await expect(fab).toBeVisible()
  const overlaps = await page.evaluate(() => {
    const f = (document.querySelector('.quicklog-fab') as HTMLElement).getBoundingClientRect()
    return Array.from(document.querySelectorAll('.fmx-block.is-skipped .fmx-skact')).filter((el) => {
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
  const card = page.locator('.fmx-gcard')
  await expect(card).toBeVisible()
  await expect(card.getByText(/KÍMÉLŐ MÓD · GYOMORRONTÁS/)).toBeVisible()

  const eyebrow = await insideOf(page, '.fmx-gcard', '.fmx-geb')
  expect(eyebrow.leaks).toBe(0)
  expect(eyebrow.minSlack).toBeGreaterThanOrEqual(0)
  const water = await insideOf(page, '.fmx-gcard', '.fmx-gwater')
  expect(water.count).toBe(1)
  expect(water.leaks).toBe(0)
  expect(water.minSlack).toBeGreaterThanOrEqual(SLACK / 2)
  const chips = await insideOf(page, '.fmx-gcard', '.fmx-gchips span')
  expect(chips.count).toBe(7)
  expect(chips.leaks).toBe(0)
  expect(chips.minSlack).toBeGreaterThanOrEqual(0)
  const own = await page.evaluate(() => {
    const c = document.querySelector('.fmx-gcard') as HTMLElement
    const r = c.getBoundingClientRect()
    return { left: r.left, right: r.right, viewport: window.innerWidth,
      rows: Array.from(c.querySelectorAll('.fmx-gwater, .fmx-gchips, .fmx-gtip, .fmx-gdoc')).filter((el) => el.scrollWidth > el.clientWidth + 1).length }
  })
  expect(own.left).toBeGreaterThanOrEqual(0)
  expect(own.right).toBeLessThanOrEqual(own.viewport + 0.5)
  expect(own.rows).toBe(0)
  expect(await brokenChipWords(page, '.fmx-gchips span')).toEqual([])
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
})
