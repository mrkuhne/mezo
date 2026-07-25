import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  applyTheme, DEFAULT_MODE, readStoredMode, writeStoredMode, type Theme, type ThemeMode,
} from '@/shared/lib/theme'

interface ThemeContextValue {
  theme: Theme
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  /** Fed by CircadianTheme while mode === 'auto'; ignored otherwise. */
  setAutoTheme: (t: Theme) => void
  /**
   * Transient theme override that wins over `mode`/`autoTheme` WITHOUT touching the persisted
   * preference. Used by the Napzárás ritual (`RitualPage`, mezo-tr5v) to force `dark` for the
   * duration of its dark-takeover flow — so the sheets and XP-award overlays it portals render
   * dark too — then clear it (`null`) on exit to revert to the user's real theme.
   */
  setForceTheme: (t: Theme | null) => void
}
const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode() ?? DEFAULT_MODE)
  // Light until the circadian resolver reports in — matches the CSS base theme (no attribute).
  const [autoTheme, setAutoTheme] = useState<Theme>('light')
  const [forceTheme, setForceThemeState] = useState<Theme | null>(null)
  const resolved: Theme = mode === 'auto' ? autoTheme : mode
  // The override wins when set; otherwise the normal mode/circadian resolution applies.
  const theme: Theme = forceTheme ?? resolved

  // Persist only the real preference — the transient override must never be written to storage.
  useEffect(() => { writeStoredMode(mode) }, [mode])
  useEffect(() => { applyTheme(theme) }, [theme])

  const setMode = useCallback((m: ThemeMode) => setModeState(m), [])
  const setAuto = useCallback((t: Theme) => setAutoTheme(t), [])
  const setForceTheme = useCallback((t: Theme | null) => setForceThemeState(t), [])

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, setAutoTheme: setAuto, setForceTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
