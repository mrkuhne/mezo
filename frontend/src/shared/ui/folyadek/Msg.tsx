import type { ReactNode } from 'react'
import { m } from '@/shared/i18n'
import { catalogs } from '@/shared/i18n/messages'
import { Badge, type Member } from './Badge'

/** The team by field (bible §6): the name shown, read at call time in the current language. */
export const memberLabel = (key: Member): string => m().kit.members[key]
/** The quiet default meta beside the name, in the current language. */
export const memberMeta = (key: Member): string => (m().kit.memberMeta as Partial<Record<Member, string>>)[key] ?? ''

/** Dedupe logic, not display: meta words that only repeat a field (Hungarian stays, English added). */
const REPEATS = ['étel', 'kedv', 'táplálkozás', 'food', 'meal', 'mood', 'nutrition']

/** A team message: the field's badge, its name, a meta line, the text. A meta part that only repeats the field is dropped. */
export function Msg(p: { member: Member; meta?: string; size?: number; children: ReactNode }) {
  const name = memberLabel(p.member)
  // the field's name in either language also counts as a repeat (stored or hand-written meta may be in the other one)
  const names = [catalogs.hu.kit.members[p.member], catalogs.en.kit.members[p.member], name].map((x) => x.toLowerCase())
  const parts = (p.meta ?? '').split(' · ').filter((x) => x.trim() && (p.member === 'mezo' || ![...names, ...REPEATS].includes(x.trim().toLowerCase())))
  const meta = parts.join(' · ') || memberMeta(p.member)
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
