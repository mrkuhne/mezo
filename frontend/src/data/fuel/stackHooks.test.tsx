import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useStack, useProtocol, useStackActions, useProtocolActions } from '@/data/fuel/stackHooks'
import { supplementsStash } from '@/data/fuel/fuel'
import { localDateString } from '@/shared/lib/dates'
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

const takenSeedIds = supplementsStash.filter(s => s.taken).map(s => s.id)

afterEach(() => vi.unstubAllEnvs())

describe('useStack / useProtocol (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('useStack marks exactly the seed taken:true items as taken', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useStack(), { wrapper: Wrapper })
    // Same length as the seed stash (usePantry serves supplementsStash in mock mode).
    expect(result.current.stash).toHaveLength(supplementsStash.length)
    const takenNow = result.current.stash.filter(s => s.taken).map(s => s.id).sort()
    expect(takenNow).toEqual([...takenSeedIds].sort())
    // magnez is NOT taken in the seed.
    expect(result.current.stash.find(s => s.id === 'magnez')!.taken).toBe(false)
  })

  it('logIntake flips an item to taken and undoIntake flips it back (same cache)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ stack: useStack(), actions: useStackActions() }),
      { wrapper: Wrapper },
    )
    const isTaken = () => result.current.stack.stash.find(s => s.id === 'magnez')!.taken
    expect(isTaken()).toBe(false)

    act(() => result.current.actions.logIntake('magnez'))
    await waitFor(() => expect(isTaken()).toBe(true))

    act(() => result.current.actions.undoIntake('magnez'))
    await waitFor(() => expect(isTaken()).toBe(false))
  })

  it('useProtocol returns the v3 seed protocol', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useProtocol(), { wrapper: Wrapper })
    expect(result.current.protocol.version).toBe(3)
    // Seed carries no selection by design (the page's default selection applies).
    expect(result.current.selectedIds).toBeNull()
  })

  it('applyProtocol resolves with version 4 and the ["protocol"] cache reflects it', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    expect(result.current.protocol.protocol.version).toBe(3)

    let view: Awaited<ReturnType<typeof result.current.actions.applyProtocol>> | undefined
    await act(async () => {
      view = await result.current.actions.applyProtocol(['kreatin', 'd3k2'])
    })
    expect(view!.protocol!.version).toBe(4)
    expect(view!.selectedIds).toEqual(['kreatin', 'd3k2'])

    await waitFor(() => expect(result.current.protocol.protocol.version).toBe(4))
    expect(result.current.protocol.selectedIds).toEqual(['kreatin', 'd3k2'])
    expect(result.current.protocol.protocol.itemCount).toBe(2)
  })
})

describe('useStack / useProtocol (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('useProtocol returns the v0 ghost (NOT the seed) while the query is unresolved', () => {
    server.use(http.get(`${API_BASE}/api/fuel/protocol`, () => new Promise(() => {}))) // never resolves
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useProtocol(), { wrapper: Wrapper })
    expect(result.current.protocol.version).toBe(0)
    expect(result.current.protocol.status).toBe('none')
    expect(result.current.selectedIds).toBeNull()
  })

  it('useProtocol returns the v0 ghost when the backend reports no active protocol', async () => {
    // default handler → { history: [] } → no active protocol → ghost, never the seed
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useProtocol(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.protocol.version).toBe(0))
    expect(result.current.protocol.status).toBe('none')
  })

  it('useStack merges GET /api/fuel/intake/{date} rows into the pantry stash taken flags', async () => {
    server.use(
      http.get(`${API_BASE}/api/pantry`, () =>
        HttpResponse.json({
          ingredients: [],
          stash: [
            { id: 'kreatin', name: 'Kreatin', brand: 'MP', type: 'supplement', category: 'muscle', dose: '5g', form: 'por', stock: 30, stockUnit: 'adag', protocol: '', timing: 'flexible', taken: false },
            { id: 'd3k2', name: 'D3+K2', brand: 'MP', type: 'supplement', category: 'vitamin', dose: '4000IU', form: 'kapszula', stock: 42, stockUnit: 'db', protocol: '', timing: 'flexible', taken: false },
          ],
        }),
      ),
      http.get(`${API_BASE}/api/fuel/intake/:date`, () =>
        HttpResponse.json({
          intakes: [
            { id: 'intake-a', pantryItemId: 'kreatin', takenAt: '2026-07-02T07:00:00Z', takenDate: '2026-07-02', dose: '5g' },
          ],
        }),
      ),
    )
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useStack(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.stash).toHaveLength(2))
    expect(result.current.stash.find(s => s.id === 'kreatin')!.taken).toBe(true)
    expect(result.current.stash.find(s => s.id === 'd3k2')!.taken).toBe(false)
  })

  it('logIntake POSTs (offset-bearing takenAt) and invalidates ["fuelIntake", date]', async () => {
    const posted: Array<Record<string, unknown>> = []
    server.use(http.post(`${API_BASE}/api/fuel/intake`, async ({ request }) => {
      posted.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json({ id: 'intake-new', pantryItemId: 'magnez', takenAt: '2026-07-02T07:00:00Z', takenDate: '2026-07-02' }, { status: 201 })
    }))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useStackActions('2026-07-02'), { wrapper: Wrapper })
    act(() => result.current.logIntake('magnez'))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ pantryItemId: 'magnez' })
    // FE stamps an offset-bearing takenAt for "now" so the server's day key = the browser's
    // calendar day (day-key correctness — see fuelApi.logIntake / nowOffsetIso).
    expect(posted[0].takenAt).toMatch(/[+-]\d{2}:\d{2}$|Z$/)
    await waitFor(() =>
      expect(spy.mock.calls.some(c => JSON.stringify(c[0]).includes('fuelIntake'))).toBe(true),
    )
  })

  it('undoIntake DELETEs the matching cached row id', async () => {
    const date = localDateString()
    server.use(
      http.get(`${API_BASE}/api/pantry`, () =>
        HttpResponse.json({
          ingredients: [],
          stash: [{ id: 'kreatin', name: 'Kreatin', brand: 'MP', type: 'supplement', category: 'muscle', dose: '5g', form: 'por', stock: 30, stockUnit: 'adag', protocol: '', timing: 'flexible', taken: false }],
        }),
      ),
      http.get(`${API_BASE}/api/fuel/intake/:date`, () =>
        HttpResponse.json({ intakes: [{ id: 'intake-xyz', pantryItemId: 'kreatin', takenAt: '2026-07-02T07:00:00Z', takenDate: '2026-07-02', dose: '5g' }] }),
      ),
    )
    let deletedId: string | undefined
    server.use(http.delete(`${API_BASE}/api/fuel/intake/entry/:id`, ({ params }) => {
      deletedId = String(params.id)
      return new HttpResponse(null, { status: 204 })
    }))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ stack: useStack(), actions: useStackActions() }),
      { wrapper: Wrapper },
    )
    // Wait until the intake row lands in the shared cache (kreatin shows taken).
    await waitFor(() => expect(result.current.stack.stash.find(s => s.id === 'kreatin')?.taken).toBe(true))
    act(() => result.current.actions.undoIntake('kreatin'))
    await waitFor(() => expect(deletedId).toBe('intake-xyz'))
    // Cache key used matches today (both hooks default to localDateString()).
    expect(date).toBe(localDateString())
  })

  it('applyProtocol POSTs selectedPantryItemIds and writes the response into the ["protocol"] cache', async () => {
    let posted: { selectedPantryItemIds: string[]; reason?: string } | undefined
    server.use(http.post(`${API_BASE}/api/fuel/protocol`, async ({ request }) => {
      posted = (await request.json()) as { selectedPantryItemIds: string[]; reason?: string }
      return HttpResponse.json({
        active: {
          id: 'proto-1', version: 1, builtAt: '2026-07-02T06:00:00Z', status: 'active',
          confidence: 0.9, selectedPantryItemIds: posted.selectedPantryItemIds,
        },
        history: [{ version: 1, builtAt: '2026-07-02T06:00:00Z', reason: posted.reason }],
      })
    }))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    // Let the initial GET settle to the ghost first, so the in-flight fetch cannot clobber the
    // applyProtocol setQueryData (in the real app the GET resolves long before the user applies).
    await waitFor(() => expect(result.current.protocol.protocol.status).toBe('none'))
    await act(async () => {
      await result.current.actions.applyProtocol(['kreatin', 'd3k2'], 'kézi')
    })
    expect(posted).toEqual({ selectedPantryItemIds: ['kreatin', 'd3k2'], reason: 'kézi' })
    await waitFor(() => expect(result.current.protocol.protocol.version).toBe(1))
    expect(result.current.protocol.selectedIds).toEqual(['kreatin', 'd3k2'])
    expect(result.current.protocol.protocol.status).toBe('active')
  })
})
