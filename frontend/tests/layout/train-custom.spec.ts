import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/** Saját edzés composer (mezo-7ugb5; Folyadék mezo-n4wf5.3) at the narrowest phone: the hero with
 *  the name field and its two buttons, an OPEN recipe row (six − value + lines, the switch, the
 *  foot links) stay horizontally contained. */
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
      await page.locator('.ee-exh').first().click()
      await expect(page.locator('.ee-sjp .fo-stp')).toHaveCount(6)
    }
    expect(await overflow(page)).toBeLessThanOrEqual(1)
    const boxes = await page.evaluate(() => Array.from(document.querySelectorAll('.ee-sjp .fo-stp, .fo-hero-acts button, .fo-hero .fo-in'))
      .map((el) => { const r = el.getBoundingClientRect(); return r.right <= innerWidth + 0.5 && r.left >= -0.5 }))
    expect(boxes.every(Boolean)).toBe(true)
  })
}
