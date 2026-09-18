import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'

const domains = [
  ['/nap', 'Nap'], ['/train/mai', 'Edzés'], ['/fuel', 'Fuel'],
  ['/mezo', 'Mezo'], ['/me', 'Én'],
] as const

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 852 }, { width: 1000, height: 1100 }]) {
  test(`docked menus and panel-free switcher at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await seedKalauzSeen(page)
    await page.addInitScript(() => localStorage.setItem('mezo-theme', 'dark'))
    for (const [route, name] of domains) {
      await page.goto(route)
      const nav = page.getByRole('navigation', { name: `${name} menü`, exact: true })
      await expect(nav).toBeVisible()
      const phone = await page.locator('.phone-screen').boundingBox()
      const before = await nav.boundingBox()
      expect(before!.x).toBeCloseTo(phone!.x, 0)
      expect(before!.width).toBeCloseTo(phone!.width, 0)
      expect(before!.y + before!.height).toBeCloseTo(phone!.y + phone!.height, 0)
      const links = nav.getByRole('link')
      await expect(links).toHaveCount(4)
      for (const link of await links.all()) {
        const box = await link.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.x + box!.width).toBeLessThanOrEqual(phone!.x + phone!.width)
        expect(await link.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      }
      await page.locator('.screen-content').evaluate(el => { el.scrollTop = el.scrollHeight })
      expect((await nav.boundingBox())!.y).toBeCloseTo(before!.y, 0)
      const opener = nav.getByRole('button', { name: `Területváltó: ${name}` })
      await opener.click()
      const dialog = page.getByRole('dialog', { name: 'Területváltó', exact: true })
      // Five domain cards + the „Minden oldal" leltár row (mezo-ju4j6.17). The
      // `toBeInViewport` loop below covers the row too, which is the assertion that
      // matters at 320px: a sixth control must still fit without scrolling the dialog.
      await expect(dialog.getByRole('button')).toHaveCount(6)
      await expect(dialog.getByRole('button', { name: /Minden oldal/ })).toBeVisible()
      await expect(dialog.getByRole('heading')).toHaveCount(0)
      await expect(page.locator('.sheet')).toHaveCount(0)
      await expect(dialog.locator('[aria-current="true"]')).toBeFocused()
      await expect(nav).toHaveAttribute('inert', '')
      expect(await page.locator('.screen-content').evaluate(el => getComputedStyle(el).overflowY)).toBe('hidden')
      for (const card of await dialog.getByRole('button').all()) await expect(card).toBeInViewport()
      const style = await dialog.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderWidth }))
      expect(style.background).toBe('rgba(0, 0, 0, 0)')
      expect(parseFloat(style.border)).toBe(0)
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await expect(opener).toBeFocused()
      await expect(nav).not.toHaveAttribute('inert', '')
    }
  })
}

test('short landscape switcher scrolls to every choice and backdrop dismisses', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 320 })
  await seedKalauzSeen(page)
  await page.goto('/train/mai')
  const opener = page.getByRole('button', { name: 'Területváltó: Edzés' })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Területváltó' })
  for (const card of await dialog.getByRole('button').all()) {
    await card.scrollIntoViewIfNeeded()
    await expect(card).toBeInViewport()
  }
  await page.locator('.domain-switcher-overlay').click({ position: { x: 3, y: 3 } })
  await expect(dialog).not.toBeVisible()
  await expect(opener).toBeFocused()
})
