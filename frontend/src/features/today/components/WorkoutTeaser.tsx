import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { CtaPrimary } from '@/shared/ui/Cta'
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
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="col gap-sm">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow">Mai edzés{time ? ` · ${time}` : ''}</span>
          <span className="eyebrow text-tertiary">~{workout.durationEst} perc</span>
        </div>
        <button
          className="card notch-12"
          onClick={() => navigate('/train')}
          style={{ padding: 0, textAlign: 'left', overflow: 'hidden', position: 'relative' }}
        >
          {niggle && workout.niggleWarning && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
              padding: '10px 16px',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <Icon name="warning" size={14} color="var(--warning)" />
              <div style={{ flex: 1 }}>
                <div className="label-mono" style={{ fontSize: 9, color: 'var(--warning)' }}>{workout.niggleWarning.muscleLabel} · aktív niggle</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                  Cable Pull-Around előrébb, Lat Pulldown pronated.
                </div>
              </div>
            </div>
          )}
          <div style={{ padding: '16px 18px' }}>
            <div className="h-display size-md">{workout.title}</div>
            <div className="text-secondary mt-sm" style={{ fontSize: 12 }}>
              {workout.exercises.length} gyakorlat · {workout.exercises.reduce((a, e) => a + e.sets, 0)} sorozat
            </div>
            <div className="row gap-sm mt-md flex-wrap">
              {workout.exercises.slice(0, 3).map((e, i) => (
                <span key={i} className="chip" style={{ fontSize: 9 }}>{e.name}</span>
              ))}
              {workout.exercises.length > 3 && (
                <span className="chip" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>+{workout.exercises.length - 3}</span>
              )}
            </div>
            <div className="row mt-lg" style={{ justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              {prediction ? (
                <div className="col" style={{ gap: 2 }}>
                  <span className="eyebrow brand">Prediction · {prediction.confidence}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{prediction.label}</span>
                </div>
              ) : (
                <span className="eyebrow text-tertiary">Részletek a Train fülön</span>
              )}
              <Icon name="chevron-right" size={20} color="var(--brand-glow)" />
            </div>
          </div>
        </button>
        <CtaPrimary onClick={() => navigate('/train')}>
          <span>Indítsuk</span>
          <span style={{ opacity: 0.5, fontWeight: 400 }}>·</span>
          <span>{workout.title}</span>
        </CtaPrimary>
      </div>
    </div>
  )
}
