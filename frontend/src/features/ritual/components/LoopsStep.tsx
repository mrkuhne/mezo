import type { CSSProperties } from 'react'
import { useCheckins, useIntentionActions, useIntentionDay } from '@/data/hooks'
import type { Reflection } from '@/data/types'
import { openLoops } from '@/features/ritual/logic/openLoops'
import { localDateString } from '@/shared/lib/dates'
import { ClayIcon } from '@/shared/ui/clay'

const REFLECT_LABEL: Record<Reflection, string> = { yes: 'Igen', partial: 'Részben', no: 'Nem' }

/**
 * Napzárás act 4 — Nyitott hurkok (mezo-ilsj, spec §4). Soft close-out of the day's two GATED
 * loops (missed check-in, intention reflection) plus a standing "log anything else" journal
 * invite. Nothing here is mandatory — Tovább always advances regardless of state.
 *
 * The reused sheets (CheckInSheet, ActivityLogSheet) live one level up on RitualPage, not
 * here (the TodayPage precedent, TodayPage.tsx:37-42/76-83) — this step only SIGNALS via
 * onOpenCheckIn/onOpenJournal; RitualPage owns the sheet open/close state and the
 * next-open-slot index math (its own parallel `useCheckins` + the same findIndex predicate).
 *
 * The reflect row is INLINE (the IntentionBanner precedent, IntentionBanner.tsx:85-100) rather
 * than a sheet: the three Igen/Részben/Nem buttons call `useIntentionActions(date).reflect`
 * directly, collapsing to a checkmark line once `reflection` is set. It only renders at all
 * when the day HAS a focus — with none, there is nothing to reflect on (openLoops.ts).
 *
 * The journal row is deliberately EVERGREEN — no closed state, never glows, and excluded from
 * `openLoops` — "did anything else happen today" is always askable, unlike the two scheduled
 * loops above (and mock-mode's `useActivities` seed is date-invariant, so gating the invite on
 * "already logged today" would make it permanently vanish in mock mode).
 */
export function LoopsStep({ onNext, onOpenCheckIn, onOpenJournal }: {
  onNext: () => void
  onOpenCheckIn: () => void
  onOpenJournal: () => void
}) {
  const date = localDateString()
  const { checkins } = useCheckins()
  const { data: intention } = useIntentionDay(date)
  const { reflect } = useIntentionActions(date)

  const { checkinOpen, reflectOpen } = openLoops({ checkins, intention })
  const hasFoci = intention.foci.length > 0
  const nothingOpen = !checkinOpen && !reflectOpen
  const checkinsDone = checkins.filter((c) => c.state === 'done').length
  const nextSlot = checkins.find((c) => c.state === 'now' || c.state === 'pending')
  // Glow only ever lands on one of the two GATED loops (never journal — see doc comment).
  const firstOpen = checkinOpen ? 'checkin' : reflectOpen ? 'reflect' : null

  return (
    <div className="rz-act rz-loops">
      <div className="rz-story-eyebrow">Nyitott hurkok</div>
      <p className="rz-loops-sub">Zárd le, ami még nyitva — aztán elengedheted.</p>

      {nothingOpen ? (
        <div className="rz-loop rz-nw rz-loop-beat np-anim" style={{ '--i': 0 } as CSSProperties}>
          Minden hurok zárva ✓
        </div>
      ) : (
        <>
          <div
            className={`rz-loop rz-nw np-anim${checkinOpen ? (firstOpen === 'checkin' ? ' glow' : '') : ' rz-loop-done'}`}
            style={{ '--i': 0 } as CSSProperties}
          >
            {checkinOpen ? (
              <>
                <span className="rz-nw-spot" aria-hidden="true"><ClayIcon name="i-checkin" size={19} /></span>
                <span className="rz-loop-text">{nextSlot?.time} check-in kimaradt</span>
                <button className="rz-loop-act" onClick={onOpenCheckIn}>Koppints</button>
              </>
            ) : (
              <>
                <span className="rz-loop-mk" aria-hidden="true">✓</span>
                <span className="rz-loop-text">{checkinsDone}/{checkins.length} check-in kész</span>
              </>
            )}
          </div>

          {hasFoci && (
            <div
              className={`rz-loop rz-nw np-anim${reflectOpen ? (firstOpen === 'reflect' ? ' glow' : '') : ' rz-loop-done'}`}
              style={{ '--i': 1 } as CSSProperties}
            >
              {reflectOpen ? (
                <>
                  <span className="rz-nw-spot" aria-hidden="true"><ClayIcon name="i-cel" size={19} /></span>
                  <span className="rz-loop-text">Szándékkal élted a napot?</span>
                  <span className="rz-loop-chips">
                    {(['yes', 'partial', 'no'] as Reflection[]).map((v) => (
                      <button key={v} className="rz-loop-chip" onClick={() => reflect(v)}>{REFLECT_LABEL[v]}</button>
                    ))}
                  </span>
                </>
              ) : (
                <>
                  <span className="rz-loop-mk" aria-hidden="true">✓</span>
                  <span className="rz-loop-text">A mai szándékodra reflektáltál.</span>
                </>
              )}
            </div>
          )}
        </>
      )}

      <div className="rz-loop rz-nw np-anim" style={{ '--i': 2 } as CSSProperties}>
        <span className="rz-nw-spot" aria-hidden="true"><ClayIcon name="i-naplo" size={19} /></span>
        <span className="rz-loop-text">Történt még valami ma?</span>
        <button className="rz-loop-act" onClick={onOpenJournal}>Napló</button>
      </div>

      <button className="rz-cta" onClick={onNext}>Tovább</button>
    </div>
  )
}
