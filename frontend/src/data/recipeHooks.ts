import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { recipeApi } from '@/lib/recipeApi'
import { isMockMode } from '@/lib/mode'
import { recipes as mockRecipes, ingredients, pantryCategoryMeta } from './pantry'
import { pantrySources } from './pantrySources'
import { enrichLine, computeRecipeMacros } from './recipeMacros'
import { deriveNovaDominant } from './nova'
import type { Recipe, RecipeInput, RecipeIngredientLine } from './types'

const RECIPES_KEY = ['recipes'] as const
const PANTRY_KEY = ['pantry'] as const

/** Public shape preserved verbatim: only `recipes` is dual-mode; the rest is static/pantry config. */
export function useRecipes() {
  const mock = isMockMode()
  const { data: recipes = mockRecipes } = useQuery({
    queryKey: RECIPES_KEY,
    queryFn: mock ? async () => mockRecipes : recipeApi.list,
    initialData: mock ? mockRecipes : undefined, // synchronous first render in mock (parity/tests)
    // Mock mode is client-owned: useRecipeActions mutates the ['recipes'] cache via setQueryData,
    // so the query must never background-refetch and clobber those edits back to the seed.
    staleTime: mock ? Infinity : 0,
  })
  return {
    recipes,
    ingredients,                       // pantry source rows (for the picker)
    sources: pantrySources,            // static presentation config
    categoryMeta: pantryCategoryMeta,  // static presentation config
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
      ingredients.find(ing => ing.id === i.pantryItemId),
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
    novaDominant: deriveNovaDominant(lines, ingredients),
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
