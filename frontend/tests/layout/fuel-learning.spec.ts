import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

// ── „Hogy tanultam?” (mezo-3n2so, learned expenditure part 2, spec §5.3) at the app's hardest
// width, mock mode. The page carries the widest rows in Fuel — the 3-column week detail, the
// day rows (date + chip + switch) and the chart's HTML tap overlay — so the invariant is the
// layout harness's usual one: no horizontal page scroll, and the last day row clears the tab bar.
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

test('Hogy tanultam? stays contained at 320px and its last day row clears the tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.goto('/fuel/tanulas')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  // the page's own heading (the shell's title bar names the page too, until the page is re-dressed)
  await expect(page.locator('h1.fkx-title', { hasText: 'Hogy tanultam?' })).toBeVisible()
  await expect(page.locator('.fo-top h1')).toHaveText('Hogy tanultam?')
  await expect(page.getByRole('img', { name: /A keret alapja hétről hétre/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  // the harness runs with reduced motion: the chart's one-shot draw is never armed
  await expect(page.locator('.fln-chart')).not.toHaveClass(/is-draw/)

  // every week-detail cell and day row fits its card
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll('.fln-kv-cell, .fln-day')].filter(el => el.scrollWidth > el.clientWidth + 1).length)
  expect(overflow).toBe(0)

  const last = page.locator('.fln-day').last()
  await last.scrollIntoViewIfNeeded()
  await last.evaluate((element) => {
    const scroller = document.querySelector('.screen-content') as HTMLElement
    const tabbar = document.querySelector('.fo-nav')?.getBoundingClientRect()
    if (!tabbar) return
    const overlap = element.getBoundingClientRect().bottom - tabbar.top
    scroller.style.scrollBehavior = 'auto'
    if (overlap > 0) scroller.scrollTop += overlap + 4
  })
  await expect(last).toBeVisible()
  const spacing = await page.evaluate(() => {
    const rows = document.querySelectorAll('.fln-day')
    const row = rows[rows.length - 1].getBoundingClientRect()
    const tabbar = document.querySelector('.fo-nav')!.getBoundingClientRect()
    return { rowBottom: row.bottom, tabbarTop: tabbar.top }
  })
  expect(spacing.rowBottom).toBeLessThanOrEqual(spacing.tabbarTop - 1)
})

test('Hogy tanultam? · tapping the gap week keeps the page contained at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.goto('/fuel/tanulas')
  await page.waitForLoadState('networkidle')
  await page.locator('.fln-hit').nth(3).click()
  await expect(page.locator('.fln-wkd')).toContainText('nincs sorom')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
