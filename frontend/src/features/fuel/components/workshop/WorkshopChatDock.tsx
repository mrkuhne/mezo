// ============================================================
// Mezo · WorkshopChatDock (Receptműhely — dokkolt chat, mezo-92pb)
// The prototype's `.dock`: cél-preset chipek, az utolsó válasz előnézete (koppintásra
// a teljes beszélgetés sheetben nyílik), és a composer a 🏺 kamra-gombbal.
//
// The canvas is the page; the chat is a strip under it — so the thread itself lives in a
// Sheet, opened from the last-reply preview, rather than eating the surface.
// The error path is the F7.5 retry-bubble idiom VERBATIM (`.mzc-bub-err` + `.mzc-ebtn`,
// ChatPage): amber, never red — a hiccup, not a scolding (ADR 0010) — with `Újra`
// re-sending the SAME failed message and `Szerkesztés` handing the text back to the field.
// ============================================================
import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { Sheet } from '@/shared/ui/Sheet'
import { ClayIcon } from '@/shared/ui/clay'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import type { WorkshopGoal } from '@/data/types'

export interface WorkshopChatMessage { role: 'user' | 'assistant'; text: string }

export interface WorkshopChatDockProps {
  goal: WorkshopGoal | null
  /** a preset tap — the page decides whether that also fires a turn */
  onGoal: (g: WorkshopGoal) => void
  text: string
  onText: (t: string) => void
  busy: boolean
  history: WorkshopChatMessage[]
  error: { message: string; retryText: string } | null
  onSend: () => void
  onRetry: () => void
  /** hand the failed message back into the composer */
  onEditFailed: () => void
  onOpenPantry: () => void
  /** kamra items marked for the next turn */
  contextNames: string[]
  onDropContext: (name: string) => void
}

const PRESETS: { id: WorkshopGoal; label: string }[] = [
  { id: 'high_protein', label: 'High protein' },
  { id: 'pre_workout', label: 'Pre-workout' },
  { id: 'post_workout', label: 'Post-workout' },
  { id: 'before_bed', label: 'Lefekvés előtt' },
  { id: 'breakfast', label: 'Reggeli' },
]

export function WorkshopChatDock({
  goal, onGoal, text, onText, busy, history, error,
  onSend, onRetry, onEditFailed, onOpenPantry, contextNames, onDropContext,
}: WorkshopChatDockProps) {
  const [threadOpen, setThreadOpen] = useState(false)
  const lastReply = [...history].reverse().find(m => m.role === 'assistant')?.text ?? null

  return (
    <div className="wsh-dock">
      <div className="wsh-presets" role="group" aria-label="Cél-presetek">
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            className={'wsh-pchip' + (goal === p.id ? ' on' : '')}
            aria-pressed={goal === p.id}
            disabled={busy}
            onClick={() => onGoal(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {contextNames.length > 0 && (
        <div className="row gap-xs flex-wrap" style={{ padding: '0 2px' }}>
          {contextNames.map(n => (
            <button
              key={n}
              type="button"
              className="chip"
              onClick={() => onDropContext(n)}
              aria-label={`${n} elvétele a következő körből`}
              style={{ fontSize: 9, padding: '4px 9px' }}
            >
              {n} <Icon name="x" size={9} />
            </button>
          ))}
        </div>
      )}

      {busy && (
        <p className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '0 4px' }}>
          A Műhely dolgozik…
        </p>
      )}

      {error && (
        <div className="mzc-bub-err">
          <p style={{ fontSize: 12, lineHeight: 1.5 }}><b>{error.message}</b></p>
          <div className="row gap-sm" style={{ marginTop: 8 }}>
            <button type="button" className="mzc-ebtn go" onClick={onRetry} disabled={busy}>Újra</button>
            <button type="button" className="mzc-ebtn ghost" onClick={onEditFailed}>Szerkesztés</button>
          </div>
        </div>
      )}

      {lastReply && !error && (
        <button type="button" className="wsh-last" onClick={() => setThreadOpen(true)}>
          <ClayIcon name="i-muhely" size={18} />
          <span className="tx">{lastReply}</span>
          <span aria-hidden="true" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>▲</span>
        </button>
      )}

      <div className="row gap-sm" style={{ alignItems: 'center', paddingBottom: 4 }}>
        <button type="button" className="wsh-cbtn" aria-label="Kamra" onClick={onOpenPantry}>
          <ClayIcon name="i-polc" size={17} />
        </button>
        <div className="wsh-cfield">
          <input
            value={text}
            onChange={e => onText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSend() } }}
            placeholder="Mit főzzünk? Mondd el szabadon…"
            aria-label="Üzenet a Műhelynek"
          />
        </div>
        <button
          type="button"
          className="wsh-cbtn send"
          aria-label="Küldés"
          disabled={busy || text.trim().length === 0}
          onClick={onSend}
        >
          <Icon name="send" size={14} />
        </button>
      </div>

      {threadOpen && (
        <Sheet onClose={() => setThreadOpen(false)} labelledBy="workshop-thread-title">
          {close => (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="col">
                  <Eyebrow brand>Műhely · beszélgetés</Eyebrow>
                  <div id="workshop-thread-title" style={{ marginTop: 4 }}>
                    <Display size="md">Amiről eddig beszéltünk</Display>
                  </div>
                </div>
                <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
                  <Icon name="x" size={12} />
                </button>
              </div>
              <div className="col gap-sm" style={{ maxHeight: 420, overflowY: 'auto' }}>
                {history.map((m, i) => (
                  <div
                    key={i}
                    className="mz-qcard"
                    style={{
                      marginBottom: 0, padding: '9px 11px', maxWidth: '92%',
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      background: m.role === 'user' ? 'var(--mz-tone-coral)' : 'var(--surface-card)',
                    }}
                  >
                    <span className="label-mono" style={{ fontSize: 7.5, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}>
                      {m.role === 'user' ? 'TE' : 'MŰHELY'}
                    </span>
                    <p style={{ fontSize: 12, lineHeight: 1.5, marginTop: 3, color: 'var(--text-primary)' }}>{m.text}</p>
                  </div>
                ))}
              </div>
              <div style={{ height: 24 }} />
            </>
          )}
        </Sheet>
      )}
    </div>
  )
}
