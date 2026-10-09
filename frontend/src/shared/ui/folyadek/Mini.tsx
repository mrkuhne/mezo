import type { CSSProperties, ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { clamp } from './util'

/** A small capsule level: icon on top, value below. */
export function Mini(p: { pct: number; color?: string; icon?: Icon3DName; value?: ReactNode; label?: string }) {
  return (
    <span className="fo-mini" style={{ '--c': p.color ?? 'var(--dom)' } as CSSProperties}>
      {p.icon && <Icon3D name={p.icon} size={18} />}
      <span className="t"><i style={{ height: `${clamp(p.pct)}%` }} /></span>
      {p.value != null && <b>{p.value}</b>}
      {p.label && <small>{p.label}</small>}
    </span>
  )
}
