import type { GoalOverviewResponse } from '@/data/me/goalApi'
import { huMonthDay } from '@/shared/lib/dates'
import { hu1 } from '@/shared/lib/huNum'
import { courseCopy } from '@/features/me/logic/goalOverviewCopy'

function signed(value: number | null | undefined): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${hu1(Math.abs(value))} kg/hét`
}

export function GoalCourseHero({ overview, onOpenWeight, onRepair }: {
  overview: GoalOverviewResponse
  onOpenWeight: () => void
  onRepair: () => void
}) {
  const copy = courseCopy(overview.courseStatus, overview.courseReasonCode)
  const invalid = overview.courseStatus === 'invalid'
  const completion = Math.min(100, Math.max(0, Math.round(overview.completionPct)))

  return (
    <article className={`goal-course-hero is-${overview.courseStatus} rise`} style={{ '--goal-progress': completion } as React.CSSProperties}>
      <button type="button" className="goal-course-open np-press" onClick={onOpenWeight} aria-label="Súlyhaladás részletei">
        <div className="goal-course-top">
          <div className="goal-course-message">
            <span className="mz-eyebrow">{copy.eyebrow}</span>
            <h1>{copy.heading}</h1>
            <p>{copy.body}</p>
          </div>
          <span className="goal-course-ring" aria-label={`A cél ${completion} százaléka teljesült`}>
            <span>{completion}%</span>
          </span>
        </div>

        <div className="goal-course-weights">
          <span><b>{hu1(overview.currentWeightKg)}</b><small>most · kg</small></span>
          <i aria-hidden="true" />
          <span><b>{overview.targetWeightKg == null ? '—' : hu1(overview.targetWeightKg)}</b><small>cél · kg</small></span>
        </div>

        {!invalid && (
          <div className="goal-course-paces">
            <span><small>Tényleges ütem</small><b>{signed(overview.observedRateKgPerWeek)}</b></span>
            <span><small>Tervezett ütem</small><b>{signed(overview.targetRateKgPerWeek)}</b></span>
          </div>
        )}
        {!invalid && overview.projectedTargetDate && (
          <span className="goal-course-date">Várható cél: {huMonthDay(overview.projectedTargetDate)}</span>
        )}
      </button>
      {invalid && (
        <button type="button" className="goal-course-repair np-press" onClick={onRepair}>Cél javítása ›</button>
      )}
    </article>
  )
}
