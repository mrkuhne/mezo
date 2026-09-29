import { useEffect, useRef, useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'
import { VoiceBubble } from '@/shared/ui/voice/VoiceBubble'
import { cn } from '@/shared/lib/cn'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import type { PlannedSkip, SkipReason } from '@/features/train/logic/plannedSkips'
import { KIMELO, REASONS, sheetNoteParts, skipDoneToast } from '@/features/train/logic/skipCopy'
import { categoryCopy, type RecoveryEstimate } from '@/features/train/logic/recovery'
import { RecoveryDurationRow } from '@/features/train/components/RecoveryDurationRow'

/** How long the „Kímélő mód bekapcsolva" note stays before the sheet closes (prototype: 1.4 s). */
export const RECOVERY_CLOSE_MS = 1400

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
  /** Kímélő mód S2 (mezo-q4xt2.2): a serious reason offers „Meddig tarthat?" — only while no
   *  period is open (the caller knows; omit ⇒ never offered, the S1 sheet). */
  canOpenRecovery?: boolean
  /** A duration chip was tapped — open the period. Resolves on success, rejects on failure
   *  (the failure toast is the global mutation one; the row resets). */
  onOpenRecovery?(estimate: RecoveryEstimate): Promise<unknown>
  /** The period is on and the note has been shown — the sheet is closing. */
  onRecoveryOpened?(): void
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

function SkipReasonSheetBody({
  skip, title, onClose, onReason, onDone, canOpenRecovery, onOpenRecovery, onRecoveryOpened,
}: SkipReasonSheetProps & { skip: PlannedSkip }) {
  const toast = useToast()
  // Kímélő mód: the picked estimate (lit chip + the „bekapcsolva" note) and whether it is saved.
  const [km, setKm] = useState<{ estimate: RecoveryEstimate; saved: boolean } | null>(null)
  const closeRef = useRef<() => void>(() => {})
  const pending = useRef<{ timer: ReturnType<typeof setTimeout> | null; done: boolean; mounted: boolean }>({ timer: null, done: false, mounted: true })
  const finishRecovery = () => {
    if (pending.current.done) return
    pending.current.done = true
    onRecoveryOpened?.()
    toast.show({ kind: 'success', text: KIMELO.toastOn })
  }
  useEffect(() => {
    const p = pending.current
    p.mounted = true
    return () => {
      p.mounted = false
      // Closed early (backdrop, ✕) after the period was saved: still finish, just without the wait.
      if (p.timer) { clearTimeout(p.timer); p.timer = null; finishRecovery() }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pickEstimate = (estimate: RecoveryEstimate) => {
    if (km || !onOpenRecovery) return
    setKm({ estimate, saved: false })
    onOpenRecovery(estimate).then(
      () => {
        if (!pending.current.mounted) return finishRecovery()
        setKm({ estimate, saved: true })
        pending.current.timer = setTimeout(() => {
          pending.current.timer = null
          finishRecovery()
          closeRef.current()
        }, RECOVERY_CLOSE_MS)
      },
      () => { if (pending.current.mounted) setKm(null) },
    )
  }
  const [text, setText] = useState(skip.reasonText ?? '')
  const voice = useVoiceInput((t) => setText((d) => (d ? `${d} ${t}` : t).slice(0, TEXT_MAX)))
  const recording = voice.state === 'recording'
  const cur = skip.reasonCategory
  const chosen = cur !== 'NONE'
  const note = sheetNoteParts(skip)
  const otherText = () => (cur === 'OTHER' ? text.trim() || null : null)

  return (
    <Sheet glass onClose={onClose} labelledBy="skip-why-title" className="trm-whysheet">
      {(close) => {
        closeRef.current = close
        const serious = categoryCopy(cur) !== null
        return (
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

          {serious && (canOpenRecovery || km) && onOpenRecovery && (
            <RecoveryDurationRow value={km?.estimate ?? null} disabled={Boolean(km)} onPick={pickEstimate} />
          )}

          {km ? (
            <div className="trm-whynote is-km" role="status">
              <Icon3D name="t-kimelo" size={22} />
              <span><b>{KIMELO.onLead}</b>{KIMELO.onRest}</span>
            </div>
          ) : (
            <div className="trm-whynote">
              <Icon3D name={note.icon} size={22} />
              <span>{note.bold && <b>{note.bold}</b>}{note.rest}</span>
            </div>
          )}

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
        )
      }}
    </Sheet>
  )
}
