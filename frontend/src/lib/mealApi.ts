import { apiFetch } from './api'
import type { components } from './api.gen'
import type { MealInput, MealInputItem, FuelMeal, MealItemLine, MacroSet } from '@/data/types'

type MealRequest = components['schemas']['MealRequest']
type MealItemRequest = components['schemas']['MealItemRequest']
type MealResponse = components['schemas']['MealResponse']
type MealItemResponse = components['schemas']['MealItemResponse']
type FuelDayResponse = components['schemas']['FuelDayResponse']

/** What the composed useFuelDay needs from the server (targets/consumed/meals). */
export interface FuelDayData {
  date: string
  targets: MacroSet
  consumed: MacroSet
  meals: FuelMeal[]
}

/** Editor input → contract request. The single `refId` is routed to recipeId | pantryItemId by
 *  source; the unused arm is sent as null so the server's exactly-one-of CHECK is satisfied. */
export function toRequest(input: MealInput): MealRequest {
  return {
    slot: input.slot,
    loggedAt: input.loggedAt ?? null,
    title: input.title ?? null,
    items: input.items.map((i: MealInputItem): MealItemRequest => ({
      source: i.source,
      recipeId: i.source === 'recipe' ? i.refId : null,
      pantryItemId: i.source === 'pantry' ? i.refId : null,
      amount: i.amount,
      unit: i.unit,
    })),
  } satisfies MealRequest
}

/** Contract response → domain FuelMeal. Re-keys each line's recipeId|pantryItemId → refId, lifts
 *  the macros rollup to flat kcal/p/c/f, and nulls the pending score (breakdown is NULL in v1). */
export function fromResponse(r: MealResponse): FuelMeal {
  return {
    id: r.id,
    slot: r.slot,
    title: r.title ?? '',
    score: r.score?.value ?? null,
    kcal: r.macros.kcal,
    p: r.macros.p,
    c: r.macros.c,
    f: r.macros.f,
    mealItems: r.items.map(
      (l: MealItemResponse): MealItemLine => ({
        source: l.source as MealItemLine['source'],
        refId: (l.source === 'recipe' ? l.recipeId : l.pantryItemId) ?? '',
        amount: l.amount,
        unit: l.unit,
        name: l.name,
        contribution: l.contribution,
        nova: l.nova ?? undefined,
      }),
    ),
    items: r.items.map(l => `${l.name} ${l.amount}${l.unit}`),
    tags: [],
    loggedAt: r.loggedAt,
    mealDate: r.mealDate,
  }
}

function fromDayResponse(d: FuelDayResponse): FuelDayData {
  return {
    date: d.date,
    targets: d.targets,
    consumed: d.consumed,
    meals: d.meals.map(fromResponse),
  }
}

export const mealApi = {
  getDay: (date: string): Promise<FuelDayData> =>
    apiFetch<FuelDayResponse>(`/api/fuel/day/${date}`).then(fromDayResponse),
  create: (input: MealInput): Promise<void> =>
    apiFetch('/api/meal', { method: 'POST', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  update: (id: string, input: MealInput): Promise<void> =>
    apiFetch(`/api/meal/${id}`, { method: 'PUT', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  remove: (id: string): Promise<void> =>
    apiFetch(`/api/meal/${id}`, { method: 'DELETE' }).then(() => undefined),
}
