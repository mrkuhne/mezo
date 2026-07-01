import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRecipes, useRecipeActions } from '@/data/recipeHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import type { RecipeInput } from '@/data/types'

function sharedWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

const newRecipe: RecipeInput = {
  name: 'Új recept', slot: 'Snack', category: 'snack', servings: 1,
  prepMins: 2, cookMins: 0, tags: [], starred: false,
  ingredients: [{ pantryItemId: 'ing-zab', amount: 70, unit: 'g', note: null }],
}

afterEach(() => vi.unstubAllEnvs())

describe('useRecipes (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('returns the preserved shape: recipes + sources + categoryMeta (no ingredients — see mezo-yew)', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useRecipes(), { wrapper: Wrapper })
    // `ingredients` intentionally dropped: live ingredient metadata comes from usePantry().
    expect(Object.keys(result.current).sort()).toEqual(['categoryMeta', 'pending', 'recipes', 'sources'])
    expect(result.current.recipes).toHaveLength(6) // the seed
    expect(result.current.sources['kifli.hu'].label).toBeTruthy()
    expect(result.current.categoryMeta.protein.label).toBe('Fehérje')
    // seed recipes carry computed macros (rolled up from line contributions)
    const rec1 = result.current.recipes.find(r => r.id === 'rec-1')!
    expect(rec1.macros.kcal).toBeGreaterThan(0)
    expect(rec1.ingredients[0].contribution).toBeDefined()
  })

  it('exposes pending=false in mock mode (synchronous seed)', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useRecipes(), { wrapper: Wrapper })
    expect(result.current.pending).toBe(false)
  })

  it('create appends a recipe with computed name/contribution/macros into the SAME cache', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ read: useRecipes(), actions: useRecipeActions() }),
      { wrapper: Wrapper },
    )
    const before = result.current.read.recipes.length
    act(() => result.current.actions.create(newRecipe))
    await waitFor(() => expect(result.current.read.recipes.length).toBe(before + 1))
    const added = result.current.read.recipes.find(r => r.name === 'Új recept')!
    expect(added.ingredients[0].refId).toBe('ing-zab')
    expect(added.ingredients[0].name).toBe('Zabpehely · gluténmentes')
    // 70g zab (per 100, kcal 372) → contribution kcal = round(372*0.7) = 260; macros = Σ
    expect(added.ingredients[0].contribution!.kcal).toBe(260)
    expect(added.macros.kcal).toBe(260)
  })

  it('create resolves a supplement line to its stash name, not the raw refId (mezo-3vu4)', async () => {
    // Supplements (protein powder etc.) are legit recipe ingredients now. The mock
    // recipe builder must enrich a stash-referenced line from the merged pantry, not
    // foods-only, or a saved supplement line renders its raw id + zero macros.
    const withSupplement: RecipeInput = {
      ...newRecipe,
      name: 'Supplement recept',
      ingredients: [{ pantryItemId: 'magnez', amount: 2, unit: 'db', note: null }],
    }
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ read: useRecipes(), actions: useRecipeActions() }),
      { wrapper: Wrapper },
    )
    const before = result.current.read.recipes.length
    act(() => result.current.actions.create(withSupplement))
    await waitFor(() => expect(result.current.read.recipes.length).toBe(before + 1))
    const added = result.current.read.recipes.find(r => r.name === 'Supplement recept')!
    expect(added.ingredients[0].refId).toBe('magnez')
    expect(added.ingredients[0].name).toBe('Magnézium-glicinát')
  })

  it('remove deletes a recipe from the shared cache', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ read: useRecipes(), actions: useRecipeActions() }),
      { wrapper: Wrapper },
    )
    const before = result.current.read.recipes.length
    act(() => result.current.actions.remove('rec-1'))
    await waitFor(() => expect(result.current.read.recipes.length).toBe(before - 1))
    expect(result.current.read.recipes.some(r => r.id === 'rec-1')).toBe(false)
  })
})

describe('useRecipes (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('returns no recipes (NOT the mock seed) before the query resolves', () => {
    // "no static fallback in real mode": a cold real-mode load must never flash the
    // 6 Phase-1 mock recipes before the backend list lands.
    server.use(http.get(`${API_BASE}/api/recipe`, () => new Promise(() => {}))) // never resolves
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useRecipes(), { wrapper: Wrapper })
    expect(result.current.recipes).toEqual([])
  })

  it('exposes pending=true while the query is unresolved', () => {
    server.use(http.get(`${API_BASE}/api/recipe`, () => new Promise(() => {}))) // never resolves
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useRecipes(), { wrapper: Wrapper })
    expect(result.current.pending).toBe(true)
  })

  it('loads recipes from the API (MSW fixture)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useRecipes(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.recipes.length).toBe(1))
    const r = result.current.recipes[0]
    expect(r.name).toBe('Túrós zabkása · áfonyával')
    expect(r.ingredients[0].refId).toBe('p-zab')
    expect(r.ingredients[0].contribution).toEqual({ kcal: 260, p: 9, c: 42, f: 5 })
    expect(r.mezoFit.score).toBeNull()
    // static presentation config is still present in real mode
    expect(result.current.sources).toBeDefined()
    expect(result.current.categoryMeta).toBeDefined()
  })

  it('create POSTs and invalidates BOTH ["recipes"] and ["pantry"]', async () => {
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    let posted = false
    server.use(
      http.post(`${API_BASE}/api/recipe`, async () => {
        posted = true
        return HttpResponse.json({ id: 'new' }, { status: 201 })
      }),
    )
    const { result } = renderHook(() => useRecipeActions(), { wrapper: Wrapper })
    act(() => result.current.create(newRecipe))
    await waitFor(() => expect(posted).toBe(true))
    await waitFor(() => {
      const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
      expect(keys).toContain(JSON.stringify(['recipes']))
      expect(keys).toContain(JSON.stringify(['pantry']))
    })
  })

  it('remove DELETEs and invalidates BOTH caches', async () => {
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    let deleted = false
    server.use(
      http.delete(`${API_BASE}/api/recipe/r1`, () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(() => useRecipeActions(), { wrapper: Wrapper })
    act(() => result.current.remove('r1'))
    await waitFor(() => expect(deleted).toBe(true))
    await waitFor(() => {
      const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
      expect(keys).toContain(JSON.stringify(['recipes']))
      expect(keys).toContain(JSON.stringify(['pantry']))
    })
  })
})
