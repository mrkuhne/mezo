import { Link } from 'react-router-dom'
import type { MealMatchResult } from '@/features/fuel/logic/matchMealsToStack'

// StackMealMatch — renders Task 7's matchMealsToStack() result on the Stack page (mezo-vx9v Task
// 8): a suggestion row per fat-/protein-bound zone that has no matching meal logged yet (zone
// label + time gutter, the recipe name linking into the recipe detail page, then the macro metric
// + the reason it was suggested), followed by today's/yesterday's verdict rows (✓ sage when the
// logged meal clears the macro floor, ⚠ amber + advice when it doesn't). Hidden entirely when
// both arrays are empty — a rest day / a stack with no fat- or protein-bound items has nothing to
// say here.
export function StackMealMatch({ result, className, style }: {
  result: MealMatchResult
  /** entrance hook (`rise`) when the host page arms an EntranceGroup */
  className?: string
  style?: React.CSSProperties
}) {
  if (result.suggestions.length === 0 && result.verdicts.length === 0) return null

  return (
    <div className={className} style={{ padding: '16px 0 8px', ...style }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="eyebrow" style={{ color: 'var(--sage-deep)' }}>Étkezés-egyeztetés</span>
        <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>macro + micro match</span>
      </div>
      <div className="col gap-sm">
        {result.suggestions.map((s, i) => (
          <div
            key={`sug-${s.zone}-${i}`}
            className="card"
            style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}
          >
            <div className="col" style={{ minWidth: 46, flexShrink: 0 }}>
              <span className="label-mono text-tertiary" style={{ fontSize: 8.5 }}>{s.zoneLabel}</span>
              <span className="label-mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink)' }}>{s.time}</span>
            </div>
            <div className="col flex-1" style={{ minWidth: 0 }}>
              <Link to={`/fuel/recipes/${s.recipeId}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {s.recipeName}
              </Link>
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{s.metric} · {s.reason}</span>
            </div>
          </div>
        ))}
        {result.verdicts.map((v, i) => (
          <div
            key={`vd-${v.zone}-${v.dayLabel}-${i}`}
            className="card"
            style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}
          >
            <span aria-hidden="true" style={{ fontWeight: 800, color: v.ok ? 'var(--sage-deep)' : 'var(--warning)' }}>
              {v.ok ? '✓' : '⚠'}
            </span>
            <div className="col flex-1" style={{ minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                {v.mealTitle}{' '}
                <span className="text-tertiary" style={{ fontWeight: 500 }}>· {v.dayLabel}</span>
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{v.metric}</span>
              {v.advice && <span style={{ fontSize: 10.5, color: 'var(--warning)' }}>{v.advice}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
