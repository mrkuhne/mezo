import {
  createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode,
} from 'react'
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
   * Register (or update) a transient theme claim. Claims win over `mode`/`autoTheme` WITHOUT
   * touching the persisted preference; the MOST RECENTLY registered live claim wins.
   * Prefer the `useForceTheme` hook — it owns the id and the release for you.
   */
  pushForceTheme: (id: string, t: Theme) => void
  /** Drop one claim by id. Other owners' claims are untouched. */
  releaseForceTheme: (id: string) => void
}

interface ForceClaim { id: string, theme: Theme }
const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode() ?? DEFAULT_MODE)
  // Light until the circadian resolver reports in — matches the CSS base theme (no attribute).
  const [autoTheme, setAutoTheme] = useState<Theme>('light')
  // mezo-mhum fix-wave: the override used to be ONE global slot, so two owners could hold it at
  // the same time and the loser silently clobbered the winner. Concretely: on /nap → /ritual the
  // effects flush children-first — RitualPage claims 'dark', then AppLayout's own effect re-runs
  // (titanDark true→false) and cleared the slot LAST, so the ritual's dark-designed layout
  // rendered with LIGHT tokens for a light-preference user. Claims are now a stack: each owner
  // holds its own id, releases only its own entry, and the topmost live claim wins.
  const [claims, setClaims] = useState<ForceClaim[]>([])
  const resolved: Theme = mode === 'auto' ? autoTheme : mode
  // The topmost claim wins when any is held; otherwise the normal mode/circadian resolution.
  const theme: Theme = claims.length > 0 ? claims[claims.length - 1].theme : resolved

  // Persist only the real preference — the transient override must never be written to storage.
  useEffect(() => { writeStoredMode(mode) }, [mode])
  useEffect(() => { applyTheme(theme) }, [theme])

  const setMode = useCallback((m: ThemeMode) => setModeState(m), [])
  const setAuto = useCallback((t: Theme) => setAutoTheme(t), [])
  const pushForceTheme = useCallback((id: string, t: Theme) => {
    setClaims((prev) => {
      const at = prev.findIndex((c) => c.id === id)
      // Re-claiming with the same theme is a no-op — keep the array identity so a re-render
      // storm can't loop. A changed theme updates the entry IN PLACE (stack order preserved).
      if (at >= 0) {
        if (prev[at].theme === t) return prev
        const next = prev.slice()
        next[at] = { id, theme: t }
        return next
      }
      return [...prev, { id, theme: t }]
    })
  }, [])
  const releaseForceTheme = useCallback((id: string) => {
    setClaims((prev) => (prev.some((c) => c.id === id) ? prev.filter((c) => c.id !== id) : prev))
  }, [])

  return (
    <ThemeContext.Provider
      value={{ theme, mode, setMode, setAutoTheme: setAuto, pushForceTheme, releaseForceTheme }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Hold a transient theme override for as long as this component wants it (`null` = not now).
 * Each caller gets its own claim id, so overlapping owners (the Titán Nap shell and the
 * Napzárás ritual) stack instead of clobbering each other — see the claims comment above.
 */
export function useForceTheme(theme: Theme | null) {
  const { pushForceTheme, releaseForceTheme } = useTheme()
  const id = useId()
  useEffect(() => {
    if (theme === null) {
      releaseForceTheme(id)
      return
    }
    pushForceTheme(id, theme)
    return () => releaseForceTheme(id)
  }, [theme, id, pushForceTheme, releaseForceTheme])
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
