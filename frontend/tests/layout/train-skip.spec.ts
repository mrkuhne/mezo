import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/**
 * Kihagyás S1 (mezo-q4xt2.1) — Edzés · Mai with a skipped occurrence, at the narrowest phone.
 * Modelled on layout.spec.ts's „Mai állapot" 320px check: the skipped hero (its glass skipped
 * block + the Másik ok / Visszavonom pills), a skipped session card (the flat inner block) and
 * the „Miért marad ki?" sheet (two chip columns, the Egyéb field with its mic) must all stay
 * horizontally contained — never push the page sideways.
 */
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

async function pageOverflow(page: Page) {
  return page.evaluate(() => {
    const sc = document.querySelector('.screen-content') as HTMLElement
    return sc.scrollWidth - sc.clientWidth
  })
}

async function contained(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[]
    return els.map((el) => {
      const r = el.getBoundingClientRect()
      return { overflow: el.scrollWidth - el.clientWidth, left: r.left, right: r.right, viewport: window.innerWidth }
    })
  }, selector)
}

test('Edzés Mai · the skipped hero and the reason sheet stay contained @ 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.clock.setFixedTime(new Date('2026-05-21T08:42:00')) // a Thursday — the mock Pull day
  await page.goto('/train/mai')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  await page.locator('.trm-hero .trm-skipbtn').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Miért marad ki?')).toBeVisible()
  // Egyéb opens the free-text field with its mic — the widest state of the sheet
  await dialog.getByRole('button', { name: 'Egyéb' }).click()
  await expect(dialog.getByRole('textbox')).toBeVisible()
  const sheet = await dialog.evaluate((el) => ({ scroll: el.scrollWidth, width: el.clientWidth }))
  expect(sheet.scroll).toBeLessThanOrEqual(sheet.width + 1)
  const chipsOutside = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return Array.from(el.querySelectorAll('.trm-whyc, .trm-micb, .uvl-cta, .uvl-ghost'))
      .filter((c) => c.getBoundingClientRect().right > r.right + 0.5).length
  })
  expect(chipsOutside).toBe(0)
  await dialog.getByRole('button', { name: 'Most nem mondom' }).click()
  await expect(dialog).toBeHidden()

  const hero = page.locator('.trm-hero.is-skip')
  await expect(hero).toBeVisible()
  await expect(hero.getByText('KIHAGYVA', { exact: true })).toBeVisible()
  const undo = page.getByRole('button', { name: 'Visszavonom' })
  await undo.scrollIntoViewIfNeeded()
  await expect(undo).toBeVisible()
  await expect(page.getByRole('button', { name: 'Másik ok' })).toBeVisible()
  for (const b of await contained(page, '.trm-hero .trm-skipd, .trm-hero .trm-skacts')) {
    expect(b.overflow).toBeLessThanOrEqual(1)
    expect(b.left).toBeGreaterThanOrEqual(-0.5)
    expect(b.right).toBeLessThanOrEqual(b.viewport + 0.5)
  }
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
})

test('Edzés Mai · a past day\'s skipped card stays contained @ 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.clock.setFixedTime(new Date('2026-05-21T08:42:00')) // Thursday — Kedd is ELMARADT
  await page.goto('/train/mai?day=1')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  const card = page.locator('.trm-sess', { hasText: 'Legs' })
  const pills = await contained(page, '.trm-sess-cta')
  for (const b of pills) expect(b.right).toBeLessThanOrEqual(b.viewport + 0.5)
  await card.getByRole('button', { name: 'Kihagytam' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Beteg vagyok' }).click()
  await dialog.getByRole('button', { name: /Kész/ }).click()
  await expect(dialog).toBeHidden()

  await expect(card).toHaveClass(/is-skip/)
  await expect(card.getByText('Kihagyva · Beteg vagyok')).toBeVisible()
  for (const b of await contained(page, '.trm-sess.is-skip, .trm-sess.is-skip .trm-skipd, .trm-sess.is-skip .trm-skacts')) {
    expect(b.overflow).toBeLessThanOrEqual(1)
    expect(b.right).toBeLessThanOrEqual(b.viewport + 0.5)
  }
  await expect(page.locator('.trm-day-sk')).toHaveCount(1)
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
})
