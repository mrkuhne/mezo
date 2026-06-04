import { test } from '@playwright/test'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import type { AddressInfo } from 'node:net'

const PROTOTYPE_DIR =
  '/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype'
const PROTOTYPE_ENTRY = 'Mezo Prototype.html'
const TABS = ['today', 'train', 'fuel', 'insights', 'me'] as const

for (const tab of TABS) {
  test(`our app — ${tab}`, async ({ page }) => {
    await page.goto(`http://localhost:4317/${tab}`)
    await page.waitForTimeout(400) // fonts/transition settle
    await page.screenshot({ path: `tests/parity/__shots__/app-${tab}.png` })
  })
}

// The prototype is a file:// React 18 + @babel/standalone page that fetches
// ~25 external `type="text/babel"` JSX files at runtime. Browsers block those
// XHRs over file:// (CORS: "Cross origin requests are only supported for
// protocol schemes ... http, https"), so #root never populates and the shot is
// blank. Serving the prototype dir over a throwaway localhost HTTP server lets
// Babel fetch + transpile the JSX, and the home screen renders normally.
test('prototype — default (Today)', async ({ page }) => {
  const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.jsx': 'text/babel; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  }
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(
      new URL(req.url ?? '/', 'http://localhost').pathname,
    )
    const filePath = path.join(PROTOTYPE_DIR, urlPath)
    // Stay inside the prototype dir (defence-in-depth against path traversal).
    if (!filePath.startsWith(PROTOTYPE_DIR)) {
      res.writeHead(403).end('forbidden')
      return
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found')
        return
      }
      res.writeHead(200, {
        'Content-Type':
          MIME[path.extname(filePath).toLowerCase()] ??
          'application/octet-stream',
      })
      res.end(data)
    })
  })

  try {
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    )
    const { port } = server.address() as AddressInfo
    const url = `http://127.0.0.1:${port}/${encodeURIComponent(PROTOTYPE_ENTRY)}`

    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForSelector('#root > *', { timeout: 20_000 })
    await page.waitForTimeout(800) // let fonts + first paint settle
    await page.screenshot({
      path: 'tests/parity/__shots__/prototype-today.png',
    })
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

const TODAY_VARIANTS: Array<[string, string]> = [
  ['today-default', '/today'],
  ['today-good', '/today?day=good'],
  ['today-rough-anchor', '/today?day=rough'],
  ['today-niggle-off', '/today?niggle=off'],
  ['today-vulnerable', '/today?vulnerable=on'],
]
for (const [name, path] of TODAY_VARIANTS) {
  test(`our app — ${name}`, async ({ page }) => {
    await page.goto(`http://localhost:4317${path}`)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `tests/parity/__shots__/app-${name}.png` })
  })
}

test('our app — checkin sheet', async ({ page }) => {
  await page.goto('http://localhost:4317/today')
  await page.waitForTimeout(400)
  // the "now" check-in slot shows "tap"
  await page.getByText('tap', { exact: true }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'tests/parity/__shots__/app-checkin-sheet.png' })
})

test('our app — quickinput sheet', async ({ page }) => {
  await page.goto('http://localhost:4317/today')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Gyors rögzítés' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({
    path: 'tests/parity/__shots__/app-quickinput-sheet.png',
  })
})

const ME_VIEWS: Array<[string, string]> = [
  ['me-profile', '/me'],
  ['me-goals', '/me/goals'],
  ['me-sleep', '/me/sleep'],
  ['me-people', '/me/people'],
  ['me-knowledge', '/me/knowledge'],
]
for (const [name, path] of ME_VIEWS) {
  test(`our app — ${name}`, async ({ page }) => {
    await page.goto(`http://localhost:4317${path}`)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `tests/parity/__shots__/app-${name}.png` })
  })
}

test('our app — settings sheet', async ({ page }) => {
  await page.goto('http://localhost:4317/me')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Beállítások' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'tests/parity/__shots__/app-me-settings.png' })
})
