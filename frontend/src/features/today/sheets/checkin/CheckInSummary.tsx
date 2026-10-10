// Check-in · the summary rows (Folyadék, prototype vilagos/nap.js `ckSheet()` summary, `.np-sum`):
// every step of the slot as a row: its icon, label, and the answer, „kihagyva" (skipped) or
// „üres" (not reached, e.g. after „Most csak ennyi"), with the answer's level under it. A tap goes
// back to that step.
import { Level, Row, Why } from '@/shared/ui/folyadek'
import { CHECKIN_LOOK, answerText } from '@/features/today/logic/checkinItems'
import { answerLevel, answerTone } from '@/features/today/sheets/checkin/answerLevel'
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
        <Why icon="t-tick">
          <b>Most csak ennyi.</b> Az alap megvan. A többi kérdés üres marad, a check-in így is beszámít.
        </Why>
      )}
      <div className="nck2-sum">
        {steps.map((s, i) => {
          const isAd = adaptiveId != null && i === steps.length - 1
          const d = answerText(s.id, answers)
          const has = d !== null && d !== '—'
          return (
            <Row key={s.id} className={isAd ? 'is-ad' : undefined}
              icon={CHECKIN_LOOK[s.id].icon}
              title={`${s.label}${isAd ? ' · a nap kérdése' : ''}`}
              value={has ? d : <span className="nck2-none">{d === null ? 'üres' : 'kihagyva'}</span>}
              more={<Level pct={answerLevel(s.id, answers)} color={has ? answerTone(s.id, answers) : 'var(--fo-faint)'} height={8} />}
              right=""
              onClick={() => onEdit(i)} />
          )
        })}
      </div>
    </>
  )
}
