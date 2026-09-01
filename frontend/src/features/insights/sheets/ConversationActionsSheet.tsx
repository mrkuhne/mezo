// ============================================================
// F7.5 (mezo-d20.8.5): the conversation actions sheet — Átnevezés + Törlés.
// Source of truth: docs/design_2.0/prototypes/mezo-chat.html (sh-act).
// ChatGPT pattern minus swipe: the header ⋯ disc AND the picker rows' kebab
// both open THIS sheet. Rename is inline and unconfirmed (reversible);
// delete is a two-step warm confirm (ADR 0010 — a decision, not a mistake).
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useConversationActions } from '@/data/hooks'
import type { ConversationResponse } from '@/data/insights/chatApi'

const TITLE_ID = 'conversation-actions-title'

const ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '12px 12px', borderRadius: 'var(--r-lg)', textAlign: 'left',
  background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
}

export function ConversationActionsSheet({
  conversation, onClose, onRenamed, onDeleted,
}: {
  conversation: ConversationResponse
  onClose: () => void
  onRenamed?: () => void
  onDeleted?: () => void
}) {
  const { rename, remove } = useConversationActions()
  const [phase, setPhase] = useState<'menu' | 'rename' | 'confirm'>('menu')
  const [title, setTitle] = useState(conversation.title ?? '')
  const [busy, setBusy] = useState(false)

  return (
    <Sheet onClose={onClose} labelledBy={TITLE_ID}>
      {(close) => (
        <div className="col gap-md" style={{ padding: '4px 20px 24px' }}>
          <div className="col">
            <span id={TITLE_ID} className="eyebrow" style={{ color: 'var(--lav-deep)' }}>
              Beszélgetés
            </span>
            <span
              style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {conversation.title ?? 'Névtelen beszélgetés'}
            </span>
          </div>

          {phase === 'menu' && (
            <div className="col gap-sm">
              <button type="button" style={ROW} onClick={() => setPhase('rename')}>
                <Icon name="pencil" size={14} />
                <span className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Átnevezés</span>
                  <span className="text-tertiary" style={{ fontSize: 10 }}>
                    a lista címkéje változik — bármikor átírhatod újra
                  </span>
                </span>
              </button>
              <button type="button" style={ROW} onClick={() => setPhase('confirm')}>
                <Icon name="trash" size={14} />
                <span className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--coral-deep)' }}>Törlés</span>
                  <span className="text-tertiary" style={{ fontSize: 10 }}>
                    a beszélgetés lekerül a listáról
                  </span>
                </span>
              </button>
            </div>
          )}

          {phase === 'rename' && (
            <div className="col gap-sm">
              <input
                type="text"
                aria-label="A beszélgetés címe"
                value={title}
                maxLength={120}
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  void (async () => {
                    if (!title.trim() || busy) return
                    setBusy(true)
                    await rename(conversation.id, title.trim())
                    onRenamed?.()
                    close()
                  })()
                }}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 12,
                  border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
                  color: 'var(--text-primary)',
                }}
              />
              <div className="row gap-sm">
                <button type="button" className="cta-ghost flex-1" onClick={() => setPhase('menu')}>
                  Mégse
                </button>
                <button
                  type="button"
                  className="cta-primary flex-1"
                  disabled={!title.trim() || busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      await rename(conversation.id, title.trim())
                      onRenamed?.()
                      close()
                    })()
                  }}
                >
                  Mentés
                </button>
              </div>
            </div>
          )}

          {phase === 'confirm' && (
            <div
              style={{
                border: '1px dashed var(--border-strong)', borderRadius: 13,
                padding: '10px 12px', fontSize: 12, color: 'var(--mz-ink-soft)', lineHeight: 1.5,
              }}
            >
              Biztosan törlöd? A beszélgetés és az üzenetei lekerülnek a listáról — a belőlük
              tanult emlékeket ez nem érinti.
              <div className="row gap-sm" style={{ marginTop: 10 }}>
                <button type="button" className="cta-ghost flex-1" onClick={() => setPhase('menu')}>
                  Mégse
                </button>
                <button
                  type="button"
                  className="cta-primary flex-1"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      await remove(conversation.id)
                      onDeleted?.()
                      close()
                    })()
                  }}
                >
                  Törlöm
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
