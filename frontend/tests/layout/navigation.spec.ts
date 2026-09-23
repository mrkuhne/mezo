import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

const domains = [
  ['/nap', 'Nap'], ['/train/mai', 'Edzés'], ['/fuel', 'Fuel'],
  ['/mezo', 'Mezo'], ['/me', 'Én'],
] as const

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 852 }, { width: 1000, height: 1100 }]) {
  test(`docked menus and panel-free switcher at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await seedKalauzSeen(page)
    await seedSplashSkipped(page)
    await page.addInitScript(() => localStorage.setItem('mezo-theme', 'dark'))
    for (const [route, name] of domains) {
      await page.goto(route)
      const nav = page.getByRole('navigation', { name: `${name} menü`, exact: true })
      await expect(nav).toBeVisible()
      const phone = await page.locator('.phone-screen').boundingBox()
      const before = await nav.boundingBox()
      // Üveg (bible §7.2, mezo-me75u.1): ONE floating glass bar, 10px off the sides and 12px
      // off the bottom — fixed, whatever the page scrolls.
      expect(before!.x).toBeCloseTo(phone!.x + 10, 0)
      expect(before!.width).toBeCloseTo(phone!.width - 20, 0)
      expect(before!.y + before!.height).toBeCloseTo(phone!.y + phone!.height - 12, 0)
      await expect(nav).toHaveClass(/\bglass\b/)
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
      // The switcher is ONE glass card (bible §7.2) — no sheet chrome, no hard border.
      await expect(dialog).toHaveClass(/\bglass\b/)
      const style = await dialog.evaluate(el => ({ border: getComputedStyle(el).borderWidth }))
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
    await seedSplashSkipped(page)
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

test('menu Boops blink and look around, with orange Nap and blue Train', async ({ page }, testInfo) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/nap')
  const opener = page.getByRole('button', { name: 'Területváltó: Nap' })
  await expect(opener).toBeVisible()
  await expect(opener.locator('.domain-switch-name')).toHaveCount(0)
  const avatar = opener.locator('svg.boop')
  // Sample real browser transforms at open/closed and centered/sideways keyframes.
  const motion = await avatar.evaluate(el => {
    const eye = el.querySelector('.boop-eye')!
    const pupil = el.querySelector('.boop-pupil')!
    const blink = eye.getAnimations()[0]
    const gaze = pupil.getAnimations()[0]
    if (!blink || !gaze) return null
    blink.pause(); gaze.pause()
    blink.currentTime = 0; gaze.currentTime = 0
    const open = new DOMMatrix(getComputedStyle(eye).transform).d
    const center = new DOMMatrix(getComputedStyle(pupil).transform).e
    blink.currentTime = 2580; gaze.currentTime = 2800
    return { open, closed: new DOMMatrix(getComputedStyle(eye).transform).d,
      center, side: new DOMMatrix(getComputedStyle(pupil).transform).e }
  })
  expect(motion).not.toBeNull()
  expect(motion!.open).toBeCloseTo(1)
  expect(motion!.closed).toBeLessThan(.15)
  expect(motion!.side).not.toBe(motion!.center)
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Területváltó', exact: true })
  await expect(dialog.locator('svg.boop.is-alive')).toHaveCount(5)
  for (const [domain, color] of [['nap', '#FF7A55'], ['train', '#6BA6D6']]) {
    await expect(dialog.locator(`[data-domain="${domain}"] radialGradient[id$="-body"] stop[offset="0.5"]`))
      .toHaveAttribute('stop-color', color)
  }
  for (const eye of await dialog.locator('.boop-eye').all()) {
    expect(await eye.evaluate(el => el.getAnimations().length)).toBeGreaterThan(0)
  }
  await page.screenshot({ path: testInfo.outputPath('boop-menu.png') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await dialog.locator('svg.boop').evaluateAll(avatars => avatars.flatMap(el => el.getAnimations({ subtree: true })).length)).toBe(0)
})
