// ============================================================
// Mezo · MealSkipSheet — „Miért marad ki?" for a skipped meal window (Kihagyás S3, mezo-q4xt2.3;
// Folyadék F5, mezo-n4wf5.5 — prototype vilagos/fuel.js `mealwhy`). The anatomy is the training sheet's
// (`SkipReasonSheet`): head, the reason grid, the Egyéb voice field, the shared „Meddig tarthat?" row, a
// calm hint, „Kész" / „Most nem mondom". Presentational: the page owns the skip row and every write (a
// reason tap saves at once).
// A skip is never a miss — no word here grades the user.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { useM } from '@/shared/i18n'
import { Acts, Btn, Bub, FoSheetHead, Lab, Lk } from '@/shared/ui/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'
import type { PlannedSkip, SkipReason } from '@/features/train/logic/plannedSkips'
import type { RecoveryEstimate } from '@/features/train/logic/recovery'
import { KIMELO } from '@/features/train/logic/skipCopy'
import { RecoveryDurationRow } from '@/features/train/components/RecoveryDurationRow'
import { RECOVERY_CLOSE_MS } from '@/features/train/components/SkipReasonSheet'
import { Tip } from '@/features/fuel/components/folyadek'
import { MEAL_REASONS, mealSkipLabel } from '@/features/fuel/logic/mealSkips'

const TEXT_MAX = 500

export interface MealSkipSheetProps {
  open: boolean
  /** The live skip row — the caller re-renders it after each `onReason`. */
  skip: PlannedSkip | undefined
  /** The slot's label (e.g. „Uzsonna") — the head's sub line names it. */
  slotLabel: string
  onClose(): void
  /** A reason was tapped — save it right away (the card behind updates live). */
  onReason(reason: SkipReason, text?: string | null): void
  /** „Kész" — save the Egyéb text (null when empty or not OTHER); the sheet then closes. */
  onDone(text?: string | null): void
  /** No kímélő period is open yet (the caller knows) — a serious reason may offer „Meddig tarthat?". */
  canOpenRecovery?: boolean
  /** A duration chip was tapped — open the period for the skipped day. Rejects on failure. */
  openRecovery?(req: { category: SkipReason; estimate: RecoveryEstimate; startDate: string }): Promise<unknown>
}

export function MealSkipSheet(props: MealSkipSheetProps) {
  if (!props.open || !props.skip) return null
  return <MealSkipSheetBody key={props.skip.id} {...props} skip={props.skip} />
}

function MealSkipSheetBody({
  skip, slotLabel, onClose, onReason, onDone, canOpenRecovery, openRecovery,
}: MealSkipSheetProps & { skip: PlannedSkip }) {
  const M = useM()
  const K = M.fuelMai.skipSheet
  const toast = useToast()
  const [km, setKm] = useState<{ estimate: RecoveryEstimate; saved: boolean } | null>(null)
  const [text, setText] = useState(skip.reasonText ?? '')
  const closeRef = useRef<() => void>(() => {})
  const life = useRef<{ timer: ReturnType<typeof setTimeout> | null; mounted: boolean }>({ timer: null, mounted: true })
  const latest = useRef({ toast })
  latest.current = { toast }
  const announce = useCallback(() => latest.current.toast.show({ kind: 'success', text: KIMELO.toastOn }), [])
  useEffect(() => {
    const l = life.current
    l.mounted = true
    return () => {
      l.mounted = false
      // Closed early after the period was saved: still announce, just without the wait.
      if (l.timer) { clearTimeout(l.timer); l.timer = null; announce() }
    }
  }, [announce])

  const cur = skip.reasonCategory
  const chosen = cur !== 'NONE'
  const reason = MEAL_REASONS.find((r) => r.value === cur)
  const serious = Boolean(reason?.serious)
  const otherText = () => (cur === 'OTHER' ? text.trim() || null : null)

  const pickEstimate = (estimate: RecoveryEstimate) => {
    if (km || !openRecovery) return
    setKm({ estimate, saved: false })
    openRecovery({ category: cur, estimate, startDate: skip.date }).then(
      () => {
        if (!life.current.mounted) return announce()
        setKm({ estimate, saved: true })
        life.current.timer = setTimeout(() => {
          life.current.timer = null
          announce()
          closeRef.current()
        }, RECOVERY_CLOSE_MS)
      },
      () => { if (life.current.mounted) setKm(null) },
    )
  }

  const care = cur === 'ILLNESS' || cur === 'STOMACH' || cur === 'TRAVEL' ? K.care[cur] : K.care.other
  const note: { icon: Icon3DName; title: string; body?: string } = !reason
    ? { icon: 't-info', title: K.optional, body: K.optionalBody }
    : serious
      ? { icon: 't-heart', title: care, body: canOpenRecovery ? K.careBody : undefined }
      : { icon: 't-info', title: K.notMiss, body: K.notMissBody }

  return (
    <Sheet onClose={onClose} labelledBy="meal-skip-title" className="fo-sheet fa-why">
      {(close) => {
        closeRef.current = close
        return (
          <>
            <FoSheetHead icon="t-skip" title={K.title} titleId="meal-skip-title" sub={K.sub(slotLabel)} />

            <div className="fa-whyg" role="group" aria-label={K.group}>
              {MEAL_REASONS.map((r) => (
                <button key={r.value} type="button" className={cur === r.value ? 'on' : undefined} aria-pressed={cur === r.value}
                  onClick={() => onReason(r.value, r.value === 'OTHER' ? text.trim() || null : undefined)}>
                  <Bub icon={r.icon as Icon3DName} size={40} />
                  <span>{r.label}</span>
                </button>
              ))}
            </div>

            {cur === 'OTHER' && (
              <>
                <Lab id="meal-skip-text">{K.otherLabel}</Lab>
                <VoiceField domain="fuel" className="fa-inpmic" onTranscript={(t) => setText((d) => appendDictation(d, t, TEXT_MAX))}>
                  <textarea className="fo-in" aria-labelledby="meal-skip-text" value={text} maxLength={TEXT_MAX} placeholder={K.otherPlaceholder}
                    onChange={(e) => setText(e.target.value)} />
                </VoiceField>
              </>
            )}

            {serious && (canOpenRecovery || km) && openRecovery && (
              <RecoveryDurationRow value={km?.estimate ?? null} disabled={Boolean(km)} onPick={pickEstimate} />
            )}

            {km ? (
              <div className="fa-whynote is-km" role="status">
                <Tip icon="t-kimelo" title={K.gentleOn}>{K.gentleOnBody}</Tip>
              </div>
            ) : (
              <div className="fa-whynote">
                <Tip icon={note.icon} title={note.title}>{note.body}</Tip>
              </div>
            )}

            <Acts>
              <Btn sm grow disabled={!chosen}
                onClick={() => {
                  const t = otherText()
                  onDone(t)
                  toast.show({ kind: 'success', text: K.doneToast(mealSkipLabel({ ...skip, reasonText: cur === 'OTHER' ? t : skip.reasonText })) })
                  close()
                }}>
                {K.done}
              </Btn>
              <Lk
                onClick={() => {
                  // Keep a typed Egyéb text silently, just no toast.
                  const t = otherText()
                  if (cur === 'OTHER' && t !== (skip.reasonText?.trim() || null)) onReason('OTHER', t)
                  close()
                }}>{K.notNow}</Lk>
            </Acts>
          </>
        )
      }}
    </Sheet>
  )
}
