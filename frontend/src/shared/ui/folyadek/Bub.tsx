import type { CSSProperties } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

/** An icon in its flat tinted chip: the way icons live on white (bible §5). */
export function Bub(p: { icon: Icon3DName; size?: number; color?: string }) {
  const s = p.size ?? 44
  return (
    <span className="fo-bub" style={{ '--s': `${s}px`, '--c': p.color ?? 'var(--dom)' } as CSSProperties}>
      <Icon3D name={p.icon} size={Math.round(s * 0.62)} />
    </span>
  )
}
