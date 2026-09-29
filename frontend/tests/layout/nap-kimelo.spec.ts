import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/**
 * Kímélő mód S2 (mezo-q4xt2.2) — the Nap hub at the narrowest phone: the „Nem vagyok jól" pill,
 * the „Mi történt?" sheet (four serious reasons + „Meddig tarthat?"), the „Hogy vagy?" card, its
 * in-card „Tévedés volt" confirm and the slim line must all stay horizontally contained. Mock mode
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
  await expect(pill).toBeVisible()
  await expectContained(page, '.nap-kmentry')
  await shot(page, '01-entry-pill')

  await pill.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Mi történt?' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Kímélő mód bekapcsolása' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Beteg vagyok' }).click()
  await dialog.getByRole('button', { name: '2–3 nap' }).click()
  const sheet = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const out = Array.from(el.querySelectorAll('.trm-kmdc button, .trm-whyc')).filter((c) => c.getBoundingClientRect().right > r.right + 0.5).length
    return { out, scroll: el.scrollWidth, width: el.clientWidth }
  })
  expect(sheet.out).toBe(0)
  expect(sheet.scroll).toBeLessThanOrEqual(sheet.width + 1)
  await shot(page, '02-sheet-picked')
  await dialog.getByRole('button', { name: 'Kímélő mód bekapcsolása' }).click()
  await expect(dialog).toBeHidden({ timeout: 5000 })

  const card = page.locator('.nap-kmcard')
  await expect(card.getByText('Hogy vagy?')).toBeVisible()
  await expect(card.getByText('KÍMÉLŐ MÓD · BETEG VAGYOK')).toBeVisible()
  await expect(card.getByText('Kímélő mód · 1. nap · becslés: 2–3 nap')).toBeVisible()
  // the card clips its corner halo (scrollWidth counts it), so measure its rows and its own box
  await expectContained(page, '.nap-kmtop, .nap-kmtwo, .nap-kmoops')
  const box = await card.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(320.5)
  await shot(page, '03-card')

  await card.getByRole('button', { name: 'Tévedés volt' }).click()
  await expect(card.getByText('Töröljem a kímélő módot?')).toBeVisible()
  await expectContained(page, '.nap-kmask, .nap-kmbtns')
  await shot(page, '04-card-confirm')
  await card.getByRole('button', { name: 'Mégse' }).click()

  await card.getByRole('button', { name: 'Még nem' }).click()
  const slim = page.locator('.nap-kmslim')
  await expect(slim.getByText('Kímélő mód · 1. nap')).toBeVisible()
  await expectContained(page, '.nap-kmslim')
  await shot(page, '05-slim-line')

  // day 1: Befejezem (= Jobban) ends it without a return
  await slim.getByRole('button', { name: 'Befejezem' }).click()
  await expect(page.getByRole('button', { name: 'Nem vagyok jól' })).toBeVisible()
  await shot(page, '06-ended')
})
