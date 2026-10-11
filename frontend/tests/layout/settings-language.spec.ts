import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/**
 * The „Nyelv" block on /settings/general (mezo-n4wf5.11): the two-button group must give each button a
 * >= 44 px hit area, stay inside its card with >= 20 px of slack at 320 px, and never wrap its labels
 * or push the page sideways. Mock mode.
 */
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

for (const width of [320, 390]) {
  test(`Nyelv block: two 44px buttons, contained, no sideways scroll @ ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 })
    await page.goto('/settings/general')
    await page.waitForLoadState('networkidle')
    const group = page.getByRole('group', { name: 'Az app nyelve' })
    await expect(group).toBeVisible()
    const boxes = await group.getByRole('button').evaluateAll(buttons => buttons.map(b => {
      const r = b.getBoundingClientRect()
      return { left: r.left, right: r.right, width: r.width, height: r.height }
    }))
    expect(boxes).toHaveLength(2)
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.left).toBeGreaterThanOrEqual(20)
      expect(width - box.right).toBeGreaterThanOrEqual(20)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const scroller = await page.locator('.screen-content').evaluate(el => el.scrollWidth <= el.clientWidth).catch(() => true)
    expect(scroller).toBe(true)
  })
}
