// Indító-képernyő, valódi böngészőben (mezo-qducz; visszaöltöztetve mezo-ju4j6.3).
//
// A Titán változat egy WebGL jelenetet töltött be, ezért ez a fájl korábban a betöltés
// versenyhelyzeteit méregette (hideg chunk, „készen van-e", három fényvillanás). A
// visszaállított jel STATIKUS agyag-gömb halo-sávon, tehát azok a helyzetek megszűntek —
// ami MARADT és amit a jsdom nem tud megnézni: a valódi geometria (a jel a telefon-
// képernyőt tölti ki, asztali szélességen sem lóg ki), az egyszeri koreográfia
// időzítése és a csökkentett mozgás ága.
import { expect, test } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'

test.beforeEach(async ({ page }) => { await seedKalauzSeen(page) })

test('a startup betölti a telefon-képernyőt, egyszer lélegzik, majd átadja a Mai-t', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  await page.goto('/')
  const splash = page.getByRole('status', { name: 'Boop betöltése' })
  await expect(splash).toBeVisible()
  await page.waitForLoadState('networkidle')

  // A jel az agyag-gömb, nem a Titán jelenet — se canvas, se a 3D SVG változata.
  await expect(splash.locator('.startup-splash__mark use')).toHaveAttribute('href', '#s-orb')
  await expect(splash.locator('canvas')).toHaveCount(0)
  await expect(splash.locator('.titan-svg')).toHaveCount(0)
  await expect(splash.locator('.startup-splash__wordmark')).toHaveText('boop')

  expect(await splash.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 })
  await expect(page.locator('.startup-content')).toHaveAttribute('inert', '')

  // Egyetlen lassú lélegzet, és a kivezetés pontosan a három másodperc VÉGÉN kezdődik.
  expect(await page.locator('.startup-splash__mark').evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.animationName, style.animationDuration, style.animationIterationCount]
  })).toEqual(['startup-breath', '3s', '1'])
  expect(await page.locator('.startup-stage').evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.animationDuration, style.animationDelay]
  })).toEqual(['0.3s', '2.7s'])

  await page.clock.fastForward(3000)
  await expect(splash).toHaveCount(0)
  await expect(page).toHaveURL(/\/nap$/)
  await expect(page.locator('.startup-content')).not.toHaveAttribute('inert')
  // Útvonalváltásra nem játszik újra — az intro az app-gyökér élettartamáé.
  await page.getByRole('link', { name: 'Rutin', exact: true }).click()
  await expect(page).toHaveURL(/\/nap\/rutin$/)
  await expect(splash).toHaveCount(0)
})

test('asztali szélességen a telefon-képernyőn belül marad, csökkentett mozgásnál statikus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  await page.goto('/nap/rutin')
  const splash = page.getByRole('status', { name: 'Boop betöltése' })
  await expect(splash).toBeVisible()
  const phoneScreen = page.locator('.startup-stage .phone-screen')
  await expect(phoneScreen).toBeVisible()
  expect(await splash.boundingBox()).toEqual(await phoneScreen.boundingBox())
  expect((await splash.boundingBox())!.width).toBe(416)
  // Csökkentett mozgás: a jel ott van, de EGYETLEN animáció sem fut — a kivezetés sem.
  await expect(splash.locator('.startup-splash__mark use')).toHaveCount(1)
  expect(await splash.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  await page.clock.fastForward(3000)
  await expect(splash).toHaveCount(0)
  await expect(page).toHaveURL(/\/nap\/rutin$/)
})
