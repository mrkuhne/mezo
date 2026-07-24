import { useCallback, useEffect, useState } from 'react'

/** In-page rest countdown (CTA-morph redesign, mezo-xt65 — replaces the shell
    rest Live-Activity). Self-ticks off endsAt while running (500ms, same cadence
    the island used); pause freezes a whole-second remaining, resume re-anchors
    endsAt from it. State is page-local: it dies with the session screen. */
type RestState =
  | { status: 'idle' }
  | { status: 'running'; endsAt: number; total: number }
  | { status: 'paused'; pausedRemaining: number; total: number }

export type RestTimer = {
  status: RestState['status']
  /** Whole seconds left (0 when idle). */
  remaining: number
  /** Full duration of the current rest in seconds (0 when idle). */
  total: number
  start: (seconds: number) => void
  pause: () => void
  resume: () => void
  skip: () => void
}

export function useRestTimer(): RestTimer {
  const [state, setState] = useState<RestState>({ status: 'idle' })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (state.status !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [state])
  const remaining =
    state.status === 'running'
      ? Math.max(0, Math.ceil((state.endsAt - now) / 1000))
      : state.status === 'paused'
        ? state.pausedRemaining
        : 0
  // Natural expiry: the tick drives remaining to 0 -> revert to the idle CTA.
  useEffect(() => {
    if (state.status === 'running' && remaining === 0) setState({ status: 'idle' })
  }, [state, remaining])
  const start = useCallback((seconds: number) => {
    const t = Date.now() // single capture: a second Date.now() would round remaining up
    setNow(t)
    setState({ status: 'running', endsAt: t + seconds * 1000, total: seconds })
  }, [])
  const pause = useCallback(() => {
    setState((s) => {
      if (s.status !== 'running') return s
      const left = Math.ceil((s.endsAt - Date.now()) / 1000)
      // Pausing a rest the clock already finished just ends it (never a frozen 0:00).
      return left > 0 ? { status: 'paused', pausedRemaining: left, total: s.total } : { status: 'idle' }
    })
  }, [])
  const resume = useCallback(() => {
    const t = Date.now()
    setNow(t)
    setState((s) =>
      s.status === 'paused' ? { status: 'running', endsAt: t + s.pausedRemaining * 1000, total: s.total } : s,
    )
  }, [])
  const skip = useCallback(() => setState({ status: 'idle' }), [])
  return {
    status: state.status,
    remaining,
    total: state.status === 'idle' ? 0 : state.total,
    start,
    pause,
    resume,
    skip,
  }
}
