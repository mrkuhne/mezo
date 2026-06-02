import { test } from '@playwright/test'
import { pathToFileURL } from 'node:url'

const PROTOTYPE = pathToFileURL(
  '/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/Mezo Prototype.html',
).href
const TABS = ['today', 'train', 'fuel', 'insights', 'me'] as const

for (const tab of TABS) {
  test(`our app — ${tab}`, async ({ page }) => {
    await page.goto(`http://localhost:4317/${tab}`)
    await page.waitForTimeout(400) // fonts/transition settle
    await page.screenshot({ path: `tests/parity/__shots__/app-${tab}.png` })
  })
}

test('prototype — default (Today)', async ({ page }) => {
  await page.goto(PROTOTYPE)
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'tests/parity/__shots__/prototype-today.png' })
})
