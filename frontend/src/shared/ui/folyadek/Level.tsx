import type { CSSProperties } from 'react'
import { clamp } from './util'

/** A horizontal vessel: a bar that is a liquid. */
export function Level(p: { pct: number; color?: string; height?: number; value?: string; label?: string }) {
  return (
    <div className="fo-level" style={{ '--c': p.color ?? 'var(--dom)', '--h': `${p.height ?? 18}px` } as CSSProperties}>
      <i style={{ width: `${clamp(p.pct)}%` }} />
      {p.label && <span>{p.label}</span>}
      {p.value && <b>{p.value}</b>}
    </div>
  )
}
