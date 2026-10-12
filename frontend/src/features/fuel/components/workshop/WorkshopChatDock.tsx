// ============================================================
// Mezo · WorkshopChatDock (Receptműhely — the request dock, mezo-92pb)
// Goal buttons (a tap is a request), the pantry items marked for the next round, the busy line,
// the error with its two exits, the last reply (a tap opens the whole conversation in a sheet),
// and the message field with the pantry button, the mic and send.
//
// The canvas is the page; the chat is one card of it — so the thread itself lives in a Sheet,
// opened from the last-reply preview, rather than eating the surface.
// The error is amber, never red — a hiccup, not a scolding (ADR 0010) — with `Újra` re-sending
// the SAME failed message and `Szerkesztés` handing the text back to the field.
// Folyadék (mezo-n4wf5.5, fuel.js `dock` + `SH.thread`): kit pills with the goal glyphs, the
// composer as one page-grey field; the thread sheet is the light sheet with plain bubbles.
// Words in `fuelRecept.workshop`; what Mezo answered is stored text and prints as written.
// ============================================================
import { useCallback, useRef, useState } from 'react'
import { useM } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Acts, Btn, Bub, Chev, FoSheetHead, Lk, Pill, Pills, RemoveChips } from '@/shared/ui/folyadek'
import type { WorkshopGoal } from '@/data/types'
import { appendDictation, useVoiceInput } from '@/shared/lib/voice/useVoiceInput'
import { MicTile } from '@/shared/ui/voice/VoiceField'
import { VoiceBubble } from '@/shared/ui/voice/VoiceBubble'

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

const PRESETS: { id: WorkshopGoal; icon: Icon3DName }[] = [
  { id: 'high_protein', icon: 't-meat' },
  { id: 'pre_workout', icon: 't-bolt' },
  { id: 'post_workout', icon: 't-dumbbell' },
  { id: 'before_bed', icon: 't-moon' },
  { id: 'breakfast', icon: 't-sun' },
]

export function WorkshopChatDock({
  goal, onGoal, text, onText, busy, history, error,
  onSend, onRetry, onEditFailed, onOpenPantry, contextNames, onDropContext,
}: WorkshopChatDockProps) {
  const M = useM()
  const W = M.fuelRecept.workshop
  // Hang mindenhol (mezo-xojq8): the composer keeps its layout; the mic tile sits before
  // send and appends to what's typed. Refs: the recorder keeps the callback from record-start.
  const textRef = useRef(text)
  textRef.current = text
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const voice = useVoiceInput(useCallback((t: string) => onTextRef.current(appendDictation(textRef.current, t)), []))
  const [threadOpen, setThreadOpen] = useState(false)
  const lastReply = [...history].reverse().find(m => m.role === 'assistant')?.text ?? null

  return (
    <div className="fc-dock">
      <Pills className="fc-goals" role="group" aria-label={W.goalsAria}>
        {PRESETS.map(p => (
          <Pill key={p.id} icon={p.icon} on={goal === p.id} disabled={busy} onClick={() => onGoal(p.id)}>
            {W.goal[p.id]}
          </Pill>
        ))}
      </Pills>

      {contextNames.length > 0 && (
        <RemoveChips items={contextNames.map(n => ({ key: n, label: n, ariaLabel: W.dropContext(n), onRemove: () => onDropContext(n) }))} />
      )}

      {busy && (
        <p className="fc-busy" role="status"><Bub icon="t-chef" size={28} />{W.busy}</p>
      )}

      {error && (
        <div className="fc-err" role="alert">
          <b>{error.message}</b>
          <Acts>
            <Btn sm onClick={onRetry} disabled={busy}>{W.retry}</Btn>
            <Lk onClick={onEditFailed}>{W.editFailed}</Lk>
          </Acts>
        </div>
      )}

      {lastReply && !error && (
        <button type="button" className="fc-last" onClick={() => setThreadOpen(true)} aria-label={`${W.openThread}: ${lastReply}`}>
          <Bub icon="t-chef" size={30} />
          <span className="tx">{lastReply}</span>
          <Chev />
        </button>
      )}

      <div className="fc-cmp">
        <button type="button" aria-label={W.pantry} onClick={onOpenPantry}>
          <Icon3D name="t-stack" size={24} />
        </button>
        <textarea
          value={text}
          rows={2}
          onChange={e => onText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
          placeholder={W.messagePlaceholder}
          aria-label={W.messageAria}
        />
        <MicTile voice={voice} size="sm" />
        <button type="button" className="go" aria-label={W.send} disabled={busy || text.trim().length === 0} onClick={onSend}>
          <Icon3D name="t-send" size={24} />
        </button>
      </div>

      <VoiceBubble voice={voice} domain="fuel" />

      {threadOpen && (
        <Sheet onClose={() => setThreadOpen(false)} className="fo-sheet fc-thread" labelledBy="workshop-thread-title">
          {close => (
            <>
              <FoSheetHead icon="t-chef" title={W.threadTitle} titleId="workshop-thread-title" sub={W.threadSub} onClose={close} />
              <div className="fc-bubs">
                {history.map((m, i) => (
                  <div key={i} className={'fc-bub' + (m.role === 'user' ? ' me' : '')}>
                    <small>{m.role === 'user' ? W.you : W.workshop}</small>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>
              <Acts><Lk onClick={close}>{M.fuelRecept.common.close}</Lk></Acts>
            </>
          )}
        </Sheet>
      )}
    </div>
  )
}
