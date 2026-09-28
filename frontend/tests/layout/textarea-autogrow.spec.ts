import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/**
 * Long text grows the field (chat-window sizing): the Mezo chat composer used to stop at ~4
 * lines (104px), so a dictated paragraph sat in a tiny box that was hard to scroll. Every
 * textarea now grows with its text up to 40% of the screen, and only then scrolls inside.
 */
const LONG = 'Ó, megint egy hosszú álomról mesélek, és nem volt jó. '.repeat(12)

test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

test('Mezo chat: a mező a szöveggel nő, a képernyő 40%-áig', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/mezo/chat')
  const box = page.locator('.chat-composer textarea')
  await box.waitFor({ state: 'visible' })
  const empty = (await box.boundingBox())!.height

  await box.fill('Rövid kérdés')
  expect((await box.boundingBox())!.height).toBeCloseTo(empty, 0)

  await box.fill(LONG)
  const grown = (await box.boundingBox())!.height
  expect(grown).toBeGreaterThan(200)
  expect(grown).toBeLessThanOrEqual(844 * 0.4 + 1)
  // Past the cap the field scrolls inside, the composer stays on screen.
  expect(await box.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  const composer = (await page.locator('.chat-composer').boundingBox())!
  expect(composer.y).toBeGreaterThanOrEqual(0)

  await box.fill('')
  expect((await box.boundingBox())!.height).toBeCloseTo(empty, 0)
})

test('Csapatfal válasz-sheet: a szövegmező is nő', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
  await page.goto('/mezo/elo')
  await page.waitForLoadState('networkidle')
  const line = page.locator('#tc-tc-line-9')
  await line.scrollIntoViewIfNeeded()
  await line.getByRole('button', { name: /Elmesélem/ }).click()
  const box = page.getByLabel('A válaszod')
  await box.waitFor({ state: 'visible' })
  const before = (await box.boundingBox())!.height
  await box.fill(LONG)
  const after = (await box.boundingBox())!.height
  expect(after).toBeGreaterThan(before)
  expect(after).toBeLessThanOrEqual(800 * 0.4 + 1)
})

test('Kódból beírt szöveg (pl. diktálás) is megnöveli a mezőt, koppintás nélkül', async ({ page }) => {
  // The reply sheet has no resize code of its own — only the app-wide autoGrow can grow it here.
  await page.setViewportSize({ width: 320, height: 800 })
  await page.clock.setFixedTime(new Date('2026-05-21T13:42:00'))
  await page.goto('/mezo/elo')
  await page.waitForLoadState('networkidle')
  const line = page.locator('#tc-tc-line-9')
  await line.scrollIntoViewIfNeeded()
  await line.getByRole('button', { name: /Elmesélem/ }).click()
  const box = page.getByLabel('A válaszod')
  await box.waitFor({ state: 'visible' })
  const empty = (await box.boundingBox())!.height
  // Stand-in for dictation: set the DOM value directly, no typing, no tap, no input event.
  await box.evaluate((el, text) => { (el as HTMLTextAreaElement).value = text }, LONG)
  await expect.poll(async () => (await box.boundingBox())!.height).toBeGreaterThan(empty + 60)
})
