import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useStack, useProtocol, useStackActions, useProtocolActions } from '@/data/fuel/stackHooks'
import { supplementsStash, mockPlaceOccurrence } from '@/data/fuel/fuel'
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

  it('useProtocol returns the v3 seed protocol + its 8 occurrence seed rows', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useProtocol(), { wrapper: Wrapper })
    expect(result.current.protocol.version).toBe(3)
    expect(result.current.occurrences).toHaveLength(8)
    expect(result.current.occurrences.find(o => o.id === 'occ-magnez')).toMatchObject({
      pantryItemId: 'magnez', slotKey: 'evening', pinned: false, placementSource: 'rule',
    })
  })

  it('addItem with an explicit slotKey adds a pinned user occurrence in a new zone', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    // magnez already has a seed occurrence at 'evening' — 'lunch' is a different zone, not a dup.
    await act(async () => { await result.current.actions.addItem('magnez', { slotKey: 'lunch' }) })
    await waitFor(() => expect(result.current.protocol.occurrences).toHaveLength(9))
    const added = result.current.protocol.occurrences.find(o => o.pantryItemId === 'magnez' && o.slotKey === 'lunch')
    expect(added).toMatchObject({ pinned: true, placementSource: 'user', dose: null })
  })

  it('addItem is a no-op when the (item, zone) pair already exists', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    await act(async () => { await result.current.actions.addItem('magnez', { slotKey: 'evening' }) })
    // still 8 — no duplicate occurrence created for the zone magnez already occupies.
    expect(result.current.protocol.occurrences).toHaveLength(8)
  })

  it('addItem with no slotKey uses mockPlaceOccurrence (timing pass) — weekly* lands on wake', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    // 'reta' (medication, timing 'weekly-monday') has no seed occurrence — no dup collision.
    await act(async () => { await result.current.actions.addItem('reta') })
    await waitFor(() => expect(result.current.protocol.occurrences).toHaveLength(9))
    const added = result.current.protocol.occurrences.find(o => o.pantryItemId === 'reta')
    expect(added).toMatchObject({ slotKey: 'wake', pinned: false, placementSource: 'rule' })
  })

  it('moveItem pins the occurrence into the new zone', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    await act(async () => { await result.current.actions.moveItem('occ-d3k2', 'evening') })
    await waitFor(() =>
      expect(result.current.protocol.occurrences.find(o => o.id === 'occ-d3k2')).toMatchObject({
        slotKey: 'evening', pinned: true, placementSource: 'user',
      }),
    )
  })

  it('unpinItem restores the mock placement (mockPlaceOccurrence, not the manual move)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    // d3k2 (timing 'midday') seeds at 'lunch' via the name-rule table; move it away, then unpin —
    // it should land back on 'lunch' via the timing-hint pass, which agrees here.
    await act(async () => { await result.current.actions.moveItem('occ-d3k2', 'evening') })
    await waitFor(() => expect(result.current.protocol.occurrences.find(o => o.id === 'occ-d3k2')?.pinned).toBe(true))
    await act(async () => { await result.current.actions.unpinItem('occ-d3k2') })
    await waitFor(() =>
      expect(result.current.protocol.occurrences.find(o => o.id === 'occ-d3k2')).toMatchObject({
        slotKey: 'lunch', pinned: false, placementSource: 'rule',
      }),
    )
  })

  it('setDose patches the occurrence dose', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    await act(async () => { await result.current.actions.setDose('occ-magnez', '600mg') })
    await waitFor(() =>
      expect(result.current.protocol.occurrences.find(o => o.id === 'occ-magnez')?.dose).toBe('600mg'),
    )
  })

  it('removeItem removes exactly one occurrence', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    await act(async () => { await result.current.actions.removeItem('occ-omega3') })
    await waitFor(() => expect(result.current.protocol.occurrences).toHaveLength(7))
    expect(result.current.protocol.occurrences.some(o => o.id === 'occ-omega3')).toBe(false)
  })

  it('removeAllFor empties every occurrence for that pantry item', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    // Give d3k2 a second occurrence first, so removeAllFor has more than one row to clear.
    await act(async () => { await result.current.actions.addItem('d3k2', { slotKey: 'dinner' }) })
    await waitFor(() => expect(result.current.protocol.occurrences.filter(o => o.pantryItemId === 'd3k2')).toHaveLength(2))
    await act(async () => { await result.current.actions.removeAllFor('d3k2') })
    await waitFor(() => expect(result.current.protocol.occurrences.some(o => o.pantryItemId === 'd3k2')).toBe(false))
  })

  it('logIntake(pantryItemId, slotKey) / undoIntake round-trip keyed by zone, not just the item', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ stack: useStack(), actions: useStackActions() }),
      { wrapper: Wrapper },
    )
    const isTaken = () => result.current.stack.stash.find(s => s.id === 'magnez')!.taken
    expect(isTaken()).toBe(false)

    act(() => result.current.actions.logIntake('magnez', 'evening'))
    await waitFor(() => expect(isTaken()).toBe(true))

    act(() => result.current.actions.undoIntake('magnez', 'evening'))
    await waitFor(() => expect(isTaken()).toBe(false))
  })
})

describe('mockPlaceOccurrence (mezo-vx9v) — mirrors PlacementRules.zoneForTiming', () => {
  const byId = (id: string) => supplementsStash.find(s => s.id === id)!

  it('maps each timing value to its backend-mirrored zone', () => {
    expect(mockPlaceOccurrence(byId('kreatin'))).toMatchObject({ slotKey: 'wake', placementSource: 'rule' }) // morning
    expect(mockPlaceOccurrence(byId('d3k2'))).toMatchObject({ slotKey: 'lunch', placementSource: 'rule' }) // midday
    expect(mockPlaceOccurrence(byId('magnez'))).toMatchObject({ slotKey: 'evening', placementSource: 'rule' }) // evening
    expect(mockPlaceOccurrence(byId('omega3'))).toMatchObject({ slotKey: 'dinner', placementSource: 'rule' }) // dinner
    expect(mockPlaceOccurrence(byId('origin-pwo'))).toMatchObject({ slotKey: 'pre_workout', placementSource: 'rule' }) // pre-workout
    expect(mockPlaceOccurrence(byId('reta'))).toMatchObject({ slotKey: 'wake', placementSource: 'rule' }) // weekly-monday
  })

  it('falls back to breakfast/fallback for an unmapped timing (e.g. flexible)', () => {
    expect(mockPlaceOccurrence(byId('whey'))).toMatchObject({ slotKey: 'breakfast', placementSource: 'fallback' })
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
    expect(result.current.occurrences).toEqual([]) // never the 8-item seed
  })

  it('useProtocol returns the v0 ghost when the backend reports no active protocol', async () => {
    // default handler → { history: [] } → no active protocol → ghost, never the seed
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useProtocol(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.protocol.version).toBe(0))
    expect(result.current.protocol.status).toBe('none')
    expect(result.current.occurrences).toEqual([])
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

  it('logIntake invalidates ["habitDay"] + the day quest read (derived habit re-derive, mezo-u6jx)', async () => {
    // The habit-day READ is the evaluation trigger (habit.md §3) — a stim intake must nudge
    // ['habitDay'] and ['dailyQuests', date] or morning_coffee's ✓ waits for a remount.
    server.use(http.post(`${API_BASE}/api/fuel/intake`, () => HttpResponse.json({ id: 'i-1' })))
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const date = localDateString()
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useStackActions(date), { wrapper: Wrapper })
    act(() => result.current.logIntake('p-1'))
    await waitFor(() => {
      const keys = invalidateSpy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey?: unknown })?.queryKey))
      expect(keys).toContain(JSON.stringify(['habitDay']))
      expect(keys).toContain(JSON.stringify(['dailyQuests', date]))
    })
    invalidateSpy.mockRestore()
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

  it('addItem POSTs {pantryItemId} and invalidates ["protocol"]', async () => {
    let posted: Record<string, unknown> | undefined
    server.use(http.post(`${API_BASE}/api/fuel/protocol/items`, async ({ request }) => {
      posted = (await request.json()) as Record<string, unknown>
      return HttpResponse.json(
        { id: 'item-new', pantryItemId: 'magnez', slotKey: 'evening', pinned: false, placementSource: 'rule' },
        { status: 201 },
      )
    }))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useProtocolActions(), { wrapper: Wrapper })
    await act(async () => { await result.current.addItem('magnez') })
    expect(posted).toMatchObject({ pantryItemId: 'magnez' })
    expect(spy.mock.calls.some(c => JSON.stringify(c[0]).includes('protocol'))).toBe(true)
  })

  it('moveItem PATCHes {slotKey} and invalidates ["protocol"]', async () => {
    let posted: Record<string, unknown> | undefined
    server.use(http.patch(`${API_BASE}/api/fuel/protocol/items/:id`, async ({ request }) => {
      posted = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 'occ-1', pantryItemId: 'd3k2', slotKey: 'evening', pinned: true, placementSource: 'user' })
    }))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useProtocolActions(), { wrapper: Wrapper })
    await act(async () => { await result.current.moveItem('occ-1', 'evening') })
    expect(posted).toEqual({ slotKey: 'evening' })
    expect(spy.mock.calls.some(c => JSON.stringify(c[0]).includes('protocol'))).toBe(true)
  })

  it('setDose PATCHes {dose} and invalidates ["protocol"]', async () => {
    let posted: Record<string, unknown> | undefined
    server.use(http.patch(`${API_BASE}/api/fuel/protocol/items/:id`, async ({ request }) => {
      posted = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 'occ-1', pantryItemId: 'd3k2', slotKey: 'lunch', pinned: false, placementSource: 'rule', dose: '600mg' })
    }))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useProtocolActions(), { wrapper: Wrapper })
    await act(async () => { await result.current.setDose('occ-1', '600mg') })
    expect(posted).toEqual({ dose: '600mg' })
    expect(spy.mock.calls.some(c => JSON.stringify(c[0]).includes('protocol'))).toBe(true)
  })

  it('unpinItem PATCHes {pinned:false} and invalidates ["protocol"]', async () => {
    let posted: Record<string, unknown> | undefined
    server.use(http.patch(`${API_BASE}/api/fuel/protocol/items/:id`, async ({ request }) => {
      posted = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 'occ-1', pantryItemId: 'd3k2', slotKey: 'lunch', pinned: false, placementSource: 'rule' })
    }))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useProtocolActions(), { wrapper: Wrapper })
    await act(async () => { await result.current.unpinItem('occ-1') })
    expect(posted).toEqual({ pinned: false })
    expect(spy.mock.calls.some(c => JSON.stringify(c[0]).includes('protocol'))).toBe(true)
  })

  it('removeItem DELETEs the occurrence and invalidates ["protocol"]', async () => {
    let deletedId: string | undefined
    server.use(http.delete(`${API_BASE}/api/fuel/protocol/items/:id`, ({ params }) => {
      deletedId = String(params.id)
      return new HttpResponse(null, { status: 204 })
    }))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useProtocolActions(), { wrapper: Wrapper })
    await act(async () => { await result.current.removeItem('occ-1') })
    expect(deletedId).toBe('occ-1')
    expect(spy.mock.calls.some(c => JSON.stringify(c[0]).includes('protocol'))).toBe(true)
  })

  it('removeAllFor DELETEs every occurrence id matching the pantry item, reading the cache written by useProtocol', async () => {
    server.use(http.get(`${API_BASE}/api/fuel/protocol`, () =>
      HttpResponse.json({
        active: {
          id: 'proto-1', version: 1, builtAt: '2026-07-02T06:00:00Z', status: 'active', confidence: 0.9,
          items: [
            { id: 'occ-1', pantryItemId: 'd3k2', slotKey: 'lunch', pinned: false, placementSource: 'rule' },
            { id: 'occ-2', pantryItemId: 'd3k2', slotKey: 'dinner', pinned: true, placementSource: 'user' },
            { id: 'occ-3', pantryItemId: 'magnez', slotKey: 'evening', pinned: false, placementSource: 'rule' },
          ],
        },
        history: [],
      }),
    ))
    const deletedIds: string[] = []
    server.use(http.delete(`${API_BASE}/api/fuel/protocol/items/:id`, ({ params }) => {
      deletedIds.push(String(params.id))
      return new HttpResponse(null, { status: 204 })
    }))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ protocol: useProtocol(), actions: useProtocolActions() }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.protocol.occurrences).toHaveLength(3))
    await act(async () => { await result.current.actions.removeAllFor('d3k2') })
    expect(deletedIds.sort()).toEqual(['occ-1', 'occ-2'])
  })
})
