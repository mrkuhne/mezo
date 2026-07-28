import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { recipeApi, type RecipeBreakdownData } from '@/data/fuel/recipeApi'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { recipes as mockRecipes, ingredients, pantryCategoryMeta } from '@/data/fuel/pantry'
import { supplementsStash } from '@/data/fuel/fuel'
import { pantrySources } from '@/data/pantrySources'
import { buildPickables } from '@/data/fuel/pantryPickables'
import { enrichLine, computeRecipeMacros } from '@/data/fuel/recipeMacros'
import { deriveNovaDominant } from '@/data/nova'
import { PANTRY_KEY, RECIPES_KEY, RECIPE_BREAKDOWN_KEY } from '@/data/fuel/queryKeys'
import type { Recipe, RecipeInput, RecipeIngredientLine } from '@/data/types'

// Recipe lines resolve against the SAME merged pantry the picker offers (foods +
// supplement/stim/med stash, mezo-3vu4) — a saved supplement line must enrich its
// name + contribution, not fall back to the raw id. Static seeds → module-level.
const mockPantryPool = buildPickables(ingredients, supplementsStash)

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


/** Template breakdown for the detail page (mezo-bw3y). Mock = the seed's templateBreakdown +
 *  mezoFit.fitsFor, synchronous via initialData; real = the lazily materializing
 *  GET /api/recipe/{id}/breakdown (the FIRST call may take LLM seconds — `pending` drives the
 *  detail page's „Mezo értékeli…" card; no mock fallback in real mode).
 *  `refreshing` is the SECOND-and-later generate (mezo-uavr): a RECIPE WRITE invalidated THIS
 *  recipe's key (`useRecipeActions` — a recipe edit and a role change are both such an edit), so
 *  `data` is still the pre-edit envelope while the new one materializes and the page renders
 *  „Mezo újraértékeli…" instead of passing a stale reading off as current. It is deliberately
 *  NOT every background fetch: a plain revalidation returns the SAME envelope — nor a write to a
 *  DIFFERENT recipe, which never touches this key. The third server-side regeneration cause —
 *  a pantry edit moving the deterministic numbers past `RecipeBreakdownService.matches` — reaches
 *  this key too since mezo-b9gv, but only for the recipes that actually USE the edited item and
 *  only when a fact the scorer reads live changed (`usePantryActions`, `pantryImpact`). */
export function useRecipeBreakdown(recipeId: string): {
  breakdown: RecipeBreakdownData['breakdown']
  fitsFor: string[]
  pending: boolean
  refreshing: boolean
} {
  const mock = isMockMode()
  const qc = useQueryClient()
  const seed = (): RecipeBreakdownData => {
    const r = mockRecipes.find(x => x.id === recipeId)
    return { breakdown: r?.templateBreakdown ?? null, fitsFor: r?.mezoFit.fitsFor ?? [] }
  }
  const { data, isPending, isFetching } = useQuery({
    queryKey: RECIPE_BREAKDOWN_KEY(recipeId),
    queryFn: mock ? async () => seed() : () => recipeApi.getBreakdown(recipeId),
    initialData: mock ? seed() : undefined,
    // real: the backend caches the enriched envelope; a session-long staleTime avoids re-firing
    // the (potentially LLM-priced) GET on every remount, the write-path invalidation covers edits
    staleTime: mock ? Infinity : 5 * 60_000,
    // …and for the same reason a mere window refocus must not re-fire it either: nothing changed,
    // the server would hand back the same jsonb. Writes invalidate (and an invalidated query still
    // refetches on the next mount), so no regeneration can be missed by turning this off.
    refetchOnWindowFocus: false,
    enabled: recipeId !== '',
  })
  // Only a WRITE-driven regeneration may claim „újraértékeli": a recipe edit and a role change
  // both arrive here as an INVALIDATION of this key (`useRecipeActions`). A plain revalidation
  // (staleTime expiry on remount) refetches the SAME envelope — announcing a re-evaluation there
  // would be a false claim plus a layout jump, the very dishonesty this flag exists to remove.
  // `isInvalidated` is set by invalidateQueries and stays true for the whole ensuing refetch;
  // the success dispatch clears it exactly when the fresh envelope lands (mezo-uavr).
  const invalidated = qc.getQueryState(RECIPE_BREAKDOWN_KEY(recipeId))?.isInvalidated === true
  return {
    breakdown: data?.breakdown ?? null,
    fitsFor: data?.fitsFor ?? [],
    pending: !mock && isPending,
    // A background regeneration: data is still the PRE-edit envelope, so the page must not
    // render it as current (mezo-uavr).
    refreshing: !mock && isFetching && !isPending && invalidated,
  }
}

/** Create/update/delete on the ['recipes'] cache. Real writes invalidate ['recipes'] AND ['pantry'];
 *  the breakdown cache is touched PER RECIPE ONLY (see below). */
export function useRecipeActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidateLists = () => {
    qc.invalidateQueries({ queryKey: RECIPES_KEY })
    qc.invalidateQueries({ queryKey: PANTRY_KEY }) // recipe writes shift pantry usedInRecipes
  }

  const createM = useMutation({
    mutationFn: mock
      ? async (input: RecipeInput) => mockCreate(qc, input)
      : (input: RecipeInput) => recipeApi.create(input),
    // no breakdown key to touch: a server-generated id has no cached envelope yet, and its first
    // detail visit is a cold fetch („Mezo értékeli…"), not a re-evaluation.
    onSuccess: mock ? undefined : invalidateLists,
  })
  const updateM = useMutation({
    mutationFn: mock
      ? async (v: { id: string; input: RecipeInput }) => mockUpdate(qc, v.id, v.input)
      : (v: { id: string; input: RecipeInput }) => recipeApi.update(v.id, v.input),
    // Only THIS recipe's envelope was nulled server-side (mezo-bw3y), so only THIS key may be
    // invalidated: the whole-prefix invalidation used to make every other cached recipe render
    // „Mezo újraértékeli…" over a reading that was never re-evaluated (mezo-uavr).
    onSuccess: mock ? undefined : (_res: void, v: { id: string; input: RecipeInput }) => {
      invalidateLists()
      qc.invalidateQueries({ queryKey: RECIPE_BREAKDOWN_KEY(v.id) })
    },
  })
  const removeM = useMutation({
    mutationFn: mock
      ? async (id: string) => mockRemove(qc, id)
      : (id: string) => recipeApi.remove(id),
    // Deleted, not re-evaluated: DROP the entry rather than invalidate it — an invalidation would
    // refetch a resource that is gone (404) and leave a stale envelope in the cache meanwhile.
    onSuccess: mock ? undefined : (_res: void, id: string) => {
      invalidateLists()
      qc.removeQueries({ queryKey: RECIPE_BREAKDOWN_KEY(id) })
    },
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
    role: input.role,
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
