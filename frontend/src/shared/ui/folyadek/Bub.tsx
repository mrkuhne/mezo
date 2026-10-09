import type { CSSProperties } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

/** An icon inside a glass bubble: the way icons live on white. */
export function Bub(p: { icon: Icon3DName; size?: number; color?: string }) {
  const s = p.size ?? 44
  return (
    <span className="fo-bub" style={{ '--s': `${s}px`, '--c': p.color ?? 'var(--dom)' } as CSSProperties}>
      <Icon3D name={p.icon} size={Math.round(s * 0.62)} />
    </span>
  )
}
