import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

type MealCoachResponse = components['schemas']['MealCoachResponse']

/** One meal's qualitative verdict (mezo-mr4n) — prose only; every number stays in the breakdown. */
export interface MealCoachVerdict {
  mealId: string
  tagline: string | null
  summary: string | null
  improve: { text: string; impact: string }[]
  /**
   * „Legközelebb így lesz laposabb" (owner, 2026-09-26): 0-2 AI-written swaps naming the plate's
   * own items, from the SAME coach call. `null` = not generated (the glucose box shows its own
   * computed swaps); `[]` = the model judged the plate already smooth.
   */
  glucoseTips: { title: string; body: string }[] | null
}

/** Verdicts keyed by mealId — the timeline looks up one card's line in O(1). */
export type VerdictsByMeal = Record<string, MealCoachVerdict>

function fromResponse(res: MealCoachResponse): VerdictsByMeal {
  const out: VerdictsByMeal = {}
  for (const v of res.verdicts) {
    out[v.mealId] = {
      mealId: v.mealId,
      tagline: v.tagline ?? null,
      summary: v.summary ?? null,
      improve: v.improve.map(i => ({ text: i.text, impact: i.impact })),
      glucoseTips: v.glucoseTips ? v.glucoseTips.map(g => ({ title: g.title, body: g.body })) : null,
    }
  }
  return out
}

export const coachApi = {
  /** A day's verdicts; the backend generates only for today and serves cache for older days. */
  day: (date: string): Promise<VerdictsByMeal> =>
    apiFetch<MealCoachResponse>(`/api/meal/coach?date=${date}`).then(fromResponse),
  /** One meal's verdict — an explicit score-sheet open, so it generates on any date. */
  meal: (id: string): Promise<VerdictsByMeal> =>
    apiFetch<MealCoachResponse>(`/api/meal/${id}/coach`).then(fromResponse),
}
