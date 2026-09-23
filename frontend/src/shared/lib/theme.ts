export type Theme = 'dark' | 'light'
export const THEME_KEY = 'mezo-theme'
export const DEFAULT_THEME: Theme = 'light'

/** Üvegesítés dark-only lock (üveg style bible §8, mezo-me75u.1, owner 2026-09-23): the app
 *  resolves to this theme regardless of the stored preference, circadian `auto` or a force
 *  claim. Light mode is PARKED, not deleted — the mode/claim machinery and the light CSS stay,
 *  and setting this to `null` brings them back. index.html's boot script and the manifest in
 *  vite.config.ts carry the same lock (the dark canvas `#191614`). */
export const THEME_LOCK: Theme | null = 'dark'

/** Browser/PWA chrome color per theme — keep in sync with --canvas in prototype.css
    and with the static meta in index.html / manifest in vite.config.ts. */
const THEME_COLOR: Record<Theme, string> = { light: '#FBF6EF', dark: '#191614' }

export function readStoredTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : null
  } catch {
    return null
  }
}
export function writeStoredTheme(theme: Theme): void {
  try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
}
/** Napív inversion (spec §6 R2): light is the CSS base => no attribute; dark => data-theme="dark". */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

/** Circadian mode (spec D9): 'auto' resolves dark inside [bed-90, wake-30) — the same
 *  windows the WindDownBanner uses (features/today/logic/windDown.ts). Default: auto. */
export type ThemeMode = Theme | 'auto'
export const DEFAULT_MODE: ThemeMode = 'auto'

export function readStoredMode(): ThemeMode | null {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' || t === 'auto' ? t : null
  } catch {
    return null
  }
}
export function writeStoredMode(mode: ThemeMode): void {
  try { localStorage.setItem(THEME_KEY, mode) } catch { /* ignore */ }
}
