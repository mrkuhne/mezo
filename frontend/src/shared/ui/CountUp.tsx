import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'

// jsdom implements a real requestAnimationFrame (so the LevelUpScreen precedent's
// `typeof requestAnimationFrame !== 'function'` guard does NOT catch it) — a dangling
// rAF tick surviving test teardown is the same "window is not defined" flake class the
// Sheet.tsx exit-timer comment documents. Sniffed inline (not hoisted) so tests can
// override navigator.userAgent to exercise the real animate path (vi.spyOn getter).
function isJsdomEnv(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
    && navigator.userAgent.includes('jsdom')
}

/**
 * Shared rAF ease-out count-up primitive (extracted from LevelUpScreen's inline
 * `useCountUp`, generalised for the Harvest act's XP total, mezo-ilsj Task 6). Renders
 * `to` immediately under reduced motion OR jsdom; otherwise eases 0→`to` over
 * `durationMs` (cubic ease-out, `Math.round`ed), tabular-nums so digits don't jitter width.
 */
export function CountUp({ to, durationMs = 1800, className }: {
  to: number
  durationMs?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  const skip = reduced || isJsdomEnv()
  const [val, setVal] = useState(skip ? to : 0)

  useEffect(() => {
    if (skip) {
      setVal(to)
      return
    }
    let raf = 0
    // `start` is captured from the FIRST rAF timestamp, not `performance.now()` — jsdom's
    // rAF clock runs on a different basis than Node's `performance.now()` (observed: a
    // multi-second offset), so mixing the two blows up `(now - start)` into nonsense.
    // Deriving both ends from the same rAF clock is correct in every environment.
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(to * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, durationMs, skip])

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {val}
    </span>
  )
}
