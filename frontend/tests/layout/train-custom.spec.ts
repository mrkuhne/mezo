import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/** Saját edzés composer (mezo-7ugb5) at the narrowest phone: the hero, the glass name card,
 *  an OPEN recipe row (three stepper pairs + switch + foot actions) and the CTA pair stay
 *  horizontally contained. */
test.beforeEach(async ({ page }) => { await seedKalauzSeen(page); await seedSplashSkipped(page) })

const overflow = (page: Page) => page.evaluate(() => {
  const sc = document.querySelector('.screen-content') as HTMLElement
  return sc.scrollWidth - sc.clientWidth
})

for (const path of ['/train/custom/new', '/train/custom/custom-1']) {
  test(`${path} stays contained @ 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 820 })
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    if (path.endsWith('custom-1')) {
      // the row head (SortableList's handle and ▲▼ also carry the exercise name)
      await page.locator('.uvx-cw-head').first().click()
      await expect(page.locator('.uvx-cw-st')).toHaveCount(6)
    }
    expect(await overflow(page)).toBeLessThanOrEqual(1)
    const boxes = await page.evaluate(() => Array.from(document.querySelectorAll('.uvx-cw-st, .uvx-cw-cta button, .uvx-cw-name'))
      .map((el) => { const r = el.getBoundingClientRect(); return r.right <= innerWidth + 0.5 && r.left >= -0.5 }))
    expect(boxes.every(Boolean)).toBe(true)
  })
}
