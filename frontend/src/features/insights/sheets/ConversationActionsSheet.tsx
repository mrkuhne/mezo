// ============================================================
// F7.5 (mezo-d20.8.5): the conversation actions sheet — Átnevezés + Törlés.
// Source of truth: docs/design_2.0/prototypes/mezo-chat.html (sh-act).
// ChatGPT pattern minus swipe: the header ⋯ disc AND the picker rows' kebab
// both open THIS sheet. Rename is inline and unconfirmed (reversible);
// delete is a two-step warm confirm (ADR 0010 — a decision, not a mistake).
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D } from '@/shared/ui/clay'
import { useConversationActions } from '@/data/hooks'
import type { ConversationResponse } from '@/data/insights/chatApi'

const TITLE_ID = 'conversation-actions-title'

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
    // Üveg (mezo-me75u.8, bible U2 rule 15): ONE floating lavender glass sheet, flat action rows,
    // lit flat pills for the answers (never glass in glass); the delete confirm stays coral.
    <Sheet onClose={onClose} labelledBy={TITLE_ID} className="glass mzc-sheet">
      {(close) => (
        <div className="mzc-shbody col gap-md">
          <div className="mzc-shh">
            <Icon3D name="t-chat" size={44} />
            <div className="col" style={{ minWidth: 0 }}>
              <span id={TITLE_ID} className="mzc-sheb">
                Beszélgetés
              </span>
              <span className="mzc-shtitle">
                {conversation.title ?? 'Névtelen beszélgetés'}
              </span>
            </div>
          </div>

          {phase === 'menu' && (
            <div className="col gap-sm">
              <button type="button" className="mzc-shrow" onClick={() => setPhase('rename')}>
                <Icon3D name="t-pencil" size={30} />
                <span className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span className="mzc-shnm">Átnevezés</span>
                  <span className="mzc-shsub">
                    a lista címkéje változik — bármikor átírhatod újra
                  </span>
                </span>
              </button>
              <button type="button" className="mzc-shrow is-warn" onClick={() => setPhase('confirm')}>
                <Icon3D name="t-trash" size={30} />
                <span className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span className="mzc-shnm">Törlés</span>
                  <span className="mzc-shsub">
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
                className="mzc-shinput"
              />
              <div className="mzc-shpair">
                <button type="button" className="mzc-shbtn is-ghost" onClick={() => setPhase('menu')}>
                  Mégse
                </button>
                <button
                  type="button"
                  className="mzc-shbtn is-go"
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
                  <Icon3D name="t-tick" size={20} />
                  Mentés
                </button>
              </div>
            </div>
          )}

          {phase === 'confirm' && (
            <div className="mzc-shconfirm">
              Biztosan törlöd? A beszélgetés és az üzenetei lekerülnek a listáról — a belőlük
              tanult emlékeket ez nem érinti.
              <div className="mzc-shpair">
                <button type="button" className="mzc-shbtn is-ghost" onClick={() => setPhase('menu')}>
                  Mégse
                </button>
                <button
                  type="button"
                  className="mzc-shbtn is-warn"
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
                  <Icon3D name="t-trash" size={20} />
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
