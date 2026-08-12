// ============================================================
// Mezo · MezoChip — a companion hangja a Mai lapon, EGYETLEN 44px-es sorban
// (mezo-e26w), a full-bleed `MezoMessage` sáv utódja. A sáv azért ment nyugdíjba,
// mert mind a három napszakon ugyanaz a REGGELI briefing állt benne, ~600px-en.
// A chip csak az utolsó üzenet első mondatát mutatja; minden más a sheetben van.
// Honest absence: üzenet nélkül a chip EGYÁLTALÁN nem renderel — nincs üres
// állapot, nincs placeholder (mock módban ma csak a briefing van, tehát „1").
// Prezentációs: az olvasatlan-állapotot a hívó adja (`shared/lib/seenMessages`).
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'

export function MezoChip({ messages, unread, onOpen }: {
  messages: MezoMessageItem[]
  unread: boolean
  onOpen: () => void
}) {
  if (messages.length === 0) return null
  const latest = messages[messages.length - 1]
  const preview = latest.paragraphs[0] ?? ''
  const label = `Mezo üzenetei, ${messages.length} üzenet${unread ? ', olvasatlan' : ''}`

  return (
    <button
      type="button"
      className="td-chip np-press"
      aria-haspopup="dialog"
      aria-label={label}
      onClick={onOpen}
    >
      <span className={cn('td-av', unread && 'is-unread')} aria-hidden="true">✦</span>
      <span className="td-chip-t">
        <b>Mezo</b>
        <i>{preview}</i>
      </span>
      <span className="td-chip-n" aria-hidden="true">{messages.length}</span>
      <span className="td-chev" aria-hidden="true">›</span>
    </button>
  )
}
