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

test('a startup betölti a telefon-képernyőt, a gömb töltődik, az ikonok keringenek, majd átadja a Mai-t', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  await page.goto('/')
  const splash = page.getByRole('status', { name: 'Boop betöltése' })
  await expect(splash).toBeVisible()
  await page.waitForLoadState('networkidle')

  // A jel az üveggömb (U10, mezo-me75u.10): levendula folyadékkal, nem a Titán jelenet — se canvas, se 3D SVG.
  await expect(splash.locator('.startup-splash__orb.glass')).toHaveCount(1)
  await expect(splash.locator('.startup-splash__liquid')).toHaveCount(1)
  await expect(splash.locator('canvas')).toHaveCount(0)
  await expect(splash.locator('.titan-svg')).toHaveCount(0)
  await expect(splash.locator('.startup-splash__wordmark')).toHaveText('boop')

  expect(await splash.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 })
  await expect(page.locator('.startup-content')).toHaveAttribute('inert', '')

  // Töltődés + keringés (mezo-1dxhp): a gömb üresen indul, öt sprite-ikon egyesével felvillan
  // körülötte és kering, a folyadék a kivezetésig emelkedik — és a kör a telefonon belül marad.
  const icons = splash.locator('.startup-splash__orbit-ic')
  await expect(icons).toHaveCount(5)
  const level = () => splash.locator('.startup-splash__level').getAttribute('transform')
  expect(await level()).toBe('translate(0 62)')
  await page.clock.runFor(1600)
  expect(await icons.evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity))).toEqual(['1', '1', '1', '1', '1'])
  expect(await level()).not.toBe('translate(0 62)')
  for (const box of await icons.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(390)
  }
  // A kivezetés pontosan a három másodperc VÉGÉN kezdődik.
  expect(await page.locator('.startup-stage').evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.animationDuration, style.animationDelay]
  })).toEqual(['0.3s', '2.7s'])

  await page.clock.fastForward(1400)
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
  await expect(splash.locator('.startup-splash__orb.glass')).toHaveCount(1)
  expect(await splash.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  // …és a nyugalmi kocka áll: a gömb ~70%-ig tele, az öt ikon a helyén (mezo-1dxhp).
  expect(await splash.locator('.startup-splash__level').getAttribute('transform')).toBe('translate(0 -40)')
  expect(await splash.locator('.startup-splash__orbit-ic').evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity)))
    .toEqual(['1', '1', '1', '1', '1'])
  await page.clock.fastForward(3000)
  await expect(splash).toHaveCount(0)
  await expect(page).toHaveURL(/\/nap\/rutin$/)
})
