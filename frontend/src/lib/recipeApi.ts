import { apiFetch } from '@/lib/api'
import type { components } from '@/lib/api.gen'
import type { Recipe, RecipeInput, RecipeIngredientLine } from '@/data/types'

type RecipeRequest = components['schemas']['RecipeRequest']
type RecipeResponse = components['schemas']['RecipeResponse']
type RecipeListResponse = components['schemas']['RecipeListResponse']

/** Editor input → contract request. pantryItemId passes straight through; category is a trusted
 *  form string cast to the contract type (mirrors pantryApi's category cast). */
export function toRequest(input: RecipeInput): RecipeRequest {
  return {
    name: input.name,
    slot: input.slot ?? null,
    category: input.category as RecipeRequest['category'],
    servings: input.servings,
    prepMins: input.prepMins ?? null,
    cookMins: input.cookMins ?? null,
    tags: input.tags,
    starred: input.starred,
    ingredients: input.ingredients.map(i => ({
      pantryItemId: i.pantryItemId,
      amount: i.amount,
      unit: i.unit,
      // note passes straight through (the contract field is `string | null`); a present
      // string is kept, an explicit null is preserved so the editor can clear a note.
      note: i.note ?? null,
    })),
  } satisfies RecipeRequest
}

/** Contract response → domain Recipe. Re-keys each line's pantryItemId → refId, carries the
 *  server-computed name + contribution, and casts enum-ish numbers (NovaGroup, mezoFit.score). */
export function fromResponse(r: RecipeResponse): Recipe {
  return {
    id: r.id,
    name: r.name,
    slot: r.slot ?? '',
    category: r.category as Recipe['category'],
    createdDate: r.createdDate,
    timesLogged: r.timesLogged,
    avgScore: r.avgScore,
    lastLogged: r.lastLogged,
    servings: r.servings,
    prepMins: r.prepMins ?? 0,
    cookMins: r.cookMins ?? 0,
    tags: r.tags,
    ingredients: r.ingredients.map(
      (l): RecipeIngredientLine => ({
        refId: l.pantryItemId,
        amount: l.amount,
        unit: l.unit,
        note: l.note ?? undefined,
        name: l.name,
        contribution: l.contribution,
      }),
    ),
    macros: r.macros,
    novaDominant: r.novaDominant as Recipe['novaDominant'],
    mezoFit: { score: r.mezoFit.score ?? null, fitsFor: r.mezoFit.fitsFor },
    starred: r.starred,
  }
}

export const recipeApi = {
  list: (): Promise<Recipe[]> =>
    apiFetch<RecipeListResponse>('/api/recipe').then(res => res.recipes.map(fromResponse)),
  get: (id: string): Promise<Recipe> =>
    apiFetch<RecipeResponse>(`/api/recipe/${id}`).then(fromResponse),
  create: (input: RecipeInput): Promise<void> =>
    apiFetch('/api/recipe', { method: 'POST', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  update: (id: string, input: RecipeInput): Promise<void> =>
    apiFetch(`/api/recipe/${id}`, { method: 'PUT', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  remove: (id: string): Promise<void> =>
    apiFetch(`/api/recipe/${id}`, { method: 'DELETE' }).then(() => undefined),
}
