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
}
const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode() ?? DEFAULT_MODE)
  // Light until the circadian resolver reports in — matches the CSS base theme (no attribute).
  const [autoTheme, setAutoTheme] = useState<Theme>('light')
  const theme: Theme = mode === 'auto' ? autoTheme : mode

  useEffect(() => { writeStoredMode(mode) }, [mode])
  useEffect(() => { applyTheme(theme) }, [theme])

  const setMode = useCallback((m: ThemeMode) => setModeState(m), [])
  const setAuto = useCallback((t: Theme) => setAutoTheme(t), [])

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, setAutoTheme: setAuto }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
