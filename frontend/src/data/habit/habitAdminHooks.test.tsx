import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useHabitAiSuggest, useHabitCatalog, useHabitCatalogActions } from '@/data/habit/habitAdminHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

/** A wrapper bound to ONE QueryClient — so co-rendered hooks (catalog read + actions) share a cache. */
function sharedWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

afterEach(() => vi.unstubAllEnvs())

describe('useHabitCatalog / useHabitCatalogActions (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('useHabitCatalog serves mockHabitCatalog synchronously — 2 chains, 9 MORNING + 6 EVENING defs', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitCatalog(), { wrapper: Wrapper })
    expect(result.current.catalog.chains).toHaveLength(2)
    const morning = result.current.catalog.chains.find((c) => c.chainKey === 'MORNING')!
    const evening = result.current.catalog.chains.find((c) => c.chainKey === 'EVENING')!
    expect(morning.defs).toHaveLength(9)
    expect(evening.defs).toHaveLength(6)
    expect(morning.title).toBe('Reggeli rutin')
    expect(evening.title).toBe('Esti rutin')
  })

  it('every catalog def satisfies mode MANUAL ⟺ metric "manual" — no backend-unproducible combo', () => {
    // caffeine_cutoff/kitchen_close are MANUAL in the mock catalog (mockHabitDay's deliberate
    // playability deviation) but their CATALOG_META metric mirrors the real DERIVED seed
    // (no_stim_after/last_meal_before) — the real backend can never produce MANUAL+a-real-metric
    // (MANUAL always forces metric to "manual"), so every def here must satisfy the same invariant.
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitCatalog(), { wrapper: Wrapper })
    const allDefs = result.current.catalog.chains.flatMap((c) => c.defs)
    expect(allDefs.length).toBeGreaterThan(0)
    for (const d of allDefs) {
      expect(d.mode === 'MANUAL').toBe(d.metric === 'manual')
    }
  })

  it('createChain appends a chain with a generated key + the given daypart to the cache', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    await act(async () => {
      await result.current.actions.createChain({ title: 'Munkanap rutin', daypart: 'DAY' })
    })
    await waitFor(() => expect(result.current.catalog.catalog.chains).toHaveLength(3))
    const created = result.current.catalog.catalog.chains.find((c) => c.title === 'Munkanap rutin')
    expect(created).toBeDefined()
    expect(created!.chainKey).toMatch(/^chain_[0-9a-f]{8}$/)
    expect(created!.daypart).toBe('DAY')
    expect(created!.defs).toEqual([])
  })

  it('updateDef({isActive:false}) flips the cached def', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    const target = result.current.catalog.catalog.chains
      .find((c) => c.chainKey === 'MORNING')!.defs.find((d) => d.habitKey === 'morning_sunlight')!
    expect(target.isActive).toBe(true)

    await act(async () => {
      await result.current.actions.updateDef(target.id, { isActive: false })
    })
    await waitFor(() => {
      const def = result.current.catalog.catalog.chains
        .flatMap((c) => c.defs).find((d) => d.id === target.id)!
      expect(def.isActive).toBe(false)
    })
  })

  it('updateDef ignores a null patch value — mirrors the real PATCH\'s "null = no-op, not a clear" (mezo-n5e9.2 fix wave)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    const target = result.current.catalog.catalog.chains
      .find((c) => c.chainKey === 'MORNING')!.defs.find((d) => d.habitKey === 'morning_sunlight')!
    expect(target.why).not.toBeNull()

    await act(async () => {
      await result.current.actions.updateDef(target.id, { why: null })
    })
    await waitFor(() => {
      const def = result.current.catalog.catalog.chains
        .flatMap((c) => c.defs).find((d) => d.id === target.id)!
      expect(def.why).toBe(target.why) // unchanged — a null patch value never clears
    })
  })

  it('deleteChain throws HABIT_CHAIN_SEED for a seed chain — mirrors the backend 409 guard (was: silently removed a 9-def seed chain)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    const morning = result.current.catalog.catalog.chains.find((c) => c.chainKey === 'MORNING')!
    expect(morning.defs.length).toBeGreaterThan(0) // the seed chain this used to wrongly delete

    await act(async () => {
      await expect(result.current.actions.deleteChain(morning.id)).rejects.toThrow('HABIT_CHAIN_SEED')
    })
    // The guard rejected the write — the seed chain and its defs are still in the cache.
    expect(result.current.catalog.catalog.chains.some((c) => c.id === morning.id)).toBe(true)
    expect(result.current.catalog.catalog.chains).toHaveLength(2)
  })

  it('deleteChain removes an empty custom chain (the passing path the seed guard does not block)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    await act(async () => {
      await result.current.actions.createChain({ title: 'Munkanap rutin', daypart: 'DAY' })
    })
    await waitFor(() => expect(result.current.catalog.catalog.chains).toHaveLength(3))
    const created = result.current.catalog.catalog.chains.find((c) => c.title === 'Munkanap rutin')!
    expect(created.defs).toEqual([]) // empty — the NOT_EMPTY guard does not apply

    await act(async () => {
      await result.current.actions.deleteChain(created.id)
    })
    await waitFor(() =>
      expect(result.current.catalog.catalog.chains.some((c) => c.id === created.id)).toBe(false))
    expect(result.current.catalog.catalog.chains).toHaveLength(2)
  })

  it('deleteChain throws HABIT_CHAIN_NOT_EMPTY for a non-empty custom chain', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    await act(async () => {
      await result.current.actions.createChain({ title: 'Munkanap rutin', daypart: 'DAY' })
    })
    await waitFor(() => expect(result.current.catalog.catalog.chains).toHaveLength(3))
    const created = () => result.current.catalog.catalog.chains.find((c) => c.title === 'Munkanap rutin')!
    await act(async () => {
      await result.current.actions.createDef({
        chainKey: created().chainKey, title: 'Napi olvasás', mode: 'MANUAL', skillKey: 'learning', xp: 5,
      })
    })
    await waitFor(() => expect(created().defs).toHaveLength(1))

    await act(async () => {
      await expect(result.current.actions.deleteChain(created().id)).rejects.toThrow('HABIT_CHAIN_NOT_EMPTY')
    })
    expect(result.current.catalog.catalog.chains.some((c) => c.id === created().id)).toBe(true)
  })

  it('reorderChain reorders the cached defs and renumbers their positions', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    const morning = result.current.catalog.catalog.chains.find((c) => c.chainKey === 'MORNING')!
    const ids = morning.defs.map((d) => d.id)
    const reversed = [...ids].reverse()

    await act(async () => {
      await result.current.actions.reorderChain(morning.id, reversed)
    })
    await waitFor(() => {
      const updated = result.current.catalog.catalog.chains.find((c) => c.chainKey === 'MORNING')!
      expect(updated.defs.map((d) => d.id)).toEqual(reversed)
      expect(updated.defs.map((d) => d.position)).toEqual(reversed.map((_, i) => i + 1))
    })
  })

  it('reorderChain throws HABIT_REORDER_MISMATCH when defIds is not an exact permutation (stale/partial list)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    const morning = result.current.catalog.catalog.chains.find((c) => c.chainKey === 'MORNING')!
    const staleList = morning.defs.slice(1).map((d) => d.id) // missing the first def — a stale read

    await act(async () => {
      await expect(result.current.actions.reorderChain(morning.id, staleList))
        .rejects.toThrow('HABIT_REORDER_MISMATCH')
    })
    // The guard rejected the write — every def is still there, none silently dropped.
    const stillMorning = result.current.catalog.catalog.chains.find((c) => c.chainKey === 'MORNING')!
    expect(stillMorning.defs).toHaveLength(morning.defs.length)
  })

  it('updateDef({chainKey}) to an unknown chain throws HABIT_DEF_UNKNOWN_CHAIN (was: the def silently vanished)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    const target = result.current.catalog.catalog.chains
      .find((c) => c.chainKey === 'MORNING')!.defs.find((d) => d.habitKey === 'morning_sunlight')!

    await act(async () => {
      await expect(result.current.actions.updateDef(target.id, { chainKey: 'chain_doesnotexist' }))
        .rejects.toThrow('HABIT_DEF_UNKNOWN_CHAIN')
    })
    // The guard rejected the write — the def is still in its original chain, not vanished.
    const stillThere = result.current.catalog.catalog.chains
      .find((c) => c.chainKey === 'MORNING')!.defs.find((d) => d.id === target.id)
    expect(stillThere).toBeDefined()
  })

  it('useHabitAiSuggest.suggest resolves the canned 2-suggestion fixture (mezo-n5e9.3)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitAiSuggest(), { wrapper: Wrapper })
    let suggestions: Awaited<ReturnType<typeof result.current.suggest>> = []
    await act(async () => {
      suggestions = await result.current.suggest({ hint: 'jobb esti lezárás' })
    })
    expect(suggestions).toHaveLength(2)
    expect(suggestions.every((s) => s.chainKey === 'MORNING' || s.chainKey === 'EVENING')).toBe(true)
    expect(result.current.unavailable).toBe(false)
  })
})

describe('useHabitCatalog / useHabitCatalogActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('returns realEmpty ({chains: []}) while unresolved, then the MSW-served data', async () => {
    server.use(http.get(`${API_BASE}/api/habit/catalog`, () => HttpResponse.json({
      chains: [
        {
          id: 'c-1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true,
          defs: [
            {
              id: 'd-1', habitKey: 'wake_on_time', chainKey: 'MORNING', position: 1, title: 'Ébredés időben',
              why: null, anchorCopy: null, mode: 'DERIVED', metric: 'sleep_wake_window', skillKey: 'recovery',
              xp: 10, linkUrl: null, isActive: true,
            },
          ],
        },
      ],
    })))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitCatalog(), { wrapper: Wrapper })
    expect(result.current.catalog.chains).toEqual([]) // never the mock seed while unresolved
    await waitFor(() => expect(result.current.catalog.chains).toHaveLength(1))
    expect(result.current.catalog.chains[0].defs[0].habitKey).toBe('wake_on_time')
  })

  it('surfaces isError on a failed GET, and refetch() recovers once the server responds (mezo-n5e9.2 fix wave)', async () => {
    server.use(http.get(`${API_BASE}/api/habit/catalog`, () => HttpResponse.json([], { status: 500 })))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitCatalog(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.catalog.chains).toEqual([]) // realEmpty, never the mock seed

    server.use(http.get(`${API_BASE}/api/habit/catalog`, () => HttpResponse.json({ chains: [] })))
    result.current.refetch()
    await waitFor(() => expect(result.current.isError).toBe(false))
  })

  it('createDef POSTs /api/habit/def and invalidates habitCatalog + habitDay + habitSummary', async () => {
    let posted: Record<string, unknown> | undefined
    server.use(http.post(`${API_BASE}/api/habit/def`, async ({ request }) => {
      posted = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({
        id: 'd-new', habitKey: 'custom_abcdef01', chainKey: String(posted.chainKey), position: 1,
        title: String(posted.title), why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual',
        skillKey: String(posted.skillKey), xp: Number(posted.xp), linkUrl: null, isActive: true,
      }, { status: 200 })
    }))
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitCatalogActions(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.createDef({
        chainKey: 'MORNING', title: 'Napi olvasás', mode: 'MANUAL', skillKey: 'learning', xp: 5,
      })
    })
    expect(posted).toMatchObject({ chainKey: 'MORNING', title: 'Napi olvasás' })
    await waitFor(() => {
      const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey?: unknown })?.queryKey))
      expect(keys).toContain(JSON.stringify(['habitCatalog']))
      expect(keys).toContain(JSON.stringify(['habitDay']))
      expect(keys).toContain(JSON.stringify(['habitSummary']))
    })
    invalidateSpy.mockRestore()
  })

  it('useHabitAiSuggest.suggest POSTs /api/habit/ai/suggest with chainKey + hint and resolves the mapped suggestions', async () => {
    let posted: Record<string, unknown> | undefined
    server.use(http.post(`${API_BASE}/api/habit/ai/suggest`, async ({ request }) => {
      posted = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({
        suggestions: [
          { title: 'Napi 10 perc olvasás', why: 'Esti lezárás olvasással.', anchorCopy: 'wind-down alatt', skillKey: 'learning', xp: 5, chainKey: 'EVENING' },
        ],
      })
    }))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitAiSuggest(), { wrapper: Wrapper })

    let suggestions: Awaited<ReturnType<typeof result.current.suggest>> = []
    await act(async () => {
      suggestions = await result.current.suggest({ chainKey: 'EVENING', hint: 'olvasás' })
    })
    expect(posted).toEqual({ chainKey: 'EVENING', hint: 'olvasás' })
    expect(suggestions).toEqual([
      { title: 'Napi 10 perc olvasás', why: 'Esti lezárás olvasással.', anchorCopy: 'wind-down alatt', skillKey: 'learning', xp: 5, chainKey: 'EVENING',
        framework: null, cue: null, craving: null, reward: null, celebration: null },
    ])
    expect(result.current.unavailable).toBe(false)
  })

  it('useHabitAiSuggest.suggest maps a 503 to unavailable:true instead of throwing to the global toast', async () => {
    server.use(http.post(`${API_BASE}/api/habit/ai/suggest`, () => new HttpResponse(null, { status: 503 })))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitAiSuggest(), { wrapper: Wrapper })

    let suggestions: Awaited<ReturnType<typeof result.current.suggest>> | undefined
    await act(async () => {
      suggestions = await result.current.suggest({})
    })
    expect(suggestions).toEqual([]) // resolved, not rejected — no global toast for this path
    await waitFor(() => expect(result.current.unavailable).toBe(true))
  })

  it('useHabitAiSuggest.suggest maps a 404 (whole habit surface off) to unavailable:true too', async () => {
    server.use(http.post(`${API_BASE}/api/habit/ai/suggest`, () => new HttpResponse(null, { status: 404 })))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitAiSuggest(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.suggest({})
    })
    await waitFor(() => expect(result.current.unavailable).toBe(true))
  })

  it('useHabitAiSuggest.suggest still rejects a non-503/404 error (e.g. 400) — the global toast path', async () => {
    server.use(http.post(`${API_BASE}/api/habit/ai/suggest`, () =>
      HttpResponse.json([{ code: 'HABIT_SUGGEST_BAD_REQUEST', message: 'bad' }], { status: 400 })))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitAiSuggest(), { wrapper: Wrapper })

    await act(async () => {
      await expect(result.current.suggest({})).rejects.toThrow()
    })
    expect(result.current.unavailable).toBe(false) // not eaten as "unavailable" — a genuine failure
  })
})
