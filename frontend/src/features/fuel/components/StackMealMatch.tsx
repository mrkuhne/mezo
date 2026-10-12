import { Lab, Row, St } from '@/shared/ui/folyadek'
import { useM } from '@/shared/i18n'
import type { MealMatchResult } from '@/features/fuel/logic/matchMealsToStack'

// StackMealMatch — the meal-match rows of the Protokoll page (mezo-vx9v Task 8; Folyadék F5, mezo-n4wf5.5; prototype
// `protokoll()` „Étkezéshez"): a suggestion row per fat- / protein-bound zone (zone + time, the recipe, the macro per
// serving and why — the whole row is the link to the recipe), then today's / yesterday's verdict rows (the meal, its fat,
// „rendben" or „kevés" + the advice). Renders nothing when both arrays are empty.
// The sentences are built by `matchMealsToStack` at render, in the current language; meal and recipe names stay as stored.
export function StackMealMatch({ result }: { result: MealMatchResult }) {
  const M = useM().fuelKieg.protocol
  if (result.suggestions.length === 0 && result.verdicts.length === 0) return null

  return (
    <>
      <Lab>{M.matchLabel}</Lab>
      {result.suggestions.map((s, i) => (
        <Row key={`sug-${s.zone}-${i}`} icon="t-bowl" to={`/fuel/recipes/${s.recipeId}`}
          title={M.slotTime(s.zoneLabel, s.time)}
          sub={<>{s.recipeName}<br />{s.metric} · {s.reason}</>} />
      ))}
      {result.verdicts.map((v, i) => (
        <Row key={`vd-${v.zone}-${v.day}-${i}`} icon={v.ok ? 't-tick' : 't-info'}
          title={M.mealDay(v.mealTitle, v.dayLabel)}
          sub={v.advice ? <>{v.metric}<br />{v.advice}</> : v.metric}
          right={v.ok ? <St tone="ok">{M.fine}</St> : <St tone="warn">{M.low}</St>} />
      ))}
    </>
  )
}
