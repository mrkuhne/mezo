import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pantryApi } from '@/lib/pantryApi'
import { isMockMode } from '@/lib/mode'
import { ingredients as mockIngredients, pantryCategoryMeta, pantryImports, pantrySuggestions } from './pantry'
import { pantrySources } from './pantrySources'
import { supplementsStash } from './fuel'
import type { Ingredient, SupplementStashItem, PantryItemInput } from './types'

const PANTRY_KEY = ['pantry'] as const
const mockData = { ingredients: mockIngredients, stash: supplementsStash }

/** Keeps the exact pre-existing return shape — views/buildKamraItems are untouched. */
export function usePantry() {
  const mock = isMockMode()
  const { data = mockData } = useQuery({
    queryKey: PANTRY_KEY,
    queryFn: mock ? async () => mockData : pantryApi.list,
    initialData: mock ? mockData : undefined, // synchronous first render in mock (parity/tests)
    // Mock mode is client-owned: usePantryActions mutates the ['pantry'] cache via
    // setQueryData, so the query must never background-refetch and clobber those
    // local edits back to the static seed. Real mode keeps the default freshness
    // (mutations invalidate → refetch from the backend, the server's truth).
    staleTime: mock ? Infinity : 0,
  })
  return {
    ingredients: data.ingredients,
    stash: data.stash,
    sources: pantrySources,           // static presentation config
    categoryMeta: pantryCategoryMeta, // static presentation config
    imports: mock ? pantryImports : [],       // scrape feed deferred in real mode
    suggestions: mock ? pantrySuggestions : [], // suggestions deferred in real mode
  }
}

/** Create/update/delete mutations on the ['pantry'] cache (useWeight dual-mode pattern). */
export function usePantryActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidate = () => qc.invalidateQueries({ queryKey: PANTRY_KEY })

  const add = useMutation({
    mutationFn: mock
      ? async (input: PantryItemInput) => mockAdd(qc, input)
      : (input: PantryItemInput) => pantryApi.create(input),
    onSuccess: mock ? undefined : invalidate,
  })
  const update = useMutation({
    mutationFn: mock
      ? async (v: { id: string; input: PantryItemInput }) => mockUpdate(qc, v.id, v.input)
      : (v: { id: string; input: PantryItemInput }) => pantryApi.update(v.id, v.input),
    onSuccess: mock ? undefined : invalidate,
  })
  const remove = useMutation({
    mutationFn: mock
      ? async (id: string) => mockRemove(qc, id)
      : (id: string) => pantryApi.remove(id),
    onSuccess: mock ? undefined : invalidate,
  })

  const addItem = useCallback((input: PantryItemInput) => add.mutate(input), [add])
  const updateItem = useCallback((id: string, input: PantryItemInput) => update.mutate({ id, input }), [update])
  const deleteItem = useCallback((id: string) => remove.mutate(id), [remove])
  return { addItem, updateItem, deleteItem }
}

// --- mock-mode cache mutators: keep the offline app interactive ---
type PantryCache = { ingredients: Ingredient[]; stash: SupplementStashItem[] }
function mockAdd(qc: ReturnType<typeof useQueryClient>, input: PantryItemInput) {
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    const id = crypto.randomUUID()
    if (input.kind === 'food') {
      const ing: Ingredient = {
        id, name: input.name, brand: input.brand ?? '', source: input.source ?? 'manual',
        category: input.category ?? 'protein', per: input.per ?? 100, unit: input.unit ?? 'g',
        macros: { kcal: input.kcal ?? 0, p: input.proteinG ?? 0, c: input.carbsG ?? 0, f: input.fatG ?? 0 },
        price: input.price ?? 0, priceUnit: input.priceUnit ?? '', pkg: input.pkg ?? '',
        micros: input.micros ?? [], nova: input.nova ?? 1,
        stock: input.stockQty != null ? { qty: input.stockQty, unit: input.stockUnit ?? 'g', expires: input.stockExpires ?? '' } : null,
        lastUsed: '—', usedInRecipes: 0,
      }
      return { ...base, ingredients: [...base.ingredients, ing] }
    }
    const supp: SupplementStashItem = {
      id, name: input.name, brand: input.brand ?? '',
      type: input.kind === 'stim' ? 'stimulant' : input.kind === 'med' ? 'medication' : 'supplement',
      category: input.category ?? 'muscle', dose: input.dose ?? '', form: input.form ?? '',
      stock: input.stockQty ?? null, stockUnit: input.stockUnit ?? null,
      protocol: input.protocol ?? '', timing: input.timing ?? 'flexible', taken: false, caffeine: input.caffeine,
    }
    return { ...base, stash: [...base.stash, supp] }
  })
  return undefined
}
function mockUpdate(qc: ReturnType<typeof useQueryClient>, id: string, input: PantryItemInput) {
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    return {
      ingredients: base.ingredients.map(i => i.id === id ? { ...i, name: input.name, brand: input.brand ?? i.brand } : i),
      stash: base.stash.map(s => s.id === id ? { ...s, name: input.name, brand: input.brand ?? s.brand } : s),
    }
  })
  return undefined
}
function mockRemove(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    return { ingredients: base.ingredients.filter(i => i.id !== id), stash: base.stash.filter(s => s.id !== id) }
  })
  return undefined
}
