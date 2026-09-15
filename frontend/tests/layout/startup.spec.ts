import { expect, test } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'

test.beforeEach(async ({ page }) => { await seedKalauzSeen(page) })

test('Titanium startup fills mobile, breathes once with distinct flashes and reveals Mai', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  await page.goto('/')
  const splash = page.getByRole('status', { name: 'Mezo betöltése' })
  await expect(splash).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.clock.fastForward(350)
  await page.clock.runFor(40)
  await expect(page.locator('.startup-stage')).toHaveAttribute('data-ready', 'true')
  await expect(splash.locator('.titan-svg')).toHaveCount(0)
  expect(await splash.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 })
  await expect(page.locator('.startup-content')).toHaveAttribute('inert', '')
  expect(await page.locator('.startup-splash__mark').evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.animationDuration, style.animationIterationCount]
  })).toEqual(['3s', '1'])
  expect(await page.locator('.startup-splash__light').evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.animationName, style.animationDuration, style.animationIterationCount]
  })).toEqual(['startup-flashes', '3s', '1'])
  const flashes = await page.locator('.startup-splash__light').evaluate((element) => {
    const animation = element.getAnimations()[0]
    animation.pause()
    return [300, 480, 900, 1380, 1770, 2340].map((time) => {
      animation.currentTime = time
      return getComputedStyle(element).filter
    })
  })
  expect(flashes).toEqual(['brightness(1)', 'brightness(1.9)', 'brightness(1)', 'brightness(1.65)', 'brightness(1)', 'brightness(2.1)'])
  expect(await page.locator('.startup-stage').evaluate((element) => {
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

test('a cold 3D chunk never shows a transient 2D mark or spends the animation early', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/TitanScene.tsx', async (route) => { await held; await route.continue() })
  await page.goto('/')
  const stage = page.locator('.startup-stage')
  await expect(stage).toHaveAttribute('data-ready', 'false')
  await page.clock.fastForward(1200)
  await expect(stage.locator('.titan-svg')).toHaveCount(0)
  expect(await stage.evaluate((element) => element.getAnimations({ subtree: true })
    .filter((animation) => 'animationName' in animation && String(animation.animationName).startsWith('startup-')).length)).toBe(0)
  release()
  await page.waitForLoadState('networkidle')
  await page.clock.fastForward(350)
  await page.clock.runFor(40)
  await expect(stage).toHaveAttribute('data-ready', 'true')
  await expect(stage.locator('canvas')).toHaveCount(1)
  await expect(stage.locator('.titan-svg')).toHaveCount(0)
  await page.clock.fastForward(3000)
  await expect(stage).toHaveCount(0)
})

test('desktop startup stays inside the phone screen and reduced motion remains static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  await page.goto('/nap/rutin')
  const splash = page.getByRole('status', { name: 'Mezo betöltése' })
  await expect(splash).toBeVisible()
  const phoneScreen = page.locator('.startup-stage .phone-screen')
  await expect(phoneScreen).toBeVisible()
  expect(await splash.boundingBox()).toEqual(await phoneScreen.boundingBox())
  expect((await splash.boundingBox())!.width).toBe(416)
  await expect(splash.locator('.titan-svg')).toHaveCount(1)
  await expect(splash.locator('canvas')).toHaveCount(0)
  expect(await splash.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  await page.clock.fastForward(3000)
  await expect(splash).toHaveCount(0)
  await expect(page).toHaveURL(/\/nap\/rutin$/)
})
