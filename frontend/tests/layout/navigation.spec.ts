import { test, expect, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

// Folyadék frame (mezo-n4wf5.1, owner-approved 2026-10-09): the bottom bar is the FIVE DOMAINS,
// always; the active domain's four pages are pill tabs at the top; the domain-switcher dialog is
// gone. These specs replace the old „docked menus and panel-free switcher", „short landscape
// switcher" and „menu Boops blink" specs: what they measured (a bar that never moves, items that
// fit and are tappable, a way to every domain at every size, marks that are alive but still under
// reduced motion) is measured here on what took the old chrome's place.

const domains = [
  ['/nap', 'Nap', 'nap'], ['/train/mai', 'Edzés', 'train'], ['/fuel', 'Fuel', 'fuel'],
  ['/mezo', 'Mezo', 'mezo'], ['/me', 'Én', 'me'],
] as const
const NAMES = domains.map(([, name]) => name)

async function seed(page: Page) {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 852 }, { width: 1000, height: 1100 }]) {
  test(`five-drop bottom bar and top tabs, no switcher, at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await seed(page)
    // a stored dark preference must not reach the chrome (light lock)
    await page.addInitScript(() => localStorage.setItem('mezo-theme', 'dark'))
    for (const [route, name] of domains) {
      await page.goto(route)
      const nav = page.getByRole('navigation', { name: 'Területek', exact: true })
      await expect(nav).toBeVisible()
      const phone = (await page.locator('.phone-screen').boundingBox())!
      const before = (await nav.boundingBox())!
      // A floating capsule: inside the phone on every side, near the bottom edge — and fixed,
      // whatever the page scrolls.
      expect(before.x).toBeGreaterThanOrEqual(phone.x + 8)
      expect(before.x + before.width).toBeLessThanOrEqual(phone.x + phone.width - 8)
      expect(before.y + before.height).toBeLessThanOrEqual(phone.y + phone.height - 8)
      expect(before.y + before.height).toBeGreaterThanOrEqual(phone.y + phone.height - 40)
      // the five domains, always, in order — the active one lit
      const links = nav.getByRole('link')
      await expect(links).toHaveCount(5)
      expect(await links.allTextContents()).toEqual(NAMES)
      await expect(nav.locator('[aria-current="true"]')).toHaveText(name)
      const boxes = []
      for (const link of await links.all()) {
        const box = (await link.boundingBox())!
        boxes.push(box)
        expect(box.height).toBeGreaterThanOrEqual(44)
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.x).toBeGreaterThanOrEqual(before.x)
        expect(box.x + box.width).toBeLessThanOrEqual(before.x + before.width)
        expect(await link.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      }
      for (let i = 1; i < boxes.length; i++) expect(overlaps(boxes[i - 1], boxes[i])).toBe(false)
      await page.locator('.screen-content').evaluate(el => { el.scrollTop = el.scrollHeight })
      expect((await nav.boundingBox())!.y).toBeCloseTo(before.y, 0)

      // The top tabs: the domain's four pages, inside the title bar, one lit.
      const tabs = page.getByRole('navigation', { name: `${name} oldalai`, exact: true })
      await expect(tabs.getByRole('link')).toHaveCount(4)
      await expect(tabs.locator('[aria-current="page"]')).toHaveCount(1)
      for (const tab of await tabs.getByRole('link').all()) {
        const box = (await tab.boundingBox())!
        expect(box.height).toBeGreaterThanOrEqual(32)
      }
      // a strip wider than the phone scrolls inside itself — never the page
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

      // No switcher: nothing on the bar opens a dialog, nothing is made inert.
      await expect(nav.locator('[aria-haspopup]')).toHaveCount(0)
      await expect(nav.getByRole('button')).toHaveCount(0)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.locator('.domain-switcher, .domain-switcher-overlay, .tab-bar')).toHaveCount(0)
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')
    }
  })
}

test('every domain is one tap away, and each drop returns to its last-visited tab', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 852 })
  await seed(page)
  await page.goto('/fuel/stack')
  const nav = page.getByRole('navigation', { name: 'Területek', exact: true })
  for (const [route, name] of domains) {
    if (name === 'Fuel') continue
    await nav.getByRole('link', { name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${route}$`))
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(nav.locator('[aria-current="true"]')).toHaveText(name)
  }
  // Fuel remembers Kiegészítők — not its tab 1
  await nav.getByRole('link', { name: 'Fuel', exact: true }).click()
  await expect(page).toHaveURL(/\/fuel\/stack$/)
  await expect(page.getByRole('navigation', { name: 'Fuel oldalai' }).locator('[aria-current="page"]')).toHaveText('Kiegészítők')
})

// Was: „short landscape switcher scrolls to every choice and backdrop dismisses". There is no
// overlay to scroll or dismiss; in a short landscape window the five domains are simply THERE.
test('short landscape: all five domains stay on the bar, in view and tappable', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 320 })
  await seed(page)
  await page.goto('/train/mai')
  const nav = page.getByRole('navigation', { name: 'Területek', exact: true })
  for (const link of await nav.getByRole('link').all()) await expect(link).toBeInViewport()
  await nav.getByRole('link', { name: 'Mezo', exact: true }).click()
  await expect(page).toHaveURL(/\/mezo$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

// Was: „menu Boops blink and look around, with orange Nap and blue Train". The marks are the five
// drops now: each in its own colour, only the active one alive — and still under reduced motion.
test('the drops: five colours, the active one breathes, none moves under reduced motion', async ({ page }, testInfo) => {
  await seed(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/nap')
  const nav = page.getByRole('navigation', { name: 'Területek', exact: true })
  await expect(nav).toBeVisible()
  await expect(nav.locator('svg.boop')).toHaveCount(0)
  const drops = nav.locator('.fo-drop')
  await expect(drops).toHaveCount(5)
  expect(await drops.evaluateAll(els => els.map(el => (el as HTMLElement).style.getPropertyValue('--c'))))
    .toEqual(['#1F6FEB', '#F26A3D', '#1E9E6A', '#6D5BD0', '#0E9AA7'])
  // the liquid really is drawn in that colour
  expect(await drops.evaluateAll(els => els.map(el => getComputedStyle(el.querySelector('.liq')!).fill)))
    .toEqual(['rgb(31, 111, 235)', 'rgb(242, 106, 61)', 'rgb(30, 158, 106)', 'rgb(109, 91, 208)', 'rgb(14, 154, 167)'])
  // only the active drop is alive, and it is the bigger one
  expect(await drops.evaluateAll(els => els.map(el => el.classList.contains('alive')))).toEqual([true, false, false, false, false])
  const sizes = await drops.evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().width)))
  expect(sizes).toEqual([40, 34, 34, 34, 34])
  const moving = () => drops.evaluateAll(els => els.map(el => el.getAnimations({ subtree: true }).length))
  const live = await moving()
  expect(live[0]).toBeGreaterThan(0)
  expect(live.slice(1)).toEqual([0, 0, 0, 0])
  await page.screenshot({ path: testInfo.outputPath('drop-menu.png') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await moving()).toEqual([0, 0, 0, 0, 0])
})

// ── 320px: the chrome's hardest width ───────────────────────────────────────────────────────
for (const route of ['/nap', '/fuel/stack', '/train/mai', '/mezo', '/me']) {
  test(`320px · ${route}: the hub title bar's buttons and title do not overlap, the bar fits, no horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await seed(page)
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    const bar = page.locator('.fo-top')
    await expect(bar).toBeVisible()
    const phone = (await page.locator('.phone-screen').boundingBox())!

    // five round buttons, in the approved order, on their own line ABOVE the context line
    const buttons = bar.locator('.fo-btns > .fo-ib')
    await expect(buttons).toHaveCount(5)
    const labels = await buttons.evaluateAll(els => els.map(el => el.getAttribute('aria-label') ?? ''))
    expect(labels[0]).toBe('Minden oldal')
    expect(labels[1]).toMatch(/^Mezo üzenetei/)
    expect(labels[2]).toMatch(/^Értesítések/)
    expect(labels[3]).toBe('Beállítások')
    expect(labels[4]).toMatch(/^A mai napod/)
    const btnBoxes = []
    for (const b of await buttons.all()) btnBoxes.push((await b.boundingBox())!)
    for (let i = 1; i < btnBoxes.length; i++) expect(overlaps(btnBoxes[i - 1], btnBoxes[i]), `buttons ${i - 1} and ${i} overlap`).toBe(false)
    for (const b of btnBoxes) {
      expect(b.x).toBeGreaterThanOrEqual(phone.x)
      expect(b.x + b.width).toBeLessThanOrEqual(phone.x + phone.width)
      expect(b.width).toBeGreaterThanOrEqual(36)
    }
    const eyebrow = (await bar.locator('.fo-eb').boundingBox())!
    const title = (await bar.locator('.fo-h').boundingBox())!
    const tabs = (await bar.locator('.fo-tabs').boundingBox())!
    const rowBottom = Math.max(...btnBoxes.map(b => b.y + b.height))
    expect(eyebrow.y, 'the context line sits under the button row').toBeGreaterThanOrEqual(rowBottom)
    expect(title.y, 'the title sits under the context line').toBeGreaterThanOrEqual(eyebrow.y + eyebrow.height - 1)
    expect(tabs.y, 'the tabs sit under the title').toBeGreaterThanOrEqual(title.y + title.height - 1)
    for (const b of btnBoxes) {
      expect(overlaps(b, title), 'a button overlaps the title').toBe(false)
      expect(overlaps(b, eyebrow), 'a button overlaps the context line').toBe(false)
    }
    // the title (and the kalauz mark after it) stays inside the phone
    expect(title.x + title.width).toBeLessThanOrEqual(phone.x + phone.width)
    const help = bar.locator('.fo-help')
    if (await help.count()) {
      const h = (await help.boundingBox())!
      expect(h.x + h.width).toBeLessThanOrEqual(phone.x + phone.width)
      for (const b of btnBoxes) expect(overlaps(b, h), 'a button overlaps the kalauz mark').toBe(false)
    }

    // the bottom bar's five items fit
    const nav = page.locator('.fo-nav')
    const navBox = (await nav.boundingBox())!
    expect(navBox.x).toBeGreaterThanOrEqual(phone.x)
    expect(navBox.x + navBox.width).toBeLessThanOrEqual(phone.x + phone.width)
    const items = []
    for (const link of await nav.getByRole('link').all()) {
      const box = (await link.boundingBox())!
      items.push(box)
      expect(box.x).toBeGreaterThanOrEqual(navBox.x)
      expect(box.x + box.width).toBeLessThanOrEqual(navBox.x + navBox.width)
      expect(await link.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'a label is clipped').toBe(true)
    }
    expect(items).toHaveLength(5)
    for (let i = 1; i < items.length; i++) expect(overlaps(items[i - 1], items[i])).toBe(false)

    // no horizontal scroll — of the document or of the app's scroller
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.locator('.screen-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  })
}

test('320px · a sub-page: back, title and bell share one row without overlapping', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await seed(page)
  await page.goto('/fuel/recipes')
  await page.waitForLoadState('networkidle')
  const bar = page.locator('.fo-top.sub')
  await expect(bar).toBeVisible()
  const back = (await bar.getByRole('button', { name: 'Vissza' }).boundingBox())!
  const bell = (await bar.getByRole('button', { name: /^Értesítések/ }).boundingBox())!
  const title = (await bar.locator('.fo-title').boundingBox())!
  expect(overlaps(back, title)).toBe(false)
  expect(overlaps(bell, title)).toBe(false)
  expect(back.x + back.width).toBeLessThanOrEqual(title.x)
  expect(title.x + title.width).toBeLessThanOrEqual(bell.x)
  await expect(bar.locator('.fo-tabs')).toHaveCount(0)
  await expect(page.locator('.fo-top .fo-title small')).toHaveText('Fuel · Konyha')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  // ONE back control on the page: the title bar's
  await expect(page.getByRole('button', { name: /^Vissza/ })).toHaveCount(1)
})

test('the notification panel opens under the button row, inside the phone, at 320 and 390', async ({ page }) => {
  await seed(page)
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 760 })
    await page.goto('/nap')
    await page.getByRole('button', { name: /^Értesítések/ }).click()
    const panel = page.getByRole('dialog', { name: 'Értesítések' })
    await expect(panel).toBeVisible()
    const phone = (await page.locator('.phone-screen').boundingBox())!
    const box = (await panel.boundingBox())!
    const bell = (await page.getByRole('button', { name: /^Értesítések/ }).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(phone.x)
    expect(box.x + box.width).toBeLessThanOrEqual(phone.x + phone.width)
    expect(box.y).toBeGreaterThanOrEqual(bell.y + bell.height)
    expect(box.y + box.height).toBeLessThanOrEqual(phone.y + phone.height)
    // a white card with readable ink
    expect(await panel.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
    // the bell stays clickable above the scrim: a second tap closes the panel
    await page.getByRole('button', { name: /^Értesítések/ }).click()
    await expect(panel).toHaveCount(0)
  }
})
