import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * Guard: the installed-PWA status-bar chrome metas stay in index.html.
 *
 * On an iOS home-screen PWA the OS status bar ignores the dynamic `theme-color` meta, so
 * without `apple-mobile-web-app-status-bar-style: black-translucent` (+ the capable metas)
 * the system bar renders opaque white over the dark Nap shell — the exact mismatch the owner
 * reported (mezo-cp8w). `black-translucent` lets the app's own background paint the bar.
 * These are static <head> metas iOS reads at install time, so a runtime test cannot exercise
 * them; this file just pins their presence so a future index.html edit can't silently drop them.
 */
const HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8')

describe('installed-PWA status-bar chrome', () => {
  test('iOS status bar is black-translucent so the app paints it', () => {
    expect(HTML).toMatch(
      /<meta\s+name="apple-mobile-web-app-status-bar-style"\s+content="black-translucent"\s*\/?>/,
    )
  })

  test('the app declares itself web-app-capable (required for the status-bar style to apply)', () => {
    expect(HTML).toMatch(/<meta\s+name="apple-mobile-web-app-capable"\s+content="yes"\s*\/?>/)
    expect(HTML).toMatch(/<meta\s+name="mobile-web-app-capable"\s+content="yes"\s*\/?>/)
  })

  test('the dynamic theme-color meta is still present (Android + Safari-browser tinting)', () => {
    expect(HTML).toMatch(/<meta\s+name="theme-color"\s+content="[^"]+"\s*\/?>/)
  })
})
