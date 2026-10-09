import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * Guard: the installed-PWA status-bar chrome metas stay in index.html.
 *
 * On an iOS home-screen PWA the OS status bar ignores the dynamic `theme-color` meta, so
 * with the Folyadék light lock (mezo-n4wf5.1) the bar style is `default` (dark text over the light page);
 * the capable metas stay (mezo-cp8w).
 * These are static <head> metas iOS reads at install time, so a runtime test cannot exercise
 * them; this file just pins their presence so a future index.html edit can't silently drop them.
 */
const HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8')

describe('installed-PWA status-bar chrome', () => {
  test('iOS status bar style is default (dark text on the light Folyadék page)', () => {
    expect(HTML).toMatch(
      /<meta\s+name="apple-mobile-web-app-status-bar-style"\s+content="default"\s*\/?>/,
    )
  })

  test('the light-lock canvas colour is #EEF5F9 in the meta and the manifest', () => {
    expect(HTML).toMatch(/<meta\s+name="theme-color"\s+content="#EEF5F9"\s*\/?>/)
    const VITE = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8')
    expect(VITE).toMatch(/theme_color:\s*'#EEF5F9'/)
    expect(VITE).toMatch(/background_color:\s*'#EEF5F9'/)
  })

  test('the boot script does not lock the document dark', () => {
    expect(HTML).not.toMatch(/setAttribute\('data-theme'/)
  })

  test('the app declares itself web-app-capable (required for the status-bar style to apply)', () => {
    expect(HTML).toMatch(/<meta\s+name="apple-mobile-web-app-capable"\s+content="yes"\s*\/?>/)
    expect(HTML).toMatch(/<meta\s+name="mobile-web-app-capable"\s+content="yes"\s*\/?>/)
  })

  test('the dynamic theme-color meta is still present (Android + Safari-browser tinting)', () => {
    expect(HTML).toMatch(/<meta\s+name="theme-color"\s+content="[^"]+"\s*\/?>/)
  })
})
