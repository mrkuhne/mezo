import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pantryApi } from '@/lib/pantryApi'
import { isMockMode } from '@/lib/mode'
import { useDualQuery } from './useDualQuery'
import { ingredients as mockIngredients, pantryCategoryMeta, pantryImports, pantrySuggestions } from './pantry'
import { pantrySources } from './pantrySources'
import { supplementsStash } from './fuel'
import type { Ingredient, SupplementStashItem, PantryItemInput } from './types'

const PANTRY_KEY = ['pantry'] as const
const mockData = { ingredients: mockIngredients, stash: supplementsStash }
// Real-mode unresolved fallback — empty, NEVER the seed (the "no static fallback in
// real mode" invariant, enforced by useDualQuery). usePantryActions still seeds its
// mock cache from `mockData`; only the real-mode loading window changes.
const PANTRY_EMPTY: typeof mockData = { ingredients: [], stash: [] }

/** Keeps the exact pre-existing return shape — views/buildKamraItems are untouched. */
export function usePantry() {
  const mock = isMockMode()
  // staleTime Infinity in mock (client-owned cache: usePantryActions edits via setQueryData
  // must not be clobbered by a refetch); 0 in real mode (mutations invalidate → refetch truth).
  const { data, isPending } = useDualQuery({
    queryKey: PANTRY_KEY,
    mockData,
    realFetch: pantryApi.list,
    realEmpty: PANTRY_EMPTY,
    realStaleTime: 0,
  })
  return {
    ingredients: data.ingredients,
    stash: data.stash,
    sources: pantrySources,           // static presentation config
    categoryMeta: pantryCategoryMeta, // static presentation config
    imports: mock ? pantryImports : [],       // scrape feed deferred in real mode
    suggestions: mock ? pantrySuggestions : [], // suggestions deferred in real mode
    // Real-mode loading window only (mock seeds synchronously → always false);
    // views branch on it to show the skeleton (mirrors runningPending, mezo-f2z).
    pending: !mock && isPending,
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
      // Nutrition + commerce (mezo-1za9) — preserve so a mock-mode supplement shows macros/price too.
      source: input.source, per: input.per, unit: input.unit,
      macros: input.kcal != null
        ? { kcal: input.kcal, p: input.proteinG ?? 0, c: input.carbsG ?? 0, f: input.fatG ?? 0 }
        : undefined,
      price: input.price, priceUnit: input.priceUnit, pkg: input.pkg,
      micros: input.micros, nova: input.nova,
      fiberG: input.fiberG, sugarG: input.sugarG, saltG: input.saltG, saturatedFatG: input.saturatedFatG,
    }
    return { ...base, stash: [...base.stash, supp] }
  })
  return undefined
}
function mockUpdate(qc: ReturnType<typeof useQueryClient>, id: string, input: PantryItemInput) {
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    return {
      ingredients: base.ingredients.map(i => i.id === id ? applyIngredientUpdate(i, input) : i),
      stash: base.stash.map(s => s.id === id ? applyStashUpdate(s, input) : s),
    }
  })
  return undefined
}

// Apply a PantryItemInput onto an existing food ingredient, preserving any field
// the form did not carry (so a quick stock bump never wipes macros, and an edit
// keeps the original price/micros/nova).
function applyIngredientUpdate(i: Ingredient, input: PantryItemInput): Ingredient {
  return {
    ...i,
    name: input.name,
    brand: input.brand ?? i.brand,
    source: input.source ?? i.source,
    category: input.category ?? i.category,
    per: input.per ?? i.per,
    unit: input.unit ?? i.unit,
    macros: {
      kcal: input.kcal ?? i.macros.kcal,
      p: input.proteinG ?? i.macros.p,
      c: input.carbsG ?? i.macros.c,
      f: input.fatG ?? i.macros.f,
    },
    // Extended nutrition + price are editable from the full editor — apply when
    // carried so the detail page reflects the edit (preserve untouched values).
    fiberG: input.fiberG ?? i.fiberG,
    sugarG: input.sugarG ?? i.sugarG,
    saltG: input.saltG ?? i.saltG,
    saturatedFatG: input.saturatedFatG ?? i.saturatedFatG,
    price: input.price ?? i.price,
    priceUnit: input.priceUnit ?? i.priceUnit,
    pkg: input.pkg ?? i.pkg,
    stock: input.stockQty != null
      ? { qty: input.stockQty, unit: input.stockUnit ?? i.stock?.unit ?? i.unit, expires: input.stockExpires ?? i.stock?.expires ?? '' }
      : i.stock,
  }
}

function applyStashUpdate(s: SupplementStashItem, input: PantryItemInput): SupplementStashItem {
  return {
    ...s,
    name: input.name,
    brand: input.brand ?? s.brand,
    category: input.category ?? s.category,
    dose: input.dose ?? s.dose,
    form: input.form ?? s.form,
    protocol: input.protocol ?? s.protocol,
    stock: input.stockQty ?? s.stock,
    stockUnit: input.stockUnit ?? s.stockUnit,
    // Nutrition + commerce (mezo-1za9) — apply when carried, preserve untouched (mirror food).
    source: input.source ?? s.source,
    per: input.per ?? s.per,
    unit: input.unit ?? s.unit,
    macros: input.kcal != null || s.macros
      ? {
          kcal: input.kcal ?? s.macros?.kcal ?? 0,
          p: input.proteinG ?? s.macros?.p ?? 0,
          c: input.carbsG ?? s.macros?.c ?? 0,
          f: input.fatG ?? s.macros?.f ?? 0,
        }
      : undefined,
    fiberG: input.fiberG ?? s.fiberG,
    sugarG: input.sugarG ?? s.sugarG,
    saltG: input.saltG ?? s.saltG,
    saturatedFatG: input.saturatedFatG ?? s.saturatedFatG,
    price: input.price ?? s.price,
    priceUnit: input.priceUnit ?? s.priceUnit,
    pkg: input.pkg ?? s.pkg,
  }
}
function mockRemove(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    return { ingredients: base.ingredients.filter(i => i.id !== id), stash: base.stash.filter(s => s.id !== id) }
  })
  return undefined
}
