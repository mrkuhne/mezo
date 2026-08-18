// ============================================================
// Mezo · useMinuteTick — a `Date` that re-renders its subscriber once a minute (mezo-dhzk).
// Mirrors the `useWindDownPhase` ticking idiom (useWindDownPhase.ts:20-29): `useState(() =>
// new Date())` seeds synchronously so the first render already has a real `now`, and a single
// `setInterval` (empty deps — one timer for the component's lifetime) advances it. The needs
// rings decay continuously, so a 60s cadence keeps the displayed pct visibly live without
// re-rendering on every tick of a faster clock.
// ============================================================
import { useEffect, useState } from 'react'

const TICK_MS = 60_000

export function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  return now
}
