import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

// ── „Hogy tanultam?” (mezo-3n2so, learned expenditure part 2, spec §5.3) at the app's hardest
// width, mock mode. The page carries the widest rows in Fuel — the week detail's tiles, the day
// rows (date + state + switch) and the chart's HTML tap overlay — so the invariant is the layout
// harness's usual one: no horizontal page scroll, and the last day row clears the tab bar.
// Folyadék F5 (mezo-n4wf5.5): the page is the kit `Page` (`.ft-page`); the chart is `.ft-weeks`
// under `.ft-hits > button` tap columns, the week detail `.ft-wkd` (Fuel-shared `.fx-kv` tiles),
// a day a kit row `.ft-day` with the kit switch.
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

test('Hogy tanultam? stays contained at 320px and its last day row clears the tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.goto('/fuel/tanulas')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  // ONE heading names the page: the title bar's (the page's own second h1 left with the old skin)
  await expect(page.locator('.fo-top h1')).toHaveText('Hogy tanultam?')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('.fo-page.ft-page .fo-hero')).toHaveCount(1)
  await expect(page.getByRole('img', { name: /A keret alapja hétről hétre/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  // the harness runs with reduced motion: the chart's one-shot draw is never armed
  await expect(page.locator('.ft-weeks')).toHaveCount(1)
  await expect(page.locator('.ft-weeks')).not.toHaveClass(/is-draw/)

  // every week-detail tile and day row fits its card
  const cells = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.ft-wkd .fx-kv > div, .ft-day')]
    return { tiles: document.querySelectorAll('.ft-wkd .fx-kv > div').length, days: document.querySelectorAll('.ft-day').length,
      overflow: els.filter(el => el.scrollWidth > el.clientWidth + 1).length }
  })
  expect(cells.tiles).toBeGreaterThan(3)
  expect(cells.days).toBeGreaterThan(6)
  expect(cells.overflow).toBe(0)
  // the tap columns over the chart: one per week, each a 44 px tall target inside the card
  const hits = await page.locator('.ft-hits > button').evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect(); const c = (el.closest('.fo-card') as HTMLElement).getBoundingClientRect()
    return { h: r.height, inside: r.left >= c.left - 0.5 && r.right <= c.right + 0.5 }
  }))
  expect(hits.length).toBe(12)
  expect(Math.min(...hits.map((h) => h.h))).toBeGreaterThanOrEqual(44)
  expect(hits.every((h) => h.inside)).toBe(true)

  const last = page.locator('.ft-day').last()
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
    const rows = document.querySelectorAll('.ft-day')
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
  await page.locator('.ft-hits > button').nth(3).click()
  await expect(page.locator('.ft-wkd')).toContainText('nincs sorom')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
