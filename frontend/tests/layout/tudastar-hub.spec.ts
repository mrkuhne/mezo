import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

// ── Tudástár hub (mezo-d6ivw.6): the four S6 sections (Rólad, Emberek, Észrevételek,
// Hatások) plus the hub tile grid itself, at the app's hardest width. Same invariant class
// as `layout.spec.ts`'s "A napom" block: no horizontal scroll, and the last row clears the
// floating glass tab bar. Two extra traps called out by the brief: the Hatások card head's
// absolutely positioned ⋯ (B12) and the undo bar's `--tabbar-h` fallback (B7, the variable
// is never defined anywhere in the app, so the 84px fallback is what ships).
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

const HUB_ROUTES: Array<[string, string, string]> = [
  ['hub', '/mezo/knowledge', '.th-tile'],
  ['Rólad', '/mezo/knowledge?view=tenyek', '.th-fold, .th-row'],
  ['Emberek', '/mezo/knowledge?view=emberek', '.th-prow'],
  ['Észrevételek', '/mezo/knowledge?view=eszrevetelek', '.th-fold, .th-row'],
  ['Hatások', '/mezo/knowledge?view=hatasok', '.th-fold, .th-eff'],
]

for (const [name, path, rows] of HUB_ROUTES) {
  test(`Tudástár · ${name} stays contained and its last row clears the tab bar @ 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 820 })
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const last = page.locator(rows).last()
    await last.scrollIntoViewIfNeeded()
    await last.evaluate((element) => {
      const scroller = document.querySelector('.screen-content') as HTMLElement
      const tabbar = document.querySelector('.tab-bar')?.getBoundingClientRect()
      if (!tabbar) return
      const overlap = element.getBoundingClientRect().bottom - tabbar.top
      scroller.style.scrollBehavior = 'auto'
      if (overlap > 0) scroller.scrollTop += overlap + 4
    })
    await expect(last).toBeVisible()
    const spacing = await page.evaluate((selector) => {
      const matches = document.querySelectorAll(selector)
      const lastEl = matches[matches.length - 1] as HTMLElement
      const row = lastEl.getBoundingClientRect()
      const tabbar = document.querySelector('.tab-bar')!.getBoundingClientRect()
      return { rowBottom: row.bottom, tabbarTop: tabbar.top }
    }, rows)
    expect(spacing.rowBottom).toBeLessThanOrEqual(spacing.tabbarTop - 1)
  })
}

test('Tudástár · the ⋯ strip wraps inside the row at 320px (no horizontal scroll)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.goto('/mezo/knowledge?view=tenyek')
  await page.getByRole('button', { name: /Étkezés ·/ }).click()
  await page.getByRole('button', { name: 'További műveletek' }).first().click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('Tudástár · the undo bar floats above the tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.goto('/mezo/knowledge?view=tenyek')
  await page.getByRole('button', { name: /Étkezés ·/ }).click()
  await page.getByRole('button', { name: 'További műveletek' }).first().click()
  await page.getByRole('button', { name: /Elfelejtem/ }).click()
  const bar = await page.locator('.th-undo').boundingBox()
  const tab = await page.locator('.tab-bar').boundingBox()
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(tab!.y)
})
