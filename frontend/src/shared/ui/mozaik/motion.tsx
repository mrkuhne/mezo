// ============================================================
// Mezo · Mozaik 2.0 motion kit (mezo-d20.1.4)
// One-shot entrance choreography, then calm (handoff §10): tiles
// carry .rise + a --d stagger delay; an EntranceGroup arms .mz-play
// once per mount so the CSS animation plays exactly once. Replays
// only on an explicit replayKey change (e.g. daypart switch).
// Reduced motion: the CSS guard settles .rise instantly; useCountUp
// checks the media query itself and jumps to the target.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Wraps a panel whose .rise children should stagger in once on mount.
 *  A changed replayKey remounts the wrapper, re-arming the choreography. */
export function EntranceGroup({ children, replayKey, className }: {
  children: ReactNode
  replayKey?: string | number
  className?: string
}) {
  return (
    <div key={replayKey} className={cn('mz-play', className)}>
      {children}
    </div>
  )
}

/** Animated number for hero count-ups (kcal, XP). ~30 fps stepping with
 *  ease-out; instant under prefers-reduced-motion. */
export function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))
  const startRef = useRef(target)

  useEffect(() => {
    if (prefersReducedMotion()) { setValue(target); return }
    const from = startRef.current === target ? 0 : startRef.current
    startRef.current = target
    const stepMs = 33
    const steps = Math.max(1, Math.round(durationMs / stepMs))
    let i = 0
    setValue(from)
    const id = setInterval(() => {
      i += 1
      const t = i / steps
      const eased = 1 - (1 - t) * (1 - t) // ease-out quad
      if (i >= steps) {
        setValue(target)
        clearInterval(id)
      } else {
        setValue(Math.round(from + (target - from) * eased))
      }
    }, stepMs)
    return () => clearInterval(id)
  }, [target, durationMs])

  return value
}

function isJsdom(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string' && navigator.userAgent.includes('jsdom')
}

/** Count-up that CONTINUES from the last displayed value when `target` changes (the KeretHero
 *  recipe, mezo-rmi0.1): a chip tap / saved activity bumps the Growth hero's XP from where it
 *  sits, never restarting at 0. Instant under prefers-reduced-motion and jsdom. */
export function useContinuingCountUp(target: number, durationMs = 900): number {
  const skip = prefersReducedMotion() || isJsdom()
  const [val, setVal] = useState(skip ? target : 0)
  const shownRef = useRef(skip ? target : 0)
  useEffect(() => {
    if (skip) { setVal(target); shownRef.current = target; return }
    const from = shownRef.current
    let raf = 0
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = Math.round(from + (target - from) * eased)
      setVal(next)
      shownRef.current = next
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, skip])
  return val
}
