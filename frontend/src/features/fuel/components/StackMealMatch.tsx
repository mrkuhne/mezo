import { Link } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
import type { MealMatchResult } from '@/features/fuel/logic/matchMealsToStack'

// StackMealMatch — renders Task 7's matchMealsToStack() result on the Stack page (mezo-vx9v Task
// 8): a suggestion row per fat-/protein-bound zone that has no matching meal logged yet (zone
// label + time gutter, the recipe name linking into the recipe detail page, then the macro metric
// + the reason it was suggested), followed by today's/yesterday's verdict rows (a lit tick when
// the logged meal clears the macro floor, a warning-tinted flat marker + advice when it doesn't).
// Hidden entirely when both arrays are empty — a rest day / a stack with no fat- or protein-bound
// items has nothing to say here.
//
// ÜVEG (mezo-me75u.2; prototypes/uveg-fuel-tobbi.html `protokoll()` „Étkezéshez"): ONE flat cell
// (never glass — it sits on the page next to the glass zone cards), rows split by hairlines, the
// suggestion wears the bowl, an ok verdict the 3D tick, a short one a warning-tinted flat marker.
export function StackMealMatch({ result, className, style }: {
  result: MealMatchResult
  /** entrance hook (`rise`) when the host page arms an EntranceGroup */
  className?: string
  style?: React.CSSProperties
}) {
  if (result.suggestions.length === 0 && result.verdicts.length === 0) return null

  return (
    <div className={className ? `fsx-mm uv-flat ${className}` : 'fsx-mm uv-flat'} style={style}>
      <span className="fsx-mm-eyebrow uv-eyebrow">Étkezés-egyeztetés · macro + micro match</span>
      {result.suggestions.map((s, i) => (
        <div key={`sug-${s.zone}-${i}`} className="fsx-mm-row">
          <span className="fsx-mm-art" aria-hidden="true"><Icon3D name="t-bowl" size={28} /></span>
          <span className="fsx-mm-copy">
            <span className="fsx-mm-when">
              <b>{s.zoneLabel}</b> · <time>{s.time}</time>
            </span>
            <Link to={`/fuel/recipes/${s.recipeId}`} className="fsx-mm-link">
              {s.recipeName}
            </Link>
            <small>{s.metric} · {s.reason}</small>
          </span>
        </div>
      ))}
      {result.verdicts.map((v, i) => (
        <div key={`vd-${v.zone}-${v.dayLabel}-${i}`} className="fsx-mm-row">
          {v.ok ? (
            <span className="fsx-mm-mark is-ok" aria-hidden="true"><Icon3D name="t-tick" size={28} /></span>
          ) : (
            <span className="fsx-mm-mark is-warn" aria-hidden="true">!</span>
          )}
          <span className="fsx-mm-copy">
            <span className="fsx-mm-title">
              {v.mealTitle}{' '}
              <span className="fsx-mm-day">· {v.dayLabel}</span>
            </span>
            <small>{v.metric}</small>
            {v.advice && <small className="fsx-mm-advice">{v.advice}</small>}
          </span>
        </div>
      ))}
    </div>
  )
}
