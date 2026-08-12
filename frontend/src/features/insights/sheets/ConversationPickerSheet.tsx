import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import type { ConversationResponse } from '@/data/insights/chatApi'

const TITLE_ID = 'conversation-picker-title'

const ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '11px 12px', borderRadius: 'var(--r-lg)', textAlign: 'left',
  background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
}

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
  conversations, activeId, onSelect, onNew, onClose,
}: {
  conversations: ConversationResponse[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} labelledBy={TITLE_ID}>
      <div className="col gap-md" style={{ padding: '4px 20px 24px' }}>
        <div className="col">
          <span id={TITLE_ID} className="eyebrow" style={{ color: 'var(--lav-deep)' }}>
            Beszélgetések
          </span>
          <span className="text-tertiary" style={{ fontSize: 11 }}>
            {conversations.length} korábbi beszélgetés
          </span>
        </div>

        <button type="button" style={{ ...ROW, borderStyle: 'dashed' }} onClick={onNew}>
          <Icon name="plus" size={14} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Új beszélgetés
          </span>
        </button>

        <div className="col gap-sm" style={{ maxHeight: 320, overflowY: 'auto' }}>
          {conversations.map((c) => {
            const active = c.id === activeId
            return (
              <button
                key={c.id}
                type="button"
                aria-current={active || undefined}
                style={{
                  ...ROW,
                  ...(active
                    ? { borderColor: 'var(--lav-deep)', background: 'var(--wash-lav)' }
                    : null),
                }}
                onClick={() => onSelect(c.id)}
              >
                <div className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {c.title ?? 'Névtelen beszélgetés'}
                  </span>
                  <span className="text-tertiary" style={{ fontSize: 10 }}>
                    {whenLabel(c.lastMessageAt ?? c.startedAt)}
                  </span>
                </div>
                {active && <Icon name="check" size={14} />}
              </button>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}
