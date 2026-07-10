export type Theme = 'dark' | 'light'
export const THEME_KEY = 'mezo-theme'
export const DEFAULT_THEME: Theme = 'light'

/** Browser/PWA chrome color per theme — keep in sync with --canvas in prototype.css
    and with the static meta in index.html / manifest in vite.config.ts. */
const THEME_COLOR: Record<Theme, string> = { light: '#F4F6F8', dark: '#0A0F14' }

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
/** Dark is the CSS base => no attribute; light => data-theme="light". */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'light') root.setAttribute('data-theme', 'light')
  else root.removeAttribute('data-theme')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}
