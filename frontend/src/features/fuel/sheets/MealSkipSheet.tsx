// ============================================================
// Mezo · MealSkipSheet — „Miért marad ki?" for a skipped meal window (Kihagyás S3,
// mezo-q4xt2.3; prototype elo/fuel.html `mealWhy()`). The sheet anatomy is the training
// sheet's (`SkipReasonSheet`): header, chip grid, the Egyéb voice field, the shared
// „MEDDIG TARTHAT?" row, a calm note, „Most nem mondom" / „Kész". Presentational: the page
// owns the skip row and every write (a chip tap saves the reason at once).
// A skip is never a miss — no word here grades the user.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { cn } from '@/shared/lib/cn'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'
import type { PlannedSkip, SkipReason } from '@/features/train/logic/plannedSkips'
import type { RecoveryEstimate } from '@/features/train/logic/recovery'
import { KIMELO } from '@/features/train/logic/skipCopy'
import { RecoveryDurationRow } from '@/features/train/components/RecoveryDurationRow'
import { RECOVERY_CLOSE_MS } from '@/features/train/components/SkipReasonSheet'
import { MEAL_REASONS, mealSkipLabel } from '@/features/fuel/logic/mealSkips'

const TEXT_MAX = 500
const CARE: Partial<Record<SkipReason, string>> = { ILLNESS: 'Jobbulást!', STOMACH: 'Jobbulást!', TRAVEL: 'Jó utat!' }
const KM_ON_REST = ' · amíg tart, a Fuel nem kér számon semmit, az edzés és a sport pedig magától kimarad.'

export interface MealSkipSheetProps {
  open: boolean
  /** The live skip row — the caller re-renders it after each `onReason`. */
  skip: PlannedSkip | undefined
  /** The slot's label (e.g. „Uzsonna") — the eyebrow shows it upper-cased. */
  slotLabel: string
  onClose(): void
  /** A chip was tapped — save the reason right away (the card behind updates live). */
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

  const note: { icon: Icon3DName; bold?: string; rest: string } = !reason
    ? { icon: 't-info', rest: 'Ha megmondod, miért, a coach érteni fogja a mintát. Nem kötelező.' }
    : serious
      ? {
          icon: 't-heart', bold: CARE[cur] ?? 'Kíméld magad.',
          rest: canOpenRecovery ? ' Ha több napig tarthat, válaszd ki, meddig. A kímélő mód a Fuelt is átállítja.' : '',
        }
      : { icon: 't-info', bold: 'Nem számít mulasztásnak.', rest: ' A mai kereted nem változik, és a többi étkezésed sem lesz nagyobb.' }

  return (
    <Sheet glass onClose={onClose} labelledBy="meal-skip-title" className="trm-whysheet">
      {(close) => {
        closeRef.current = close
        return (
          <div className="uvl-body">
            <SheetHead icon="t-skip" eyebrow={`KIHAGYVA · ${slotLabel.toLocaleUpperCase('hu')}`} title="Miért marad ki?"
              titleId="meal-skip-title" sub="Nem kötelező. Segít, hogy a coach értse a mintát." onClose={close} />

            <div className="trm-whyg" role="group" aria-label="A kihagyás oka">
              {MEAL_REASONS.map((r) => (
                <button key={r.value} type="button" className={cn('trm-whyc', cur === r.value && 'on')} aria-pressed={cur === r.value}
                  onClick={() => onReason(r.value, r.value === 'OTHER' ? text.trim() || null : undefined)}>
                  <Icon3D name={r.icon as Icon3DName} size={30} />
                  <span>{r.label}</span>
                </button>
              ))}
            </div>

            {cur === 'OTHER' && (
              <div className="uvl-field">
                <span className="uvl-flabel" id="meal-skip-text">Mi történt? · saját szavakkal</span>
                <VoiceField domain="fuel" className="trm-inpmic" onTranscript={(t) => setText((d) => appendDictation(d, t, TEXT_MAX))}>
                  <textarea aria-labelledby="meal-skip-text" value={text} maxLength={TEXT_MAX} placeholder="pl. elhúzódott a megbeszélés"
                    onChange={(e) => setText(e.target.value)} />
                </VoiceField>
              </div>
            )}

            {serious && (canOpenRecovery || km) && openRecovery && (
              <RecoveryDurationRow value={km?.estimate ?? null} disabled={Boolean(km)} onPick={pickEstimate} />
            )}

            {km ? (
              <div className="trm-whynote is-km" role="status">
                <Icon3D name="t-kimelo" size={22} />
                <span><b>{KIMELO.onLead}</b>{KM_ON_REST}</span>
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
                  // Keep a typed Egyéb text silently, just no toast.
                  const t = otherText()
                  if (cur === 'OTHER' && t !== (skip.reasonText?.trim() || null)) onReason('OTHER', t)
                  close()
                }}>Most nem mondom</button>
              <button type="button" className="uvl-cta" disabled={!chosen}
                onClick={() => {
                  const t = otherText()
                  onDone(t)
                  toast.show({ kind: 'success', text: `Megjegyeztem · ${mealSkipLabel({ ...skip, reasonText: cur === 'OTHER' ? t : skip.reasonText })}` })
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
