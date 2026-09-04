import { useFuelDay, useRecipes, useStackDay } from '@/data/hooks'
import { StackMealMatch } from '@/features/fuel/components/StackMealMatch'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import { matchMealsToStack } from '@/features/fuel/logic/matchMealsToStack'
import { addDays, localDateString } from '@/shared/lib/dates'

export function FuelStackMealsPage() {
  const { slots } = useStackDay()
  const { recipes } = useRecipes()
  const today = localDateString()
  const { fuel: todayFuel } = useFuelDay(today)
  const { fuel: yesterdayFuel } = useFuelDay(addDays(today, -1))
  const result = matchMealsToStack(slots, recipes, todayFuel.meals, yesterdayFuel.meals)
  const count = result.suggestions.length + result.verdicts.length

  return (
    <StackPageScaffold
      tone="coral" backTo="/fuel/stack" backLabel="‹ Stack" icon="i-recept"
      name="Étkezéshez" big={`${count} kapcsolat`} sub="a stack és az étkezéseid között"
    >
      {count > 0 ? <StackMealMatch result={result} className="rise" /> : (
        <div className="stk-meals-empty rise">
          <strong>Nincs még étkezési kapcsolat</strong>
          <p>Ha egy tétel zsíros vagy fehérjés étkezést kér, itt jelenik meg a hozzá illő fogás és visszajelzés.</p>
        </div>
      )}
    </StackPageScaffold>
  )
}
