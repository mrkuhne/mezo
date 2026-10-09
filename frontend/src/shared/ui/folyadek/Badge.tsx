import type { CSSProperties, ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { clamp } from './util'

export type Member = 'szunya' | 'mocor' | 'falat' | 'deru' | 'mezo' | 'szk'

const GLYPH: Record<Member, Icon3DName> = { szunya: 't-sleep', mocor: 't-dumbbell', falat: 't-bowl', deru: 't-heart', mezo: 't-orb', szk: 't-lens' }
const COLOR: Record<Member, string> = { szunya: '#AB9FD2', mocor: '#5B9BD5', falat: '#6FB08A', deru: '#D9A94E', mezo: '#8C97A8', szk: '#8494A6' }

/** A team member's face: the field's own glyph in the field's colour. pct = level behind the glyph, value = number chip
 *  (or, at size >= 88, number + label inside the badge). */
export function Badge(p: { member: Member; size?: number; pct?: number; value?: ReactNode; label?: string }) {
  const s = p.size ?? 36
  const big = s >= 88
  const cls = ['fo-badge', big && 'big', p.pct != null && 'lv'].filter(Boolean).join(' ')
  const style = { '--s': `${s}px`, '--c': COLOR[p.member], ...(p.pct != null ? { '--p': `${clamp(p.pct)}%` } : {}) } as CSSProperties
  return (
    <span className={cls} style={style}>
      <Icon3D name={GLYPH[p.member]} size={Math.round(s * 0.58)} />
      {big && p.value != null ? <><strong>{p.value}</strong>{p.label && <small>{p.label}</small>}</> : p.value != null ? <b>{p.value}</b> : null}
    </span>
  )
}
