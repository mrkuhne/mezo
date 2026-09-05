import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pantryApi, type PantryData } from '@/data/fuel/pantryApi'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { ingredients as mockIngredients, pantryCategoryMeta, pantryImports, pantrySuggestions, MOCK_SCRAPE_DRAFT, MOCK_PHOTO_DRAFT, pantryCatalogFixture } from '@/data/fuel/pantry'
import { pantrySources, type PantrySourceKey } from '@/data/pantrySources'
import { supplementsStash } from '@/data/fuel/fuel'
import { PANTRY_KEY, RECIPES_KEY, RECIPE_BREAKDOWN_KEY } from '@/data/fuel/queryKeys'
import { movesRecipeScores, recipesUsingPantryItem, type ScoredPantryFacts } from '@/data/fuel/pantryImpact'
import type { Ingredient, Recipe, SupplementStashItem, PantryItemInput, PantryImport, PantryImportInput, PantryScrapeDraft, PantryCatalogEntry } from '@/data/types'

// P6 (mezo-bka): imports + suggestions ride the same PantryResponse — one query, no extra key.
const mockData: PantryData = {
  ingredients: mockIngredients, stash: supplementsStash,
  imports: pantryImports, suggestions: pantrySuggestions,
}
// Real-mode unresolved fallback — empty, NEVER the seed (the "no static fallback in
// real mode" invariant, enforced by useDualQuery). usePantryActions still seeds its
// mock cache from `mockData`; only the real-mode loading window changes.
const PANTRY_EMPTY: PantryData = { ingredients: [], stash: [], imports: [], suggestions: [] }

/** Keeps the exact pre-existing return shape — views/buildKamraItems are untouched. */
export function usePantry() {
  const mock = isMockMode()
  // staleTime Infinity in mock (client-owned cache: usePantryActions edits via setQueryData
  // must not be clobbered by a refetch); 0 in real mode (mutations invalidate → refetch truth).
  const { data, isPending, isError } = useDualQuery({
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
    imports: data.imports,       // REAL dual-mode since P6 (mezo-bka) — was mock-only
    suggestions: data.suggestions, // REAL dual-mode since P6 (mezo-bka) — was mock-only
    // Real-mode loading window only (mock seeds synchronously → always false);
    // views branch on it to show the skeleton (mirrors runningPending, mezo-f2z).
    pending: !mock && isPending,
    // Terminal real-mode fetch failure — realEmpty is NOT real data then. The notification
    // snapshot writer gates on it via useStack (mezo-b6q0); mock never errors.
    error: !mock && isError,
  }
}

/** Create/update/delete mutations on the ['pantry'] cache (useWeight dual-mode pattern). */
export function usePantryActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidate = () => qc.invalidateQueries({ queryKey: PANTRY_KEY })

  /** The item as the cache still holds it — the pre-write state the impact check compares against. */
  const scoredFactsOf = (id: string): ScoredPantryFacts | undefined => {
    const cached = qc.getQueryData<PantryData>(PANTRY_KEY)
    return cached?.ingredients.find(i => i.id === id) ?? cached?.stash.find(s => s.id === id)
  }

  /**
   * A pantry write also moves the recipes that USE the item (mezo-b9gv): the backend recomputes
   * every recipe's fit on read and regenerates the prose once the numbers drift, so leaving the
   * recipe caches alone served a pre-edit badge and swapped the new prose in silently.
   * Scoped twice over, to keep the „Mezo újraértékeli…" banner honest (mezo-uavr): only the
   * recipes that reference this item, and only when a fact the scorer reads LIVE actually
   * changed — a recipe's macros are frozen in its line snapshots, so a price or even a kcal edit
   * moves nothing.
   */
  const invalidateRecipeCaches = (pantryItemId: string) => {
    const affected = recipesUsingPantryItem(qc.getQueryData<Recipe[]>(RECIPES_KEY) ?? [], pantryItemId)
    if (affected.length === 0) {
      return // nothing cached references this item — no fit and no envelope can have moved
    }
    qc.invalidateQueries({ queryKey: RECIPES_KEY }) // the fit badges are recomputed on that read
    for (const recipeId of affected) {
      qc.invalidateQueries({ queryKey: RECIPE_BREAKDOWN_KEY(recipeId) })
    }
  }

  const add = useMutation({
    mutationFn: mock
      ? async (input: PantryItemInput) => mockAdd(qc, input)
      : (input: PantryItemInput) => pantryApi.create(input),
    // a brand-new item cannot be referenced by an existing recipe yet — pantry only
    onSuccess: mock ? undefined : invalidate,
  })
  const update = useMutation({
    mutationFn: mock
      ? async (v: { id: string; input: PantryItemInput }) => mockUpdate(qc, v.id, v.input)
      : (v: { id: string; input: PantryItemInput }) => pantryApi.update(v.id, v.input),
    onSuccess: mock ? undefined : (_res: void, v: { id: string; input: PantryItemInput }) => {
      // read the pre-write facts BEFORE invalidating, so the comparison can't race the refetch
      const moved = movesRecipeScores(scoredFactsOf(v.id), v.input)
      invalidate()
      if (moved) {
        invalidateRecipeCaches(v.id)
      }
    },
  })
  const remove = useMutation({
    mutationFn: mock
      ? async (id: string) => mockRemove(qc, id)
      : (id: string) => pantryApi.remove(id),
    // a deleted source drops its NOVA + nutrition facts out of every line that referenced it
    // (the backend degrades those dimensions honestly), so the referencing recipes always move
    onSuccess: mock ? undefined : (_res: void, id: string) => {
      invalidate()
      invalidateRecipeCaches(id)
    },
  })

  // P6 (mezo-bka): confirmed-draft import — mutateAsync so ImportItemSheet can await + close.
  const importMut = useMutation({
    mutationFn: mock
      ? async (input: PantryImportInput) => mockImport(qc, input)
      : (input: PantryImportInput) => pantryApi.importItem(input),
    onSuccess: mock ? undefined : invalidate,
  })

  const addItem = useCallback((input: PantryItemInput) => add.mutate(input), [add])
  const updateItem = useCallback((id: string, input: PantryItemInput) => update.mutate({ id, input }), [update])
  const deleteItem = useCallback((id: string) => remove.mutate(id), [remove])
  const importItem = useCallback((input: PantryImportInput) => importMut.mutateAsync(input), [importMut])
  // URL scrape (P8, mezo-8vum) — an ephemeral read (no cache);
  // mock mode serves the canned draft after a demo delay.
  const scrapeItem = useCallback(
    (url: string): Promise<PantryScrapeDraft | null> =>
      mock
        ? new Promise(resolve => setTimeout(() => resolve(MOCK_SCRAPE_DRAFT), 600))
        : pantryApi.scrape(url),
    [mock],
  )
  // Photo import (mezo-d8tr) — ephemeral read like scrapeItem; mock serves the canned draft.
  const photoExtract = useCallback(
    (photo: File, photo2?: File): Promise<PantryScrapeDraft | null> =>
      mock
        ? new Promise(resolve => setTimeout(() => resolve(MOCK_PHOTO_DRAFT), 600))
        : pantryApi.photoExtract(photo, photo2),
    [mock],
  )
  // S4 (mezo-qw37.4): shared catalog. Search is ephemeral (no cache); mock filters the fixture.
  const searchCatalog = useCallback(
    (q: string, kind?: string): Promise<PantryCatalogEntry[]> => {
      if (!mock) return pantryApi.searchCatalog(q, kind)
      const needle = q.trim().toLowerCase()
      return new Promise(resolve => setTimeout(() => resolve(
        pantryCatalogFixture.filter(e =>
          (!kind || e.kind === kind)
          && (!needle || e.name.toLowerCase().includes(needle) || (e.brand ?? '').toLowerCase().includes(needle))),
      ), 200))
    },
    [mock],
  )
  const fromCatalogMut = useMutation({
    mutationFn: mock
      ? async (catalogId: string) => mockAddFromCatalog(qc, catalogId)
      : (catalogId: string) => pantryApi.addFromCatalog(catalogId),
    onSuccess: mock ? undefined : invalidate,
  })
  const addFromCatalog = useCallback((catalogId: string) => fromCatalogMut.mutateAsync(catalogId), [fromCatalogMut])

  return { addItem, updateItem, deleteItem, importItem, scrapeItem, photoExtract, searchCatalog, addFromCatalog }
}

// --- mock-mode cache mutators: keep the offline app interactive ---
type PantryCache = PantryData

// Mirrors the real backend's source derivation (PantryImportService.importItem): a photo-confirmed
// draft carries the origin marker -> 'photo'; a Link-mode draft carries the scrape sourceUrl -> the
// backend maps the URL host to a source, defaulting to 'web' for an unrecognised host (mirrored here
// with the generic 'web', since the mock has no host table to consult); the OFF-lookup mode that used
// to fall through to 'openfoodfacts' was retired from the FE (mezo-ymt4, 2026-09-02) — no live FE path
// leaves both origin and sourceUrl empty, so 'manual' below is an unreached, honest-default fallback.
function sourceFor(input: PantryImportInput): PantrySourceKey {
  return input.origin === 'photo' ? 'photo' : input.sourceUrl ? 'web' : 'manual'
}

/** Mock import: append the draft as a food ingredient + prepend an imports-feed row. */
function mockImport(qc: ReturnType<typeof useQueryClient>, input: PantryImportInput) {
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    const source = sourceFor(input)
    const ing: Ingredient = {
      id: crypto.randomUUID(), kind: 'food', name: input.name, brand: input.brand ?? null, source,
      category: input.category ?? null, per: input.per, unit: input.unit,
      // Honest since mezo-6omv: a field the draft didn't carry is `null` (no data), not a
      // fabricated 0 — mirrors the server's mapper. Same honesty now applies to
      // price/priceUnit/pkg (mezo-xaq5): Ingredient declares them nullable, so a draft that
      // never priced the item stays null, not a fabricated free/empty-package 0/''. A Link-mode
      // scrape draft DOES carry priceHuf/priceUnit — those still ride through; `pkg` has no
      // import-draft source, so it is always null here.
      macros: { kcal: input.kcal ?? null, p: input.proteinG ?? null, c: input.carbsG ?? null, f: input.fatG ?? null },
      price: input.priceHuf ?? null, priceUnit: input.priceUnit ?? null, pkg: null,
      micros: [], nova: input.nova ?? 1,
      fiberG: input.fiberG ?? undefined, sugarG: input.sugarG ?? undefined,
      saltG: input.saltG ?? undefined, saturatedFatG: input.saturatedFatG ?? undefined,
      stock: null, lastUsed: '—', usedInRecipes: 0,
    }
    const feed: PantryImport = {
      id: crypto.randomUUID(), source, when: 'ma',
      items: 1, status: 'synced', ofWhat: input.name,
    }
    return { ...base, ingredients: [...base.ingredients, ing], imports: [feed, ...base.imports] }
  })
  return undefined
}
/** Mock from-catalog: idempotent append of the fixture entry as an ingredient (food) or stash row, marked shared. */
function mockAddFromCatalog(qc: ReturnType<typeof useQueryClient>, catalogId: string) {
  const entry = pantryCatalogFixture.find(e => e.id === catalogId)
  if (!entry) return undefined
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    const already = base.ingredients.some(i => i.catalogId === catalogId) || base.stash.some(s => s.catalogId === catalogId)
    if (already) return base
    // catalogEditable mirrors the SERVER's rule (PantryCatalogService.editable): the OWNER edits any
    // definition, and the mock's demo account IS the owner — so a from-catalog row is editable here,
    // exactly as the real API reports it. Stamping `false` made mock mode show every shared row as
    // locked while real mode showed it unlocked (mezo-qw37.4 final review, M-5). `sharedFrom` still
    // names the other author, so the "shared" provenance is unchanged.
    const shared = { catalogId, sharedFrom: entry.authorName ? { authorName: entry.authorName } : null, catalogEditable: true }
    if (entry.kind === 'food') {
      const ing: Ingredient = {
        id: crypto.randomUUID(), kind: 'food', name: entry.name, brand: entry.brand ?? null, source: entry.source,
        category: entry.category ?? null, per: entry.per ?? 100, unit: entry.unit ?? 'g',
        // Honest since mezo-6omv: mirrors the server — a fact the catalog entry lacks is null.
        // Same honesty for price/priceUnit/pkg (mezo-xaq5): the catalog entry carries no price
        // fact at all (it's a personal, not a shared, fact), so a from-catalog add is always null.
        macros: { kcal: entry.kcal ?? null, p: entry.proteinG ?? null, c: entry.carbsG ?? null, f: entry.fatG ?? null },
        price: null, priceUnit: null, pkg: null, micros: [], nova: entry.nova ?? 1,
        fiberG: entry.fiberG ?? undefined, sugarG: entry.sugarG ?? undefined,
        saltG: entry.saltG ?? undefined, saturatedFatG: entry.saturatedFatG ?? undefined,
        stock: null, lastUsed: '—', usedInRecipes: 0, ...shared,
      }
      return { ...base, ingredients: [...base.ingredients, ing] }
    }
    const supp: SupplementStashItem = {
      id: crypto.randomUUID(), name: entry.name, brand: entry.brand ?? null,
      type: entry.kind === 'stim' ? 'stimulant' : entry.kind === 'med' ? 'medication' : 'supplement',
      category: entry.category ?? null, dose: '', form: entry.form ?? null,
      stock: null, stockUnit: null, protocol: '', timing: 'flexible', taken: false, caffeine: entry.caffeine ?? undefined,
      source: entry.source, per: entry.per ?? undefined, unit: entry.unit ?? undefined,
      macros: entry.kcal != null
        ? { kcal: entry.kcal, p: entry.proteinG ?? null, c: entry.carbsG ?? null, f: entry.fatG ?? null }
        : { kcal: null, p: null, c: null, f: null },
      nova: entry.nova ?? undefined, ...shared,
    }
    return { ...base, stash: [...base.stash, supp] }
  })
  return undefined
}

function mockAdd(qc: ReturnType<typeof useQueryClient>, input: PantryItemInput) {
  qc.setQueryData<PantryCache>(PANTRY_KEY, prev => {
    const base = prev ?? mockData
    const id = crypto.randomUUID()
    if (input.kind === 'food') {
      const ing: Ingredient = {
        id, kind: 'food', name: input.name, brand: input.brand ?? null, source: input.source ?? 'manual',
        category: input.category ?? null, per: input.per ?? 100, unit: input.unit ?? 'g',
        // Honest since mezo-6omv: mirrors the server — a field the form didn't carry is null.
        // Same honesty for price/priceUnit/pkg (mezo-xaq5): an item created without a price
        // stays null, not a fabricated free/0 fact.
        macros: { kcal: input.kcal ?? null, p: input.proteinG ?? null, c: input.carbsG ?? null, f: input.fatG ?? null },
        price: input.price ?? null, priceUnit: input.priceUnit ?? null, pkg: input.pkg ?? null,
        micros: input.micros ?? [], nova: input.nova ?? 1,
        stock: input.stockQty != null ? { qty: input.stockQty, unit: input.stockUnit ?? 'g', expires: input.stockExpires ?? '' } : null,
        lastUsed: '—', usedInRecipes: 0,
      }
      return { ...base, ingredients: [...base.ingredients, ing] }
    }
    const supp: SupplementStashItem = {
      id, name: input.name, brand: input.brand ?? null,
      type: input.kind === 'stim' ? 'stimulant' : input.kind === 'med' ? 'medication' : 'supplement',
      category: input.category ?? null, dose: input.dose ?? '', form: input.form ?? null,
      stock: input.stockQty ?? null, stockUnit: input.stockUnit ?? null,
      protocol: input.protocol ?? '', timing: input.timing ?? 'flexible', taken: false, caffeine: input.caffeine,
      // Nutrition + commerce (mezo-1za9) — preserve so a mock-mode supplement shows macros/price too.
      source: input.source, per: input.per, unit: input.unit,
      macros: input.kcal != null
        ? { kcal: input.kcal, p: input.proteinG ?? null, c: input.carbsG ?? null, f: input.fatG ?? null }
        : { kcal: null, p: null, c: null, f: null },
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
      ...base,
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
    // Honest since mezo-6omv: a preserved macro that was null stays null, NOT a fabricated 0 — the
    // old trailing `?? 0` only fired when `s.macros` was absent entirely, but once `s.macros.kcal`
    // itself can be null (a partially-known definition), it silently zeroed an honest "no data".
    source: input.source ?? s.source,
    per: input.per ?? s.per,
    unit: input.unit ?? s.unit,
    // `s.macros?.` stays defensive even though the type now requires it: a locked shared-catalog
    // row can reach this cache via a raw setQueryData write (bypassing the type check) with no
    // macros object at all — a crash here would silently drop the whole state-only edit (price
    // included), not just the macros field.
    macros: {
      kcal: input.kcal ?? s.macros?.kcal ?? null,
      p: input.proteinG ?? s.macros?.p ?? null,
      c: input.carbsG ?? s.macros?.c ?? null,
      f: input.fatG ?? s.macros?.f ?? null,
    },
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
    return { ...base, ingredients: base.ingredients.filter(i => i.id !== id), stash: base.stash.filter(s => s.id !== id) }
  })
  return undefined
}
