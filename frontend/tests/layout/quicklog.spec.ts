import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

for (const width of [320, 390, 430]) {
  for (const theme of ['light', 'dark']) {
    for (const label of ['Víz', 'Súly', 'Sport', 'Check-in', 'Napló', 'Alvás']) {
    test(`the ${label} capture sheet remains reachable at ${width}px in ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 852 })
      await page.clock.setFixedTime(new Date('2026-05-21T13:42:00+02:00'))
      await seedKalauzSeen(page)
    await seedSplashSkipped(page)
      await page.addInitScript(t => localStorage.setItem('mezo-theme', t), theme)
        await page.goto(theme === 'light' ? '/me' : '/nap/gyors')
        if (theme === 'light') await page.getByRole('button', { name: 'Gyors logolás', exact: true }).click()
        if (theme === 'dark') await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
        else await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')
        await page.locator('.quicklog').getByRole('button', { name: new RegExp(`^${label}`) }).click()
        if (label === 'Napló') await page.locator('.quicklog').getByRole('button', { name: /^Napló/ }).click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()
        await expect(dialog.getByRole('button', { name: 'Bezárás', exact: true })).toBeVisible()
        const bounds = await dialog.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }))
        expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1)
        if (label === 'Víz') {
          await dialog.getByRole('button', { name: '400 ml' }).click()
          await expect(dialog.getByRole('status', { name: 'Rögzítendő vízmennyiség' })).toContainText('400 ml')
        }
        const lastButton = dialog.getByRole('button').last()
        await lastButton.scrollIntoViewIfNeeded()
        await expect(lastButton).toBeInViewport()
        if (width === 390 && theme === 'dark') {
          await dialog.evaluate(el => { el.scrollTop = 0 })
          await page.screenshot({ path: testInfo.outputPath('capture.png') })
        }
        await page.keyboard.press('Escape')
        await expect(dialog).not.toBeVisible()
    })
    }
  }
}
