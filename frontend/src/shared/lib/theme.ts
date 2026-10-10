export type Theme = 'dark' | 'light'
export const THEME_KEY = 'mezo-theme'
export const DEFAULT_THEME: Theme = 'light'

/** Folyadék light lock (Folyadék bible §1.1, mezo-n4wf5.1, owner 2026-10-08): the app resolves
 *  to this theme regardless of the stored preference or circadian `auto`. A force claim
 *  (`useForceTheme`) still outranks the lock — the one dark pocket left is the night sleep page
 *  (until F6; the Napzárás ritual went light in F2, mezo-n4wf5.2). The mode/claim machinery and the dark CSS stay;
 *  setting this to `null` brings the stored/circadian choice back. index.html's `theme-color` and
 *  the manifest in vite.config.ts carry the same light canvas (`#EEF5F9`). */
export const THEME_LOCK: Theme | null = 'light'

/** Browser/PWA chrome color per theme — keep in sync with --fo-page in folyadek.css
    and with the static meta in index.html / manifest in vite.config.ts. */
const THEME_COLOR: Record<Theme, string> = { light: '#EEF5F9', dark: '#141210' }

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
