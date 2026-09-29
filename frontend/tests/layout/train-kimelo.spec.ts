import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/**
 * Kímélő mód S2 (mezo-q4xt2.2) — Edzés · Mai through a whole recovery at the narrowest phone:
 * the „Meddig tarthat?" row in the reason sheet, the recovery hero, a released day, the
 * „Üdv újra!" sheet, the comeback note and the Terv week's protected rows must all stay
 * horizontally contained. Mock mode keeps its state in the query cache, so every step moves
 * through in-app taps on ONE loaded page. `KIMELO_SHOTS_DIR` (optional) saves a screenshot per
 * state as evidence.
 */
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

const SHOTS = process.env.KIMELO_SHOTS_DIR
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
}

async function pageOverflow(page: Page) {
  return page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    return sc.scrollWidth - sc.clientWidth
  })
}

async function expectContained(page: Page, selector: string) {
  const boxes = await page.evaluate((sel) => {
    return (Array.from(document.querySelectorAll(sel)) as HTMLElement[]).map((el) => {
      const r = el.getBoundingClientRect()
      return { sel, overflow: el.scrollWidth - el.clientWidth, left: r.left, right: r.right, viewport: window.innerWidth }
    })
  }, selector)
  for (const b of boxes) {
    expect(b.overflow, b.sel).toBeLessThanOrEqual(1)
    expect(b.left, b.sel).toBeGreaterThanOrEqual(-0.5)
    expect(b.right, b.sel).toBeLessThanOrEqual(b.viewport + 0.5)
  }
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
}

async function open(page: Page, entry: string) {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.clock.setFixedTime(new Date('2026-05-21T08:42:00')) // a Thursday — the mock Pull day
  await page.goto(entry)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

async function pickRecovery(page: Page, estimate: string, name: string) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Beteg vagyok' }).click()
  await expect(dialog.getByText('MEDDIG TARTHAT?')).toBeVisible()
  const chipsOutside = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return Array.from(el.querySelectorAll('.trm-kmdc button')).filter((c) => c.getBoundingClientRect().right > r.right + 0.5).length
  })
  expect(chipsOutside).toBe(0)
  await dialog.getByRole('button', { name: estimate }).click()
  await expect(dialog.getByText('Kímélő mód bekapcsolva')).toBeVisible()
  await shot(page, name)
  await expect(dialog).toBeHidden({ timeout: 5000 })
}

test('Edzés Mai · kímélő mód day 1: recovery hero, released day, Mégse, Jobban vagyok @ 320px', async ({ page }) => {
  await open(page, '/train/mai')
  await page.locator('.trm-hero .trm-skipbtn').click()
  await pickRecovery(page, '2–3 nap', '01-sheet-duration')

  const hero = page.locator('.trm-hero.is-km')
  await expect(hero.getByText('KÍMÉLŐ MÓD · 1. nap')).toBeVisible()
  await expect(hero.getByText('Beteg vagy · becslés: 2–3 nap')).toBeVisible()
  await expect(page.getByText(/MAI ÁLLAPOT/)).toHaveCount(0)
  await expectContained(page, '.trm-hero .trm-skipd, .trm-hero .trm-skacts')
  await shot(page, '02-recovery-hero')

  await hero.getByRole('button', { name: 'Ma mégis edzek' }).click()
  const rel = page.locator('.trm-kmrel')
  await expect(rel).toBeVisible()
  await expect(page.getByRole('button', { name: /Indítsuk/ })).toBeVisible()
  await rel.scrollIntoViewIfNeeded()
  await expectContained(page, '.trm-kmrel')
  await shot(page, '03-released-day')

  await rel.getByRole('button', { name: 'Mégse' }).click()
  await expect(page.locator('.trm-hero.is-km')).toBeVisible()
  await page.locator('.trm-hero.is-km').getByRole('button', { name: 'Jobban vagyok' }).click()
  await expect(page.getByText('BETERVEZVE')).toBeVisible()
  await shot(page, '04-day1-better-ends')
})

test('Edzés Mai · kímélő mód return: Üdv újra!, the comeback note, Kikapcsolom, the Terv week @ 320px', async ({ page }) => {
  await open(page, '/train/mai?day=1') // Kedd — a past missed gym day, so the period starts 2 days back
  await page.locator('.trm-sess', { hasText: 'Legs' }).getByRole('button', { name: 'Kihagytam' }).click()
  await pickRecovery(page, '2–3 nap', '05-sheet-retro')
  await expect(page.locator('.trm-sess', { hasText: 'Legs' }).getByText('KÍMÉLŐ MÓD', { exact: true })).toBeVisible()
  await expect(page.locator('.trm-day-km').first()).toBeVisible()
  await expectContained(page, '.trm-sess.is-skip, .trm-sess.is-skip .trm-skipd')
  await shot(page, '06-protected-card')

  // the Terv week: protected days read „Kímélő mód · … kimarad" (in-app nav keeps the mock state)
  await page.getByRole('link', { name: 'Terv' }).first().click()
  await expect(page.locator('.tv-dayrest.is-km').first()).toBeVisible()
  await page.locator('.tv-dayrest.is-km').first().scrollIntoViewIfNeeded()
  await expectContained(page, '.tv-dayrest.is-km')
  await shot(page, '07-terv-week')
  await page.getByRole('link', { name: 'Mai' }).first().click()

  const hero = page.locator('.trm-hero.is-km')
  await expect(hero.getByText('KÍMÉLŐ MÓD · 3. nap')).toBeVisible()
  await shot(page, '08-recovery-hero-day3')
  await hero.getByRole('button', { name: 'Jobban vagyok' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Üdv újra!')).toBeVisible()
  await expect(dialog.getByText(/2 nap kiesés/)).toBeVisible()
  const sheet = await dialog.evaluate((el) => ({ scroll: el.scrollWidth, width: el.clientWidth }))
  expect(sheet.scroll).toBeLessThanOrEqual(sheet.width + 1)
  await shot(page, '09-udv-ujra')
  await dialog.getByRole('button', { name: 'Rendben' }).click()
  await expect(dialog).toBeHidden()

  const back = page.locator('.trm-hero')
  await expect(back.getByText('VISSZATÉRŐ EDZÉS · 1/1')).toBeVisible()
  await back.locator('.trm-cbnote').scrollIntoViewIfNeeded()
  await expectContained(page, '.trm-cbnote, .trm-cbacts')
  await shot(page, '10-comeback-pill')
  // the quiet links must never sit under the fixed quick-log FAB (bottom-right): scrolled level
  // with the FAB, their centre must hit the link itself, and they must stay clear
  // of the FAB's column at any scroll position.
  for (const name of ['Kikapcsolom a könnyítést', 'Mégsem vagyok jól']) {
    const link = back.getByRole('button', { name })
    await link.scrollIntoViewIfNeeded()
    const hit = await link.evaluate((el) => {
      // worst case: scroll the link level with the FAB's own centre line
      const fabBox = document.querySelector('.quicklog-fab')?.getBoundingClientRect()
      if (fabBox) {
        const now = el.getBoundingClientRect()
        const sc = document.querySelector('.screen-content') as HTMLElement
        sc.scrollTop += (now.top + now.height / 2) - (fabBox.top + fabBox.height / 2)
      }
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      const fab = document.querySelector('.quicklog-fab')?.getBoundingClientRect()
      return { onLink: Boolean(top && el.contains(top)), right: r.right, fabLeft: fab ? fab.left : Infinity }
    })
    expect(hit.onLink, name).toBe(true)
    expect(hit.right, name).toBeLessThanOrEqual(hit.fabLeft)
  }
  await back.getByRole('button', { name: 'Kikapcsolom a könnyítést' }).click()
  await expect(page.getByText('BETERVEZVE')).toBeVisible()
  await expect(page.locator('.trm-cbnote')).toHaveCount(0)
  await shot(page, '11-waived')
})
