import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import { useInRouterContext, useLocation } from 'react-router-dom'
import type { LevelUpResult } from '@/data/train/trainApi'
import { LevelUpScreen } from '@/features/progression/LevelUpScreen'

type Ctx = { showLevelUp: (result?: LevelUpResult | null) => void }
const LevelUpContext = createContext<Ctx | null>(null)

/**
 * Route-scope guard for the overlay (mezo-e1ii9, Train parity P1 Task 2). The overlay is a
 * full-frame (416×932, z-index 250) portal whose ONLY dismissal was its own Tovább CTA — so a
 * user who navigated away instead of tapping it kept it painted over every following screen
 * until a hard reload (measured live over /train/mesocycles/new and /train/gym). It is a reward
 * for the moment it was raised in, so it must not outlive that moment's route.
 *
 * Mounted only while an overlay is up, so the first pathname it sees IS the raising route; any
 * change from there dismisses. A separate child because hooks cannot be conditional and the
 * provider must also work OUTSIDE a router (several test harnesses mount it that way).
 */
function DismissOnRouteChange({ onLeave }: { onLeave: () => void }) {
  const { pathname } = useLocation()
  const raisedAt = useRef(pathname)
  const onLeaveRef = useRef(onLeave)
  onLeaveRef.current = onLeave
  useEffect(() => {
    if (pathname !== raisedAt.current) onLeaveRef.current()
  }, [pathname])
  return null
}

/**
 * Single host for the level-up overlay. Sport and run logging (SportPage, SportLogPage,
 * RunningPage, QuickLogSurface, TrainTodayPage) call showLevelUp(r?.levelUp); undefined/null is
 * a no-op (progression switch off). The gym workout close does NOT — since mezo-e1ii9 its
 * Titanium closing ceremony is the only layer on screen and carries the `+N szerzett XP` itself.
 * The overlay self-portals over the whole phone screen and clears on its Tovább CTA OR on a
 * route change. Mounted once in AppLayout, so every routed consumer can reach it.
 */
export function LevelUpProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<LevelUpResult | null>(null)
  const inRouter = useInRouterContext()
  const showLevelUp = useCallback((result?: LevelUpResult | null) => {
    if (result) setCurrent(result)
  }, [])
  const dismiss = useCallback(() => setCurrent(null), [])
  const value = useMemo(() => ({ showLevelUp }), [showLevelUp])
  return (
    <LevelUpContext.Provider value={value}>
      {children}
      {current && inRouter && <DismissOnRouteChange onLeave={dismiss} />}
      {current && <LevelUpScreen result={current} onContinue={dismiss} />}
    </LevelUpContext.Provider>
  )
}

export function useLevelUp(): Ctx {
  const ctx = useContext(LevelUpContext)
  if (!ctx) throw new Error('useLevelUp must be used within a LevelUpProvider')
  return ctx
}
