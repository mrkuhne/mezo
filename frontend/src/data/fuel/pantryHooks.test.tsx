import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePantry, usePantryActions } from '@/data/fuel/pantryHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

/** A wrapper bound to ONE QueryClient — so co-rendered hooks share a cache. */
function sharedWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

afterEach(() => vi.unstubAllEnvs())

describe('usePantry (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('returns the preserved shape with seeded ingredients + stash', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => usePantry(), { wrapper: Wrapper })
    // Exact pre-existing shape: ingredients, stash, sources, categoryMeta, imports, suggestions.
    expect(Object.keys(result.current).sort()).toEqual(
      ['categoryMeta', 'imports', 'ingredients', 'pending', 'sources', 'stash', 'suggestions'],
    )
    expect(result.current.ingredients.length).toBeGreaterThan(0)
    expect(result.current.stash.length).toBeGreaterThan(0)
    expect(result.current.sources).toBeDefined()
    expect(result.current.categoryMeta).toBeDefined()
    expect(Array.isArray(result.current.imports)).toBe(true)
    expect(result.current.imports.length).toBeGreaterThan(0) // mock keeps the scrape feed
    expect(Array.isArray(result.current.suggestions)).toBe(true)
    expect(result.current.suggestions.length).toBeGreaterThan(0)
  })

  it('exposes pending=false in mock mode (synchronous seed)', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => usePantry(), { wrapper: Wrapper })
    expect(result.current.pending).toBe(false)
  })

  it('addItem appends a food ingredient that usePantry then exposes from the SAME cache', async () => {
    // Both hooks must share ONE QueryClient, else the read hook never sees the
    // mutation's setQueryData. Render them together under one wrapper instance.
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ pantry: usePantry(), actions: usePantryActions() }),
      { wrapper: Wrapper },
    )
    // Use a name guaranteed absent from the seed (the seed already has a "Brokkoli").
    const NEW_NAME = 'Brokkoli-újgenerált-teszt'
    const before = result.current.pantry.ingredients.length
    expect(before).toBeGreaterThan(0)
    expect(result.current.pantry.ingredients.some(i => i.name === NEW_NAME)).toBe(false)

    act(() => {
      result.current.actions.addItem({ kind: 'food', name: NEW_NAME, unit: 'g', kcal: 34 })
    })

    // Genuine assertion that the cache grew and now contains the new ingredient.
    await waitFor(() => {
      expect(result.current.pantry.ingredients.length).toBe(before + 1)
    })
    const added = result.current.pantry.ingredients.find(i => i.name === NEW_NAME)
    expect(added).toBeDefined()
    expect(added?.macros.kcal).toBe(34)
    expect(added?.unit).toBe('g')
  })

  it('deleteItem removes an ingredient from the shared cache', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ pantry: usePantry(), actions: usePantryActions() }),
      { wrapper: Wrapper },
    )
    const target = result.current.pantry.ingredients[0]
    const before = result.current.pantry.ingredients.length

    act(() => {
      result.current.actions.deleteItem(target.id)
    })

    await waitFor(() => {
      expect(result.current.pantry.ingredients.length).toBe(before - 1)
    })
    expect(result.current.pantry.ingredients.some(i => i.id === target.id)).toBe(false)
  })
})

describe('usePantry (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('returns empty (NOT the mock seed) before the query resolves', () => {
    // The "no static fallback in real mode" invariant: a cold real-mode load must
    // never flash the 18-item Phase-1 seed before the backend pantry lands.
    server.use(http.get(`${API_BASE}/api/pantry`, () => new Promise(() => {}))) // never resolves
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => usePantry(), { wrapper: Wrapper })
    expect(result.current.ingredients).toEqual([])
    expect(result.current.stash).toEqual([])
  })

  it('exposes pending=true while the query is unresolved', () => {
    server.use(http.get(`${API_BASE}/api/pantry`, () => new Promise(() => {}))) // never resolves
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => usePantry(), { wrapper: Wrapper })
    expect(result.current.pending).toBe(true)
  })

  it('loads ingredients + stash + REAL imports/suggestions from the API (P6, mezo-bka)', async () => {
    server.use(
      http.get(`${API_BASE}/api/pantry`, () =>
        HttpResponse.json({
          ingredients: [
            {
              id: 'i1', name: 'Csirkemell', brand: 'kifli', source: 'kifli.hu', category: 'protein',
              per: 100, unit: 'g', macros: { kcal: 110, p: 23, c: 0, f: 1.5 },
              price: 0, priceUnit: '', pkg: '', micros: [], nova: 1, stock: null,
              lastUsed: '—', usedInRecipes: 0,
            },
          ],
          stash: [
            {
              id: 's1', name: 'Kreatin', brand: 'MyProtein', type: 'supplement', category: 'muscle',
              dose: '5g', form: 'por', stock: 30, stockUnit: 'adag', protocol: '', timing: 'flexible', taken: false,
            },
          ],
          imports: [
            { id: 'pi1', source: 'openfoodfacts', when: '2026-05-02T09:14:00Z', items: 1, status: 'synced', ofWhat: 'Skyr natúr' },
          ],
          suggestions: [
            { name: 'Zabpehely', source: 'manual', price: '899 Ft/kg', reason: 'NOVA 4 → NOVA 1 csere a(z) Gabonapehely helyett' },
          ],
        }),
      ),
    )
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => usePantry(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.ingredients.length).toBe(1))
    expect(result.current.ingredients[0].name).toBe('Csirkemell')
    expect(result.current.stash[0].name).toBe('Kreatin')
    // REAL dual-mode since P6: the feed rows map through (when humanized to 'Máj 2').
    expect(result.current.imports).toEqual([
      { id: 'pi1', source: 'openfoodfacts', when: 'Máj 2', items: 1, status: 'synced', ofWhat: 'Skyr natúr' },
    ])
    expect(result.current.suggestions).toEqual([
      { name: 'Zabpehely', source: 'manual', price: '899 Ft/kg', reason: 'NOVA 4 → NOVA 1 csere a(z) Gabonapehely helyett' },
    ])
    // Static presentation config is still present in real mode.
    expect(result.current.sources).toBeDefined()
    expect(result.current.categoryMeta).toBeDefined()
  })

  it('importItem POSTs the draft then refetches the pantry (P6, mezo-bka)', async () => {
    let posted: Record<string, unknown> | null = null
    server.use(
      http.post(`${API_BASE}/api/pantry-import`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 'new-1', kind: 'food', name: 'Skyr natúr', source: 'openfoodfacts' }, { status: 201 })
      }),
    )
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => usePantryActions(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.importItem({ name: 'Skyr natúr', per: 100, unit: 'g', kcal: 63, category: 'dairy' })
    })

    expect(posted).toMatchObject({ name: 'Skyr natúr', per: 100, unit: 'g', kcal: 63, category: 'dairy' })
  })
})
