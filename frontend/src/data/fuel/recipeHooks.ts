import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recipeApi } from '@/data/fuel/recipeApi'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { recipes as mockRecipes, ingredients, pantryCategoryMeta } from '@/data/fuel/pantry'
import { supplementsStash } from '@/data/fuel/fuel'
import { pantrySources } from '@/data/pantrySources'
import { buildPickables } from '@/data/fuel/pantryPickables'
import { enrichLine, computeRecipeMacros } from '@/data/fuel/recipeMacros'
import { deriveNovaDominant } from '@/data/nova'
import type { Recipe, RecipeInput, RecipeIngredientLine } from '@/data/types'

// Recipe lines resolve against the SAME merged pantry the picker offers (foods +
// supplement/stim/med stash, mezo-3vu4) — a saved supplement line must enrich its
// name + contribution, not fall back to the raw id. Static seeds → module-level.
const mockPantryPool = buildPickables(ingredients, supplementsStash)

const RECIPES_KEY = ['recipes'] as const
const PANTRY_KEY = ['pantry'] as const
// Real-mode unresolved fallback — empty, NEVER the 6 mock recipes (the "no static
// fallback in real mode" invariant). Mock-cache mutators still seed from `mockRecipes`.
const RECIPES_EMPTY: Recipe[] = []

/** Public shape preserved verbatim: only `recipes` is dual-mode; the rest is static/pantry config. */
export function useRecipes() {
  const mock = isMockMode()
  // mock: synchronous seed via initialData + staleTime Infinity (client-owned cache,
  // useRecipeActions edits via setQueryData); real: backend list, empty until it resolves.
  const { data: recipes, isPending } = useDualQuery({
    queryKey: RECIPES_KEY,
    mockData: mockRecipes,
    realFetch: recipeApi.list,
    realEmpty: RECIPES_EMPTY,
    realStaleTime: 0,
  })
  return {
    // NOTE: no `ingredients` here on purpose — the picker and both recipe views
    // resolve live ingredient metadata from usePantry() (dual-mode). Exposing the
    // static mock-seed `ingredients` from this hook was a real-mode footgun that
    // rendered UUIDs + zero macros against backend pantry IDs (mezo-yew).
    recipes,
    sources: pantrySources,            // static presentation config
    categoryMeta: pantryCategoryMeta,  // static presentation config
    // Real-mode loading window only (mock seeds synchronously → always false);
    // FuelRecipesPage branches on it to show the skeleton (mezo-f2z).
    pending: !mock && isPending,
  }
}

/** Create/update/delete on the ['recipes'] cache. Real writes invalidate ['recipes'] AND ['pantry']. */
export function useRecipeActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: RECIPES_KEY })
    qc.invalidateQueries({ queryKey: PANTRY_KEY }) // recipe writes shift pantry usedInRecipes
  }

  const createM = useMutation({
    mutationFn: mock
      ? async (input: RecipeInput) => mockCreate(qc, input)
      : (input: RecipeInput) => recipeApi.create(input),
    onSuccess: mock ? undefined : invalidate,
  })
  const updateM = useMutation({
    mutationFn: mock
      ? async (v: { id: string; input: RecipeInput }) => mockUpdate(qc, v.id, v.input)
      : (v: { id: string; input: RecipeInput }) => recipeApi.update(v.id, v.input),
    onSuccess: mock ? undefined : invalidate,
  })
  const removeM = useMutation({
    mutationFn: mock
      ? async (id: string) => mockRemove(qc, id)
      : (id: string) => recipeApi.remove(id),
    onSuccess: mock ? undefined : invalidate,
  })

  const create = useCallback((input: RecipeInput) => createM.mutate(input), [createM])
  const update = useCallback((id: string, input: RecipeInput) => updateM.mutate({ id, input }), [updateM])
  const remove = useCallback((id: string) => removeM.mutate(id), [removeM])
  return { create, update, remove }
}

// --- mock-mode cache mutators: keep the offline app interactive. The contribution + macro
// computation uses the SAME shared formula (recipeMacros) as the backend, so mock writes are
// byte-identical to what the API would return. ---
function buildRecipe(id: string, input: RecipeInput, base?: Recipe): Recipe {
  const lines: RecipeIngredientLine[] = input.ingredients.map(i =>
    enrichLine(
      { refId: i.pantryItemId, amount: i.amount, unit: i.unit, note: i.note ?? undefined },
      mockPantryPool.find(ing => ing.id === i.pantryItemId),
    ),
  )
  const macros = computeRecipeMacros(lines)
  return {
    id,
    name: input.name,
    slot: input.slot ?? '',
    category: input.category,
    createdDate: base?.createdDate ?? 'Ma',
    timesLogged: base?.timesLogged ?? 0,
    avgScore: base?.avgScore ?? 0,
    lastLogged: base?.lastLogged ?? '—',
    servings: input.servings,
    prepMins: input.prepMins ?? 0,
    cookMins: input.cookMins ?? 0,
    tags: input.tags,
    ingredients: lines,
    macros,
    novaDominant: deriveNovaDominant(lines, mockPantryPool),
    mezoFit: base?.mezoFit ?? { score: null, fitsFor: [] },
    starred: input.starred,
    recentLogs: base?.recentLogs ?? [],
    templateBreakdown: base?.templateBreakdown,
  }
}
function mockCreate(qc: ReturnType<typeof useQueryClient>, input: RecipeInput) {
  qc.setQueryData<Recipe[]>(RECIPES_KEY, prev => [...(prev ?? mockRecipes), buildRecipe(crypto.randomUUID(), input)])
  return undefined
}
function mockUpdate(qc: ReturnType<typeof useQueryClient>, id: string, input: RecipeInput) {
  qc.setQueryData<Recipe[]>(RECIPES_KEY, prev =>
    (prev ?? mockRecipes).map(r => (r.id === id ? buildRecipe(id, input, r) : r)),
  )
  return undefined
}
function mockRemove(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.setQueryData<Recipe[]>(RECIPES_KEY, prev => (prev ?? mockRecipes).filter(r => r.id !== id))
  return undefined
}
