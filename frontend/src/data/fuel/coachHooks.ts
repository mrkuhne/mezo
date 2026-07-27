import { coachApi, type MealCoachVerdict, type VerdictsByMeal } from '@/data/fuel/coachApi'
import { useDualQuery } from '@/data/useDualQuery'

/**
 * Meal-coach verdicts (mezo-mr4n) — the qualitative layer over the deterministic meal score.
 * Kept OUT of `useFuelDay` on purpose: the timeline must render its deterministic numbers
 * immediately, and the verdict lines flow in afterwards (the first day-view of a day may need an
 * LLM roundtrip). An absent verdict is a normal state, never an error state.
 */

const EMPTY: VerdictsByMeal = {}

/** Mock-mode canned prose — mock mode never reaches a backend, so the UI is still exercised. */
const MOCK_VERDICTS: VerdictsByMeal = {
  'meal-1': {
    mealId: 'meal-1',
    tagline: 'Remek pre-workout üzemanyag',
    summary: 'Gyors szénhidrát közvetlenül az edzés előtt — pont ezt kívánja a mai Pull nap. '
      + 'A fehérje alacsony, de erre most nem is volt szükség.',
    improve: [{ text: 'Tegyél mellé 20g fehérjét', impact: '+fehérje' }],
  },
}

/** A day's verdicts keyed by mealId. */
export function useMealCoach(date: string) {
  const { data, isPending } = useDualQuery<VerdictsByMeal>({
    queryKey: ['meal-coach', date],
    mockData: MOCK_VERDICTS,
    realFetch: () => coachApi.day(date),
    realEmpty: EMPTY,
    realStaleTime: 0,
  })
  return { verdicts: data, isPending }
}

/** One meal's verdict — generated on demand when the score sheet opens (any date). */
export function useMealCoachFor(mealId: string | null) {
  const { data, isPending } = useDualQuery<VerdictsByMeal>({
    queryKey: ['meal-coach', 'meal', mealId ?? 'none'],
    mockData: MOCK_VERDICTS,
    realFetch: () => (mealId ? coachApi.meal(mealId) : Promise.resolve(EMPTY)),
    realEmpty: EMPTY,
    realStaleTime: 0,
  })
  const verdict: MealCoachVerdict | null = mealId ? (data[mealId] ?? null) : null
  return { verdict, isPending: isPending && mealId !== null }
}
