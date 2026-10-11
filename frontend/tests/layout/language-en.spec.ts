import { test, expect, type Locator, type Page } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/**
 * The app in English (mezo-n4wf5.11): the frame and the Settings pages laid out in English at 390 and
 * 320 px. English words are longer than the Hungarian ones the frame was drawn for, so what is checked
 * is containment: no sideways page scroll, one-line bottom-bar labels, whole top-tab words (the row
 * scrolls inside itself when it does not fit), no wrapped button, slack on the language buttons.
 * Mock mode: the mock account's language starts from the device cache (`mezo-lang`), so seeding that
 * key loads any route in English. One case presses the switch in Settings instead.
 */
const HUBS = [
  { route: '/nap', domain: 'Today', tabs: ['Now', 'My day', 'Chat', 'Routine'] },
  { route: '/train/mai', domain: 'Training', tabs: ['Today', 'Plan', 'Load', 'Exercises'] },
  { route: '/fuel', domain: 'Fuel', tabs: ['Today', 'Supplements', 'Trends', 'Kitchen'] },
  { route: '/mezo', domain: 'Mezo', tabs: ['Wall', 'The team', 'About you', 'Memories'] },
  { route: '/me', domain: 'Me', tabs: ['Overview', 'Body', 'Goals', 'Journal'] },
] as const
const SETTINGS = ['/settings', '/settings/general', '/settings/notifications', '/settings/account'] as const
/**
 * What each Settings route must give the checks to measure, so a renamed class cannot turn them vacuous.
 * `buttons` = the BTN set (wrap check); `controls` = every button and link in the content (containment
 * check); `anchor` = the page's own root, asserted visible. Real counts on 2026-10-11 in mock mode:
 * /settings is a hub of links (no buttons), /settings/notifications shows only its iOS note (no
 * controls) -- both zero on purpose, with the anchor standing in.
 */
const EXPECT: Record<(typeof SETTINGS)[number], { buttons: number; controls: number; anchor: string }> = {
  '/settings': { buttons: 0, controls: 4, anchor: '.screen-content' },
  '/settings/general': { buttons: 2, controls: 4, anchor: '.settings-lang-choice' },
  '/settings/notifications': { buttons: 0, controls: 0, anchor: '.ntf-page' },
  '/settings/account': { buttons: 1, controls: 1, anchor: '.settings-account-wash, .cta-primary' },
}
const BOTTOM_BAR = ['Today', 'Training', 'Fuel', 'Mezo', 'Me']
/** The buttons the Settings pages dress as primary / ghost / open-editor buttons. */
const BTN = 'button.cta-primary, button.cta-ghost, button.settings-open-button, button.settings-lang-choice'

async function seed(page: Page, lang: 'en' | null) {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
  if (lang) await page.addInitScript((l) => localStorage.setItem('mezo-lang', l), lang)
}

/** True when any word of the element's text sits on a different line than another (a wrapped label). */
const wraps = (loc: Locator) => loc.evaluateAll((els) => els.filter((el) => {
  const tops = new Set<number>()
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement?.closest('[aria-hidden="true"]')) continue // a count badge / dot is not the label
    const r = document.createRange()
    r.selectNodeContents(n)
    for (const rect of Array.from(r.getClientRects())) if (rect.width > 0) tops.add(Math.round(rect.top))
  }
  return tops.size > 1
}).map((el) => el.textContent?.trim() ?? ''))

const noSidewaysScroll = (page: Page) => page.evaluate(() => {
  const sc = document.querySelector('.screen-content')
  return document.documentElement.scrollWidth <= innerWidth && (!sc || sc.scrollWidth <= sc.clientWidth + 1)
})

for (const width of [390, 320]) {
  test.describe(`English @ ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 820 })
      await seed(page, 'en')
    })

    for (const hub of HUBS) {
      test(`hub ${hub.route}: bottom bar, top tabs, no overflow`, async ({ page }) => {
        await page.goto(hub.route)
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        const nav = page.getByRole('navigation', { name: 'Areas', exact: true })
        await expect(nav).toBeVisible()
        const links = nav.getByRole('link')
        expect(await links.allTextContents()).toEqual(BOTTOM_BAR)
        await expect(nav.locator('[aria-current="true"]')).toHaveText(hub.domain)
        expect(await wraps(links)).toEqual([])
        for (const link of await links.all()) {
          expect(await link.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
        }

        const tabs = page.getByRole('navigation', { name: `${hub.domain} pages`, exact: true })
        const tabLinks = tabs.getByRole('link')
        await expect(tabLinks).toHaveCount(4)
        // the label only: the unread count / morning dot sit in their own elements
        expect(await tabLinks.evaluateAll((els) => els.map((el) => Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim()))).toEqual([...hub.tabs])
        // whole words: no label wraps or is cut inside its own pill; a row wider than the phone scrolls inside itself
        expect(await wraps(tabLinks)).toEqual([])
        for (const link of await tabLinks.all()) {
          expect(await link.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
        }
        const row = await tabs.evaluate((el) => ({ scrolls: el.scrollWidth > el.clientWidth, overflowX: getComputedStyle(el).overflowX }))
        if (row.scrolls) expect(['auto', 'scroll']).toContain(row.overflowX)

        expect(await noSidewaysScroll(page)).toBe(true)
      })
    }

    for (const route of SETTINGS) {
      test(`${route}: no overflow, no wrapped button`, async ({ page }) => {
        await page.goto(route)
        await page.waitForLoadState('networkidle')
        // Settings is outside the five domains: no bottom bar there (AppLayout `inSettings`)
        await expect(page.getByRole('navigation', { name: 'Areas', exact: true })).toHaveCount(0)
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        expect(await noSidewaysScroll(page)).toBe(true)
        const buttons = page.locator(BTN)
        const want = EXPECT[route]
        await expect(page.locator(want.anchor).first()).toBeVisible()
        expect(await buttons.count()).toBeGreaterThanOrEqual(want.buttons)
        if (width === 390) expect(await wraps(buttons)).toEqual([])
        // (the title bar's round icon buttons are the frame's, and their unread badge overhangs on purpose)
        // at 320 a two-line label is the known narrow-phone behaviour (bible trap 5) — it must still be contained
        let measured = 0
        for (const button of await page.locator('.screen-content button:not(.fo-ib), .screen-content a').all()) {
          if (!(await button.isVisible())) continue
          measured++
          expect(await button.evaluate((el) => el.getBoundingClientRect().right <= innerWidth + 0.5 && el.scrollWidth <= el.clientWidth + 1)).toBe(true)
        }
        expect(measured).toBeGreaterThanOrEqual(want.controls)
      })
    }

    test('/settings/general: the language buttons are tappable, on one row, with room to spare', async ({ page }) => {
      await page.goto('/settings/general')
      await page.waitForLoadState('networkidle')
      const group = page.getByRole('group', { name: 'App language' })
      await expect(group).toBeVisible()
      const buttons = group.getByRole('button')
      await expect(buttons).toHaveCount(2)
      expect(await buttons.allTextContents()).toEqual(['Magyar', 'English'])
      const boxes = await buttons.evaluateAll((els) => els.map((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        const range = document.createRange()
        range.selectNodeContents(el)
        const inner = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth)
        return { top: r.top, height: r.height, width: r.width, text: range.getBoundingClientRect().width, inner }
      }))
      for (const b of boxes) {
        expect(b.height).toBeGreaterThanOrEqual(44)
        // a Linux runner sets text wider than macOS: the label plus 20 px must still fit the button's inner width
        expect(b.text + 20).toBeLessThanOrEqual(b.inner)
      }
      expect(Math.abs(boxes[0].top - boxes[1].top)).toBeLessThan(1)
      expect(await wraps(buttons)).toEqual([])
    })
  })
}

test('pressing English / Magyar in Settings switches the words in place, no navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 })
  await seed(page, null) // a fresh mock session: Hungarian
  // enter Settings from a hub through the app (no reload), so the switch is the only thing that changes
  await page.goto('/me')
  await page.evaluate(() => { (window as unknown as { __kept?: boolean }).__kept = true })
  const bar = (name: string) => page.getByRole('navigation', { name, exact: true }).getByRole('link')
  expect(await bar('Területek').allTextContents()).toEqual(['Nap', 'Edzés', 'Fuel', 'Mezo', 'Én'])
  await page.getByRole('button', { name: 'Beállítások', exact: true }).click()
  await page.getByRole('link', { name: /Megjelenés és alkalmazás/ }).click()
  await expect(page).toHaveURL(/\/settings\/general$/)
  const url = page.url()

  await page.getByRole('group', { name: 'Az app nyelve' }).getByRole('button', { name: 'English' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('group', { name: 'App language' })).toBeVisible()
  expect(page.url()).toBe(url)
  expect(await page.evaluate(() => localStorage.getItem('mezo-lang'))).toBe('en')
  // Settings carries no bottom bar: leave it through the app and read the bar in English, still on one page load
  await page.getByRole('button', { name: 'Back', exact: true }).first().click()
  await expect(page).toHaveURL(/\/settings$/)
  await page.getByRole('button', { name: 'Back', exact: true }).first().click()
  await expect(page).toHaveURL(/\/me$/)
  await expect(bar('Areas')).toHaveText(BOTTOM_BAR)
  expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true) // never reloaded

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('link', { name: /Appearance and app/ }).click()
  await page.getByRole('group', { name: 'App language' }).getByRole('button', { name: 'Magyar' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu')
  await expect(page.getByRole('group', { name: 'Az app nyelve' })).toBeVisible()
  expect(page.url()).toBe(url)
  await page.getByRole('button', { name: 'Vissza', exact: true }).first().click()
  await expect(page).toHaveURL(/\/settings$/)
  await page.getByRole('button', { name: 'Vissza', exact: true }).first().click()
  await expect(page).toHaveURL(/\/me$/)
  await expect(bar('Területek')).toHaveText(['Nap', 'Edzés', 'Fuel', 'Mezo', 'Én'])
})

test('after the switch the Fuel settings page still carries its save bar (portal target survives the remount)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 })
  await seed(page, null)
  await page.goto('/me')
  await page.getByRole('button', { name: 'Beállítások', exact: true }).click()
  await page.getByRole('link', { name: /Megjelenés és alkalmazás/ }).click()
  await page.getByRole('group', { name: 'Az app nyelve' }).getByRole('button', { name: 'English' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('button', { name: 'Back', exact: true }).first().click()
  await expect(page).toHaveURL(/\/settings$/)
  await page.getByRole('link', { name: /^Fuel/ }).first().click()
  await expect(page).toHaveURL(/\/settings\/fuel$/)
  const save = page.locator('.fset-savebar button')
  await expect(save).toBeVisible()
  expect(await save.evaluate((el) => document.body.contains(el))).toBe(true)
})

test('loaded directly in English, the Fuel settings page carries its save bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 })
  await seed(page, 'en')
  await page.goto('/fuel/settings')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  const save = page.locator('.fset-savebar button')
  await expect(save).toBeVisible()
  expect(await save.evaluate((el) => document.body.contains(el))).toBe(true)
})
