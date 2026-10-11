import type { CSSProperties } from 'react'
import { clamp } from './util'

/** A horizontal vessel: a bar that is a liquid. The `label` on its left reads at every level: ink on the empty part, white on the liquid. */
export function Level(p: { pct: number; color?: string; height?: number; value?: string; label?: string }) {
  return (
    <div className="fo-level" style={{ '--c': p.color ?? 'var(--dom)', '--h': `${p.height ?? 18}px` } as CSSProperties}>
      {p.label && <span>{p.label}</span>}
      <i style={{ width: `${clamp(p.pct)}%` }} data-l={p.label || undefined} />
      {p.value && <b>{p.value}</b>}
    </div>
  )
}
