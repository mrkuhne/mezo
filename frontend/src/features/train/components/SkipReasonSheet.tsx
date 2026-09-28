import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'
import { VoiceBubble } from '@/shared/ui/voice/VoiceBubble'
import { cn } from '@/shared/lib/cn'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import type { PlannedSkip, SkipReason } from '@/features/train/logic/plannedSkips'
import { REASONS, sheetNoteParts, skipDoneToast } from '@/features/train/logic/skipCopy'

const TEXT_MAX = 500

export interface SkipReasonSheetProps {
  open: boolean
  /** The live skip row — re-rendered by the caller after each `onReason`, so the lit chip and
   *  the note (serious / free pass / counts) follow the server's verdict. */
  skip: PlannedSkip | undefined
  /** The skipped occurrence's name (e.g. „Pull Day") — the eyebrow shows it upper-cased. */
  title: string
  onClose(): void
  /** A chip was tapped — save the reason right away (the card behind updates live). */
  onReason(reason: SkipReason, text?: string | null): void
  /** „Kész" — save the OTHER text (null when empty or not OTHER); the sheet then closes. */
  onDone(text?: string | null): void
}

/**
 * „Miért marad ki?" (Kihagyás S1, mezo-q4xt2.1 — prototype elo/edzes.html `whySheet()`): the
 * optional reason for a skip. Eight flat 3D chips in two columns, „Egyéb" opens a free-text field
 * with dictation, a calm note says what the skip does to the week, and „Most nem mondom" / „Kész"
 * close it. Presentational: the caller owns the skip row and the saving.
 */
export function SkipReasonSheet(props: SkipReasonSheetProps) {
  if (!props.open || !props.skip) return null
  return <SkipReasonSheetBody key={props.skip.id} {...props} skip={props.skip} />
}

function SkipReasonSheetBody({ skip, title, onClose, onReason, onDone }: SkipReasonSheetProps & { skip: PlannedSkip }) {
  const toast = useToast()
  const [text, setText] = useState(skip.reasonText ?? '')
  const voice = useVoiceInput((t) => setText((d) => (d ? `${d} ${t}` : t).slice(0, TEXT_MAX)))
  const recording = voice.state === 'recording'
  const cur = skip.reasonCategory
  const chosen = cur !== 'NONE'
  const note = sheetNoteParts(skip)
  const otherText = () => (cur === 'OTHER' ? text.trim() || null : null)

  return (
    <Sheet glass onClose={onClose} labelledBy="skip-why-title" className="trm-whysheet">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-skip" eyebrow={`KIHAGYVA · ${title.toLocaleUpperCase('hu')}`} title="Miért marad ki?"
            titleId="skip-why-title" sub="Nem kötelező — segít, hogy a terv hozzád igazodjon." onClose={close} />

          <div className="trm-whyg" role="group" aria-label="A kihagyás oka">
            {REASONS.map((r) => (
              <button key={r.id} type="button" className={cn('trm-whyc', cur === r.id && 'on')} aria-pressed={cur === r.id}
                onClick={() => onReason(r.id, r.id === 'OTHER' ? text.trim() || null : undefined)}>
                <Icon3D name={r.icon} size={30} />
                <span>{r.label}</span>
              </button>
            ))}
          </div>

          {cur === 'OTHER' && (
            <div className="uvl-field">
              <span className="uvl-flabel" id="skip-why-text">Mi történt? · saját szavakkal</span>
              <span className="trm-inpmic">
                <textarea aria-labelledby="skip-why-text" value={text} maxLength={TEXT_MAX} placeholder="pl. családi program jött közbe"
                  onChange={(e) => setText(e.target.value)} />
                <button type="button" className={cn('trm-micb', recording && 'is-live')} onClick={voice.toggle}
                  disabled={voice.state === 'unsupported' || voice.state === 'transcribing'}
                  aria-label={recording ? 'Felvétel leállítása' : 'Diktálás'} aria-pressed={recording}>
                  <Icon3D name="t-mic" size={26} />
                </button>
              </span>
              <VoiceBubble voice={voice} domain="train" />
            </div>
          )}

          <div className="trm-whynote">
            <Icon3D name={note.icon} size={22} />
            <span>{note.bold && <b>{note.bold}</b>}{note.rest}</span>
          </div>

          <div className="uvl-foot">
            <button type="button" className="uvl-ghost"
              onClick={() => {
                // Like the prototype's data-whydone="0": keep a typed Egyéb text, just no toast.
                const t = otherText()
                if (cur === 'OTHER' && t !== (skip.reasonText?.trim() || null)) onReason('OTHER', t)
                close()
              }}>Most nem mondom</button>
            <button type="button" className="uvl-cta" disabled={!chosen}
              onClick={() => {
                const t = otherText()
                onDone(t)
                toast.show({ kind: 'success', text: skipDoneToast(skip, t) })
                close()
              }}>
              <Icon3D name="t-tick" size={20} />Kész
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
