import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/** S8 (mezo-d6ivw.12): the four memory signals in the mock chat — reachable, never clipped,
 *  no horizontal scroll at 320px; the reduced-motion branch drops the chip animation. */
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

async function send(page: import('@playwright/test').Page, text: string) {
  const box = page.getByPlaceholder('Mondj valamit…')
  await box.fill(text)
  await box.press('Enter')
  await expect(page.getByText(text).last()).toBeVisible()
  await expect(page.getByText('dolgozom rajta…')).toBeHidden({ timeout: 5000 })
}

test('chat-memória: Megjegyeztem · Megjegyezném · Emlékszem · Elfelejtettem — 320px, nincs vízszintes túlcsordulás', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/mezo/chat?c=new')
  await page.waitForLoadState('networkidle')
  await send(page, 'Dórival és Bencével nyertünk ma!')
  await expect(page.getByText('Megjegyezném:')).toBeVisible()
  await expect(page.getByText('Megjegyeztem:').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mit vettem elő róluk' }).last()).toBeVisible()
  await send(page, 'Bence mondta, hogy Annával is játszhatnánk.')
  await send(page, 'Az Annásat inkább ne jegyezd meg.')
  await expect(page.getByText('Elfelejtettem:')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(overflow).toBeLessThanOrEqual(320)
})

test('chat-memória: reduced motion — no chip animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/mezo/chat?c=new')
  await page.waitForLoadState('networkidle')
  await send(page, 'Dórival nyertünk!')
  const chip = page.locator('.mzc-memchip').first()
  await expect(chip).toBeVisible()
  expect(await chip.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
})

test('chat-memória: „Rólam is" — két gomb a szöveg alatt, 320px, váltás Rólad is · kész-re (mezo-d6ivw.13)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/mezo/chat?c=new')
  await page.waitForLoadState('networkidle')
  await send(page, 'Dórival nyertünk!')
  const chip = page.locator('.mzc-memchip.is-remembered.is-two').first()
  await expect(chip).toBeVisible()
  await expect(chip.getByText('Dóri lapján látod')).toBeVisible()
  const text = await chip.locator('.mzc-memtx').boundingBox()
  const me = chip.getByRole('button', { name: 'Rólam is' })
  const meBox = await me.boundingBox()
  expect(meBox!.y).toBeGreaterThanOrEqual(text!.y + text!.height - 1) // the button row wraps below the text
  const chipBox = await chip.boundingBox()
  expect(meBox!.x + meBox!.width).toBeLessThanOrEqual(chipBox!.x + chipBox!.width)
  await me.click()
  await expect(chip.getByRole('button', { name: 'Rólad is · kész' })).toHaveAttribute('aria-pressed', 'true')
  await expect(chip.getByText('Dóri lapján és a Tudástár Rólad részében is látod')).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(overflow).toBeLessThanOrEqual(320)
})
