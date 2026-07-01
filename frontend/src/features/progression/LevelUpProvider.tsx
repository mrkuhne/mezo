import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { LevelUpResult } from '@/lib/trainApi'
import { LevelUpScreen } from '@/features/progression/LevelUpScreen'

type Ctx = { showLevelUp: (result?: LevelUpResult | null) => void }
const LevelUpContext = createContext<Ctx | null>(null)

/**
 * Single host for the post-workout level-up overlay. Any flow (gym/sport/run)
 * calls showLevelUp(r?.levelUp); undefined/null is a no-op (progression switch
 * off). The overlay self-portals over the whole phone screen and clears on its
 * Tovább CTA. Mounted once in AppLayout, so every routed consumer can reach it.
 */
export function LevelUpProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<LevelUpResult | null>(null)
  const showLevelUp = useCallback((result?: LevelUpResult | null) => {
    if (result) setCurrent(result)
  }, [])
  const value = useMemo(() => ({ showLevelUp }), [showLevelUp])
  return (
    <LevelUpContext.Provider value={value}>
      {children}
      {current && <LevelUpScreen result={current} onContinue={() => setCurrent(null)} />}
    </LevelUpContext.Provider>
  )
}

export function useLevelUp(): Ctx {
  const ctx = useContext(LevelUpContext)
  if (!ctx) throw new Error('useLevelUp must be used within a LevelUpProvider')
  return ctx
}
