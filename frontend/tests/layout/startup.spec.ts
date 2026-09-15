import { expect, test } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'

test.beforeEach(async ({ page }) => { await seedKalauzSeen(page) })

test('Titanium startup fills the viewport, pulses three times and reveals Mai', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  await page.goto('/')
  const splash = page.getByRole('status', { name: 'Mezo betöltése' })
  await expect(splash).toBeVisible()
  expect(await splash.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 })
  await expect(page.locator('.startup-content')).toHaveAttribute('inert', '')
  expect(await page.locator('.startup-splash__mark').evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.animationDuration, style.animationIterationCount]
  })).toEqual(['0.9s', '3'])
  expect(await splash.evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.animationDuration, style.animationDelay]
  })).toEqual(['0.3s', '2.7s'])
  // Jump the deadline without rendering 180 software-WebGL frames on CI.
  await page.clock.fastForward(3000)
  await expect(splash).toHaveCount(0)
  await expect(page).toHaveURL(/\/nap$/)
  await expect(page.locator('.startup-content')).not.toHaveAttribute('inert')
  await page.getByRole('link', { name: 'Rutin', exact: true }).click()
  await expect(page).toHaveURL(/\/nap\/rutin$/)
  await expect(splash).toHaveCount(0)
})

test('reduced-motion startup is static, fullscreen on desktop and preserves deep links', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  await page.goto('/nap/rutin')
  const splash = page.getByRole('status', { name: 'Mezo betöltése' })
  await expect(splash).toBeVisible()
  expect(await splash.boundingBox()).toEqual({ x: 0, y: 0, width: 1280, height: 800 })
  await expect(splash.locator('.titan-svg')).toHaveCount(1)
  await expect(splash.locator('canvas')).toHaveCount(0)
  expect(await splash.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  await page.clock.fastForward(3000)
  await expect(splash).toHaveCount(0)
  await expect(page).toHaveURL(/\/nap\/rutin$/)
})
