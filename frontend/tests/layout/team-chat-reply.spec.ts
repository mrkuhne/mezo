import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/**
 * S7 (mezo-d6ivw.7, Task 9) layout invariant — the same class this harness exists for
 * (`layout.spec.ts`'s header comment): content must be REACHABLE, never clipped, and never
 * forced into horizontal scroll on a real phone width. Mock mode's seeded "Késői étkezés" ügy
 * (`teamChatMock.ts`, `OPEN_ID`) lets a concrete reason ("… röpi kupa") close + remember without
 * a real backend — the reply flow (`mockReplyAfter`) resolves the ügy with `closeReason: 'REPLY'`
 * and a `remembered` chip after the ~1.2s typing delay.
 */
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

test('csapatfal válasz: REPLY-buborék, lezáró címke, Megjegyeztem chip — 320px, nincs vízszintes túlcsordulás', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
  await page.goto('/mezo/elo')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  // The "Késői étkezés" ügy (Falat, `tc-thread-late-eating`) is the one whose reply flow this
  // test drives — its OPEN line is `tc-line-9` (`teamChatMock.ts`), so its own trio is targeted
  // directly rather than "the first Elmesélem on the page" (an earlier, differently-owned ügy).
  const lateEatingLine = page.locator('#tc-tc-line-9')
  await lateEatingLine.scrollIntoViewIfNeeded()
  await lateEatingLine.getByRole('button', { name: /Elmesélem/ }).click()
  const textarea = page.getByLabel('A válaszod')
  await textarea.waitFor({ state: 'visible' })
  await textarea.fill('10-kor ért véget a röpi kupa')
  await page.getByRole('button', { name: /Válasz küldése/ }).click()

  // The sheet closes only on a confirmed save; the reply then lands as a REPLY line, and Falat's
  // synthetic answer follows after the mock's ~1.2s typing beat.
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Rendben, ez most tényleg kivétel volt', { exact: false })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(/Falat lezárta: meccsnap/)).toBeVisible()
  await expect(page.getByText(/Megjegyeztem:/)).toBeVisible()

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(320)
})
