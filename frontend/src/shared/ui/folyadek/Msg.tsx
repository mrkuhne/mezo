import type { ReactNode } from 'react'
import { Badge, type Member } from './Badge'

/** The team by field (bible §6): the name shown, and the quiet default meta beside it. */
export const MEMBER_LABEL: Record<Member, string> = { szunya: 'Alvás', mocor: 'Mozgás', falat: 'Étkezés', deru: 'Közérzet', mezo: 'Mezo', szk: 'Szkeptikus' }
const MEMBER_META: Record<Member, string> = { szunya: 'pihenés', mocor: 'terhelés', falat: 'étrend', deru: 'hangulat', mezo: 'összkép', szk: '' }
const REPEATS = ['étel', 'kedv', 'táplálkozás']

/** A team message: the field's badge, its name, a meta line, the text. A meta part that only repeats the field is dropped. */
export function Msg(p: { member: Member; meta?: string; size?: number; children: ReactNode }) {
  const name = MEMBER_LABEL[p.member]
  const parts = (p.meta ?? '').split(' · ').filter((x) => x.trim() && (p.member === 'mezo' || ![name.toLowerCase(), ...REPEATS].includes(x.trim().toLowerCase())))
  const meta = parts.join(' · ') || MEMBER_META[p.member]
  return (
    <div className="fo-msg">
      <span className="who"><Badge member={p.member} size={p.size ?? 36} /></span>
      <div className="b">
        <span className="nm">{name}{meta && <small>{meta}</small>}</span>
        <div className="fo-txt">{p.children}</div>
      </div>
    </div>
  )
}
