import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/** In-shell rest Live-Activity state (spec §4.5) — the island self-ticks off endsAt;
    pages only start/clear. Real Live Activities are a PWA no-go; this drives the
    PhoneFrame's fake dynamic island instead. */
export type RestActivity = { endsAt: number; total: number; next: string | null }

type LiveActivityValue = {
  rest: RestActivity | null
  startRest: (a: { seconds: number; next: string | null }) => void
  clearRest: () => void
}

const Ctx = createContext<LiveActivityValue | null>(null)

export function LiveActivityProvider({ children }: { children: ReactNode }) {
  const [rest, setRest] = useState<RestActivity | null>(null)
  const startRest = useCallback(({ seconds, next }: { seconds: number; next: string | null }) => {
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds, next })
  }, [])
  const clearRest = useCallback(() => setRest(null), [])
  const value = useMemo(() => ({ rest, startRest, clearRest }), [rest, startRest, clearRest])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLiveActivityOptional(): LiveActivityValue | null {
  return useContext(Ctx)
}

export function useLiveActivity(): LiveActivityValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLiveActivity must be used within LiveActivityProvider')
  return ctx
}
