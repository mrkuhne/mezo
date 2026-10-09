import { useId } from 'react'

export const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a))

/** A per-instance id that is safe inside `url(#…)` (React ids contain colons / guillemets). Bible trap 2. */
export function useSvgId(prefix = 'fo'): string {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '')
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
