import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Workout, WorkoutPlan, WorkoutPrediction } from '@/data/types'

export function WorkoutTeaser({
  workout,
  niggle,
  time,
  prediction,
}: {
  workout: Workout | WorkoutPlan
  niggle: boolean
  /** Today's gym-slot time; null/absent renders the eyebrow without a time. */
  time?: string | null
  /** Demo prediction line (mock mode); null/absent hides the row — real predictions are a later epic. */
  prediction?: WorkoutPrediction | null
}) {
  const navigate = useNavigate()
  const goTrain = () => navigate('/train')
  return (
    <section className="np-hero np-anim" style={{ '--i': 2 } as CSSProperties}>
      <div className="np-hero-eyebrow"><span className="dotp" />Következő · ma {time ?? '—'}</div>
      <div className="h2row">
        <h2>{workout.title}</h2>
        <span className="typetag typetag-gym">🏋️ Gym{workout.tag ? ` · ${workout.tag}` : ''}</span>
      </div>
      <div className="np-hero-meta">
        <b>{workout.exercises.length} gyakorlat · ~{workout.durationEst} perc</b>
        {prediction ? <> · {prediction.label}</> : null}
      </div>
      {niggle && workout.niggleWarning && (
        <div className="warmstrip">⚠️ {workout.niggleWarning.detail}</div>
      )}
      <div className="np-ctarow">
        <button type="button" className="np-cta np-press" onClick={goTrain}>Indítsuk →</button>
        <button type="button" className="alt-btn np-press" aria-label="Részletek" onClick={goTrain}>⋯</button>
      </div>
    </section>
  )
}
