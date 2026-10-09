// Indító-képernyő, valódi böngészőben (Folyadék F1, mezo-n4wf5.1: „egy edény, öt csepp").
//
// Amit a jsdom nem tud megnézni: a valódi geometria (a nyitány a telefon-képernyőt tölti ki,
// 320 px-en sem lóg ki), az időzítés (a CSS-idővonal a 3 s-os átadáshoz igazodik), és az ÁTADÁS:
// a splash cseppjei pixelre ott állnak a végkockán, ahol az alsó sáv cseppjei utána.
import { expect, test, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'

test.beforeEach(async ({ page }) => { await seedKalauzSeen(page) })

const DOMAINS = ['nap', 'train', 'fuel', 'mezo', 'me']

async function dropBoxes(page: Page, scope: string) {
  return page.locator(scope).evaluate((root) => ['nap', 'train', 'fuel', 'mezo', 'me'].map((d) => {
    // `.fo-nav-item[…]`, not a bare `[data-domain]`: the phone screen above carries one too
    const r = root.querySelector(`.fo-nav-item[data-domain="${d}"] .fo-drop`)!.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  }))
}

/** Seek the finite splash animations to `t` ms (the page clock is faked, CSS animations run on real time). */
async function seek(page: Page, t: number) {
  await page.locator('.fo-sp').evaluate((root, ms) => {
    for (const a of root.getAnimations({ subtree: true })) {
      a.pause()
      a.currentTime = Math.min(ms, a.effect!.getComputedTiming().endTime as number)
    }
  }, t)
}

test('a nyitány betölti a telefon-képernyőt: egy edény öt réteggel, öt csepp, majd átadja a Mai-t', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  await page.goto('/')
  const splash = page.getByRole('status', { name: 'Boop betöltése' })
  await expect(splash).toBeVisible()
  await page.waitForLoadState('networkidle')

  await expect(splash.locator('.fo-sp-ves')).toHaveCount(1)
  await expect(splash.locator('.fo-sp-stk > i')).toHaveCount(5)
  await expect(splash.locator('.fo-nav .fo-drop')).toHaveCount(5)
  await expect(splash.locator('canvas')).toHaveCount(0)
  await expect(splash.locator('.fo-sp-wm')).toHaveText('boop')

  expect(await splash.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 })
  await expect(page.locator('.startup-content')).toHaveAttribute('inert', '')

  // A kivezetés a 2,4 s-nál kezdődik és a 3 s-ig tart (a CSS-idővonal a számtáblából jön).
  expect(await splash.evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.animationName, s.animationDelay, s.animationDuration]
  })).toEqual(['fo-sp-out', '2.4s', '0.6s'])

  // A csepp-sor nem kezelhető: se link, se fókuszpont.
  expect(await splash.locator('.fo-nav a, .fo-nav button, .fo-nav [tabindex]').count()).toBe(0)

  await page.clock.fastForward(3000)
  await expect(splash).toHaveCount(0)
  await expect(page).toHaveURL(/\/nap$/)
  await expect(page.locator('.startup-content')).not.toHaveAttribute('inert')
  // Útvonalváltásra nem játszik újra — az intro az app-gyökér élettartamáé.
  await page.getByRole('link', { name: 'Rutin', exact: true }).click()
  await expect(page).toHaveURL(/\/nap\/rutin$/)
  await expect(splash).toHaveCount(0)
})

test('320 px-en semmi nem lóg ki a nyitányból (a leszálló cseppek végkockáján sem)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 320, height: 844 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  await page.goto('/')
  await expect(page.getByRole('status', { name: 'Boop betöltése' })).toBeVisible()
  await seek(page, 2300)
  const boxes = await page.locator('.fo-sp').evaluate((root) =>
    [...root.querySelectorAll('.fo-sp-ves, .fo-sp-wm, .fo-nav, .fo-drop')].map((e) => {
      const r = e.getBoundingClientRect()
      return { cls: e.className.toString(), left: r.left, right: r.right }
    }))
  for (const b of boxes) {
    expect(b.left, b.cls).toBeGreaterThanOrEqual(0)
    expect(b.right, b.cls).toBeLessThanOrEqual(320)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('átadás: a splash cseppjei a végkockán ott állnak, ahol az alsó sáv cseppjei lesznek', async ({ page }) => {
  // Csökkentett mozgás = a végkocka, mozgás nélkül — a pixel-pontos összevetés alapja.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  await page.goto('/')
  const splash = page.getByRole('status', { name: 'Boop betöltése' })
  await expect(splash).toBeVisible()
  expect(await splash.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0)
  const before = await dropBoxes(page, '.fo-sp')
  await page.clock.fastForward(3000)
  await expect(splash).toHaveCount(0)
  const after = await dropBoxes(page, '.fo-nav')
  expect(before).toHaveLength(DOMAINS.length)
  before.forEach((b, i) => {
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(b[k] - after[i][k]), `${DOMAINS[i]}.${k}`).toBeLessThanOrEqual(2)
  })
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
  // Csökkentett mozgás: a végkocka áll, de EGYETLEN animáció sem fut — a kivezetés sem.
  await expect(splash.locator('.fo-sp-ves')).toHaveCount(1)
  expect(await splash.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  await page.clock.fastForward(3000)
  await expect(splash).toHaveCount(0)
  await expect(page).toHaveURL(/\/nap\/rutin$/)
})

// Final review, I2 — the stage is a transparent overlay: its fade must reveal the app that is
// already mounted beneath (the drops over the real bar's drops), never an empty frame.
test('a nyitány az appba olvad át: halványulás közben a valódi alsó sáv látszik alatta, nem üres keret', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install({ time: new Date('2026-09-15T12:00:00+02:00') })
  await page.clock.pauseAt(new Date('2026-09-15T12:00:01+02:00'))
  // Another domain than Nap: the scene's active drop follows the page the app opens on.
  await page.goto('/fuel')
  const splash = page.getByRole('status', { name: 'Boop betöltése' })
  await expect(splash).toBeVisible()
  await page.waitForLoadState('networkidle')
  await seek(page, 2800)

  const opacity = Number(await splash.evaluate((el) => getComputedStyle(el).opacity))
  expect(opacity).toBeGreaterThan(0)
  expect(opacity).toBeLessThan(1)

  // The stage's own frame paints nothing: the fading scene is the only layer over the app.
  const grounds = await page.locator('.startup-stage').evaluate((stage) =>
    ['.app-root', '.phone', '.phone-screen', '.status-bar'].map((sel) => {
      const el = stage.querySelector(sel)
      if (!el) return [sel, 'absent']
      const s = getComputedStyle(el)
      return [sel, s.display === 'none' ? 'hidden' : `${s.backgroundColor} ${s.backgroundImage}`]
    }))
  for (const [sel, ground] of grounds) {
    expect(['absent', 'hidden', 'rgba(0, 0, 0, 0) none'], sel).toContain(ground)
  }
  for (const sel of ['.sky', '.uv-aurora']) {
    expect(await page.locator(`.startup-stage ${sel}`).evaluate((el) => getComputedStyle(el).display), sel).toBe('none')
  }

  // … and beneath it the real bar already stands on screen, its drops under the scene's drops.
  const bar = page.locator('.startup-content nav[aria-label="Területek"]')
  const box = (await bar.boundingBox())!
  expect(box.width).toBeGreaterThan(300)
  expect(box.y).toBeGreaterThan(700)
  expect(box.y + box.height).toBeLessThanOrEqual(844)
  await expect(bar.locator('.fo-nav-item.on')).toHaveAttribute('data-domain', 'fuel')
  const scene = await dropBoxes(page, '.fo-sp')
  const real = await dropBoxes(page, '.startup-content .fo-nav')
  scene.forEach((b, i) => {
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(b[k] - real[i][k]), `${DOMAINS[i]}.${k}`).toBeLessThanOrEqual(2)
  })
  // still inert until the hand-over
  await expect(page.locator('.startup-content')).toHaveAttribute('inert', '')
})
