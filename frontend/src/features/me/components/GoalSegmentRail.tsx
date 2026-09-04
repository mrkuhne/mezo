import { huMonthDay } from '@/shared/lib/dates'

export function GoalSegmentRail({ label, fromWeek, toWeek, nextLabel, nextFromWeek, nextChangeDate }: {
  label: string
  fromWeek: number
  toWeek: number
  nextLabel?: string | null
  nextFromWeek?: number | null
  nextChangeDate?: string | null
}) {
  return (
    <section className="goal-detail-card goal-segment-rail rise" aria-label="Célszakaszok">
      <div className="goal-segment-node is-current">
        <span className="goal-detail-kicker">Most</span>
        <strong>{label}</strong>
        <small>W{fromWeek}–{toWeek}</small>
      </div>
      <div className="goal-segment-line" aria-hidden="true"><span /></div>
      <div className="goal-segment-node">
        <span className="goal-detail-kicker">Következő</span>
        {nextLabel ? (
          <><strong>{nextLabel}</strong><small>{nextFromWeek ? `W${nextFromWeek}-től` : ''}{nextChangeDate ? ` · ${huMonthDay(nextChangeDate)}` : ''}</small></>
        ) : (
          <strong>Nincs következő szakasz</strong>
        )}
      </div>
    </section>
  )
}
