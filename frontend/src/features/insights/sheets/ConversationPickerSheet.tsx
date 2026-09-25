import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D } from '@/shared/ui/clay'
import type { ConversationResponse } from '@/data/insights/chatApi'

const TITLE_ID = 'conversation-picker-title'

/** "ma 07:12" / "tegnap 21:40" / "júl 3." — enough to tell two threads apart at a glance. */
function whenLabel(iso: string | null | undefined): string {
  if (!iso) return 'üres'
  const d = new Date(iso)
  const time = d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
  const days = Math.round(
    (new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000,
  )
  if (days === 0) return `ma ${time}`
  if (days === 1) return `tegnap ${time}`
  return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
}

/**
 * Conversation picker (mezo-at8x.3) — the companion's chat is no longer one endless thread:
 * this lists the persisted conversations (newest first, auto-titled from their first user
 * message server-side) and starts a new one. Purely presentational; ChatPage owns the
 * selection (the `?c=` URL param) and the data.
 */
export function ConversationPickerSheet({
  conversations, activeId, onSelect, onNew, onClose, onActions,
}: {
  conversations: ConversationResponse[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onClose: () => void
  /** F7.5 (mezo-d20.8.5): the row kebab — opens the actions sheet for that conversation. */
  onActions?: (conversation: ConversationResponse) => void
}) {
  return (
    // Üveg (mezo-me75u.8, bible U2 rule 15): ONE floating lavender glass sheet; the rows are flat
    // cells, the active one lit, the "new" row dashed (free space).
    <Sheet onClose={onClose} labelledBy={TITLE_ID} className="glass mzc-sheet">
      <div className="mzc-shbody col gap-md">
        <div className="mzc-shh">
          <Icon3D name="t-chat" size={44} />
          <div className="col" style={{ minWidth: 0 }}>
            <span id={TITLE_ID} className="mzc-sheb">
              Beszélgetések
            </span>
            <span className="mzc-shtitle">
              {conversations.length} korábbi beszélgetés
            </span>
          </div>
        </div>

        <button type="button" className="mzc-shrow is-new" onClick={onNew}>
          <Icon3D name="t-chat" size={26} />
          <span className="mzc-shnm">
            Új beszélgetés
          </span>
        </button>

        <div className="mzc-shlist col gap-sm">
          {conversations.map((c) => {
            const active = c.id === activeId
            return (
              <button
                key={c.id}
                type="button"
                aria-current={active || undefined}
                className={active ? 'mzc-shrow is-on' : 'mzc-shrow'}
                onClick={() => onSelect(c.id)}
              >
                <div className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span className="mzc-shnm">
                    {c.title ?? 'Névtelen beszélgetés'}
                  </span>
                  <span className="mzc-shsub">
                    {whenLabel(c.lastMessageAt ?? c.startedAt)}
                  </span>
                </div>
                {active && <><Icon3D name="t-tick" size={20} /><span className="sr-only">megnyitva</span></>}
                {onActions && (
                  // F7.5: a span with button semantics — a real <button> may not nest in the row button.
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Műveletek: ${c.title ?? 'Névtelen beszélgetés'}`}
                    onClick={(e) => { e.stopPropagation(); onActions(c) }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      e.stopPropagation()
                      onActions(c)
                    }}
                    className="mzc-shmore"
                  >
                    ⋯
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}
