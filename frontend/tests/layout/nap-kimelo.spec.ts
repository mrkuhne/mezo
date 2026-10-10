import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'
import { brokenChipWords } from './wordWrap'

/**
 * Kímélő mód S2 (mezo-q4xt2.2) — the Nap hub at the narrowest phone: the „Nem vagyok jól" entry,
 * the „Mi történt?" sheet (four serious reasons + „Meddig tarthat?"), the „Hogy vagy?" card, its
 * in-card „Tévedés volt" confirm and the slim line must all stay horizontally contained.
 * Folyadék F2 (mezo-n4wf5.2): the entry is a ROW at the bottom of the page (was a pill at the top),
 * the card is a kit Hero (`.nm-km`), the sheet a kit sheet with four reason tiles (`.nm-opt4`). Mock mode
 * keeps the state in the query cache, so every step is an in-app tap on ONE loaded page.
 * `KIMELO_SHOTS_DIR` (optional) saves a screenshot per state as evidence.
 */
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

const SHOTS = process.env.KIMELO_SHOTS_DIR
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
}

async function expectContained(page: Page, selector: string) {
  const boxes = await page.evaluate((sel) => {
    return (Array.from(document.querySelectorAll(sel)) as HTMLElement[]).map((el) => {
      const r = el.getBoundingClientRect()
      return { sel, overflow: el.scrollWidth - el.clientWidth, left: r.left, right: r.right, viewport: window.innerWidth }
    })
  }, selector)
  expect(boxes.length, selector).toBeGreaterThan(0)
  for (const b of boxes) {
    expect(b.overflow, b.sel).toBeLessThanOrEqual(1)
    expect(b.left, b.sel).toBeGreaterThanOrEqual(-0.5)
    expect(b.right, b.sel).toBeLessThanOrEqual(b.viewport + 0.5)
  }
  const page2 = await page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    return sc.scrollWidth - sc.clientWidth
  })
  expect(page2).toBeLessThanOrEqual(1)
}

test('Nap · kímélő mód: Nem vagyok jól → Mi történt? → the Hogy vagy? card, Még nem, Tévedés volt @ 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.clock.setFixedTime(new Date('2026-05-21T10:12:00'))
  await page.goto('/nap')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  const pill = page.getByRole('button', { name: 'Nem vagyok jól' })
  // the entry is the last row of the page: it must be reachable by scrolling, clear of the bottom bar
  await pill.scrollIntoViewIfNeeded()
  await expect(pill).toBeVisible()
  await expect(pill).toBeInViewport()
  await expectContained(page, '.nm-rows, .nm-rows .fo-row')
  const entry = await page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    sc.style.scrollBehavior = 'auto'
    sc.scrollTop = sc.scrollHeight
    const row = document.querySelector('.nm-rows .fo-row')!.getBoundingClientRect()
    return { rowBottom: row.bottom, navTop: document.querySelector('.fo-nav')!.getBoundingClientRect().top }
  })
  expect(entry.rowBottom).toBeLessThanOrEqual(entry.navTop - 1)
  await shot(page, '01-entry-pill')

  await pill.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Mi történt?' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Kímélő mód bekapcsolása' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Beteg vagyok' }).click()
  await dialog.getByRole('button', { name: '2–3 nap' }).click()
  const sheet = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const out = Array.from(el.querySelectorAll('.trm-kmdc button, .nm-opt4 button')).filter((c) => c.getBoundingClientRect().right > r.right + 0.5).length
    return { out, scroll: el.scrollWidth, width: el.clientWidth }
  })
  await expect(dialog.locator('.nm-opt4 button')).toHaveCount(4)
  expect(sheet.out).toBe(0)
  // every reason label keeps its words whole (no „Gyomorront / ás") and inside its chip
  expect(await brokenChipWords(page, '.nm-kmsheet .nm-opt4 button > span:last-child, .nm-kmsheet .trm-kmdc > button')).toEqual([])
  expect(sheet.scroll).toBeLessThanOrEqual(sheet.width + 1)
  await shot(page, '02-sheet-picked')
  await dialog.getByRole('button', { name: 'Kímélő mód bekapcsolása' }).click()
  await expect(dialog).toBeHidden({ timeout: 5000 })

  const card = page.locator('.nm-km')
  await expect(card.getByText('Hogy vagy?')).toBeVisible()
  // the label line carries the mode + the reason (CSS upper-cases it), the sub line the day + estimate
  await expect(card.locator('.fo-hero-lbl')).toHaveText('Kímélő mód · Beteg vagyok')
  await expect(card.locator('.fo-hero-sub')).toHaveText('1. nap · becslés: 2–3 nap')
  // measure the card's rows (text row + action row) and its own box
  await expectContained(page, '.nm-km .fo-hero-row, .nm-km .fo-hero-tx, .nm-km .fo-hero-acts, .nm-km .fo-hero-acts > button')
  const box = await card.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(320.5)
  await shot(page, '03-card')

  await card.getByRole('button', { name: 'Tévedés volt' }).click()
  await expect(card.getByText('Töröljem a kímélő módot?')).toBeVisible()
  await expectContained(page, '.nm-km-ask, .nm-km .fo-hero-acts, .nm-km .fo-hero-acts > button')
  await shot(page, '04-card-confirm')
  await card.getByRole('button', { name: 'Mégse' }).click()

  await card.getByRole('button', { name: 'Még nem' }).click()
  const slim = page.locator('.nm-kmslim')
  await expect(slim.getByText('Kímélő mód · 1. nap')).toBeVisible()
  await expectContained(page, '.nm-kmslim, .nm-kmslim .fo-row')
  await shot(page, '05-slim-line')

  // day 1: Befejezem (= Jobban) ends it without a return
  await slim.getByRole('button', { name: 'Befejezem' }).click()
  await expect(page.getByRole('button', { name: 'Nem vagyok jól' })).toBeVisible()
  await shot(page, '06-ended')
})
