import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useHabitCatalog, useHabitCatalogActions } from '@/data/habit/habitAdminHooks'
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

  it('deleteChain removes it', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    const morningId = result.current.catalog.catalog.chains.find((c) => c.chainKey === 'MORNING')!.id

    await act(async () => {
      await result.current.actions.deleteChain(morningId)
    })
    await waitFor(() =>
      expect(result.current.catalog.catalog.chains.some((c) => c.id === morningId)).toBe(false))
    expect(result.current.catalog.catalog.chains).toHaveLength(1)
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
})
