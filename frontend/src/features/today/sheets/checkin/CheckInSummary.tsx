// Check-in 2.0 · the summary cells (prototype `elo/nap.html` `SH.checkin`, `.sumn`): every step of
// the slot as a cell — its 3D mark, label, and the answer, „kihagyva" (skipped) or „üres" (not
// reached, e.g. after „Most csak ennyi"). The question of the day spans the row. A tap goes back
// to that step.
import type { CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { CHECKIN_LOOK, answerText } from '@/features/today/logic/checkinItems'
import type { CheckinItemId, CheckinValues } from '@/data/types'

export function CheckInSummary({ steps, answers, adaptiveId, quick, onEdit }: {
  steps: { id: CheckinItemId; label: string }[]
  answers: CheckinValues
  adaptiveId: CheckinItemId | null
  quick: boolean
  onEdit: (step: number) => void
}) {
  return (
    <>
      {quick && (
        <div className="ck-callout ck-qbanner" style={{ '--c': 'var(--dv-sage)' } as CSSProperties}>
          <span className="ck-callout-eb">Most csak ennyi</span>
          <p>Az alap megvan. A többi kérdés most üres marad — a check-in így is beszámít.</p>
        </div>
      )}
      <div className="ck-sumn">
        {steps.map((s, i) => {
          const look = CHECKIN_LOOK[s.id]
          const isAd = adaptiveId != null && i === steps.length - 1
          const d = answerText(s.id, answers)
          const shown = d === null ? 'üres' : d === '—' ? 'kihagyva' : d
          return (
            <button key={s.id} type="button" className={isAd ? 'ck-sum is-ad' : 'ck-sum'}
              style={{ '--c': look.color } as CSSProperties} onClick={() => onEdit(i)}>
              <Icon3D name={look.icon} size={26} />
              <span>
                <small>{s.label}{isAd ? ' · a nap kérdése' : ''}</small>
                <b className={d && d !== '—' ? undefined : 'is-none'}>{shown}</b>
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}
