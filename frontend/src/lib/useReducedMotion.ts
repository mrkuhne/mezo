import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Shared reduced-motion gate. Drives the LevelUpScreen's count-up / ring / bar
 * animations and the stagger; reused by the P6 radar. Returns false when
 * matchMedia is unavailable (jsdom without a stub / SSR).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof matchMedia === 'function' ? matchMedia(QUERY).matches : false,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mql = matchMedia(QUERY)
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return reduced
}
