import { huInt } from '@/shared/lib/huNum'

export function GoalDietWeekCard({ trainingDayKcal, restDayKcal, weekAverageKcal }: {
  trainingDayKcal?: number | null
  restDayKcal?: number | null
  weekAverageKcal?: number | null
}) {
  const split = trainingDayKcal != null && restDayKcal != null
  return (
    <section className="goal-detail-card goal-diet-week rise" aria-label="Heti kalóriaterv">
      <div className="goal-detail-kicker">Heti ritmus</div>
      {split ? (
        <div className="goal-diet-comparison">
          <div><small>Edzésnap</small><strong>{huInt(trainingDayKcal)} kcal</strong></div>
          <div><small>Pihenőnap</small><strong>{huInt(restDayKcal)} kcal</strong></div>
          <div><small>Heti átlag</small><strong>{weekAverageKcal == null ? '—' : `${huInt(weekAverageKcal)} kcal`}</strong></div>
        </div>
      ) : (
        <div className="goal-diet-uniform">
          <div><small>Egységes keret</small><strong>{weekAverageKcal == null ? '—' : `${huInt(weekAverageKcal)} kcal`}</strong></div>
          <p>Edzés- és pihenőnapra azonos keret érvényes.</p>
        </div>
      )}
    </section>
  )
}
