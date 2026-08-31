import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMedication, useMedicationActions } from '@/data/fuel/medicationHooks'
import { DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { localDateString } from '@/shared/lib/dates'
import { medicationFixture } from '@/test/fixtures/medication'
import type { MedicationDoseInput } from '@/data/types'

function sharedWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

// The app itself seeds no medication (mezo-lwmq) — mock-mode tests that exercise the POPULATED
// branch preload the neutral fixture into the cache; useDualQuery's initialData only applies
// when the cache is empty, so this wins over the ghost `medicationSeed`.
function sharedWrapperWithFixture() {
  const shared = sharedWrapper()
  shared.qc.setQueryData(['medication'], medicationFixture)
  return shared
}

// A client mirroring the app's real query defaults (QueryProvider: staleTime 30_000), for the
// tests that assert on CACHING rather than on mapping.
function appDefaultsWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: DEFAULT_QUERY_STALE_TIME_MS } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

const doseToday: MedicationDoseInput = { administeredAt: `${localDateString()}T07:00:00`, dose: 6, note: null }

afterEach(() => vi.unstubAllEnvs())

describe('useMedication (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('returns the fixture medication + cycle (cycleDay 3) + doses', () => {
    const { Wrapper } = sharedWrapperWithFixture()
    const { result } = renderHook(() => useMedication(), { wrapper: Wrapper })
    expect(Object.keys(result.current).sort()).toEqual(['cycle', 'doses', 'medication'])
    expect(result.current.medication.name).toBe('Teszt gyógyszer')
    expect(result.current.cycle.cycleDay).toBe(3)
    expect(result.current.cycle.phaseKey).toBe('stable')
    expect(result.current.doses.length).toBe(3)
  })

  it('logDose appends a dose AND recomputes the cycle to cycleDay 1 (dose today)', async () => {
    const { Wrapper } = sharedWrapperWithFixture()
    const { result } = renderHook(
      () => ({ read: useMedication(), actions: useMedicationActions() }),
      { wrapper: Wrapper },
    )
    const before = result.current.read.doses.length
    act(() => result.current.actions.logDose(doseToday))
    await waitFor(() => expect(result.current.read.doses.length).toBe(before + 1))
    // a dose today → days-since-newest = 0 → cycleDay 1 (the FE mirror of the backend derive)
    expect(result.current.read.cycle.cycleDay).toBe(1)
    expect(result.current.read.cycle.phaseKey).toBe('peak')
    const cur = result.current.read.cycle.week.find(c => c.current)!
    expect(cur.day).toBe(1)
  })

  it('removeDose drops a dose from the cache', async () => {
    const { Wrapper } = sharedWrapperWithFixture()
    const { result } = renderHook(
      () => ({ read: useMedication(), actions: useMedicationActions() }),
      { wrapper: Wrapper },
    )
    const id = result.current.read.doses[0].id
    const before = result.current.read.doses.length
    act(() => result.current.actions.removeDose(id))
    await waitFor(() => expect(result.current.read.doses.length).toBe(before - 1))
    expect(result.current.read.doses.some(d => d.id === id)).toBe(false)
  })
})

describe('useMedication (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('returns a no-medication ghost before the query resolves, proven by an actual fetch (not a coincidental seed match)', async () => {
    // mezo-lwmq: medicationSeed is now byte-identical to the ghost, so the ghost VALUES alone no
    // longer distinguish "real mode correctly fell back to realEmpty" from "real mode wrongly fell
    // back to the mock seed" (see useDualQuery's invariant, medicationHooks.ts:24-26 /
    // useDualQuery.ts). Spy on the handler to prove the real branch actually issued the fetch.
    let fetchCount = 0
    server.use(http.get(`${API_BASE}/api/medication`, () => {
      fetchCount++
      return new Promise(() => {}) // never resolves
    }))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useMedication(), { wrapper: Wrapper })
    await waitFor(() => expect(fetchCount).toBeGreaterThan(0))
    expect(result.current.cycle.cycleDay).toBe(0)
    expect(result.current.doses).toEqual([])
    expect(result.current.medication.name).toBe('')
  })

  // The two contract shapes for "this owner has no medication configured" must land on the SAME
  // ghost (mezo-5cmq). The deploy pushes the two images separately, so the new frontend has to
  // read both the new 200-with-nulls body and the pre-5cmq 404 — a frontend that understood only
  // one of them would either crash on `med.id` or break under the old backend.
  it('reads the new 200 + `medication: null` body as the no-medication ghost, WITHOUT erroring', async () => {
    server.use(http.get(`${API_BASE}/api/medication`, () =>
      HttpResponse.json({ medication: null, cycle: null, recentDoses: [] })))
    const { qc, Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useMedication(), { wrapper: Wrapper })
    // The query must SUCCEED — landing on the ghost via a thrown mapper (caught by realEmpty)
    // would look identical in the returned values, so pin the query status too.
    await waitFor(() => expect(qc.getQueryState(['medication'])?.status).toBe('success'))
    expect(result.current.medication.id).toBe('')
    expect(result.current.cycle.cycleDay).toBe(0)
    expect(result.current.doses).toEqual([])
  })

  it('reads the OLD 404 shape as the same no-medication ghost (old backend under new frontend)', async () => {
    server.use(http.get(`${API_BASE}/api/medication`, () => new HttpResponse(null, { status: 404 })))
    const { qc, Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useMedication(), { wrapper: Wrapper })
    await waitFor(() => expect(qc.getQueryState(['medication'])?.status).toBe('error'))
    // The rejection is absorbed by useDualQuery's `realEmpty` — same empty state, no crash.
    expect(result.current.medication.id).toBe('')
    expect(result.current.cycle.cycleDay).toBe(0)
    expect(result.current.doses).toEqual([])
  })

  it('reads medication + cycle + doses from the overridden API handler', async () => {
    server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useMedication(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.medication.name).toBe('Teszt gyógyszer'))
    expect(result.current.cycle.cycleDay).toBe(3)
    expect(result.current.cycle.phaseKey).toBe('stable')
    expect(result.current.doses.length).toBe(3)
  })

  it('does NOT refetch for a second observer on the same client — one fetch, not one per mount', async () => {
    // Regression pin for the deleted `realStaleTime: 0` (mezo-5cmq). useTodayScenario calls
    // useMedication from the app shell AND from several pages, so an always-stale query opened a
    // new observer — and bought a round-trip — on every navigation. Under the app default
    // staleTime the second mount is served from cache. Writes are unaffected: every mutation in
    // useMedicationActions invalidates ['medication'].
    let fetchCount = 0
    server.use(http.get(`${API_BASE}/api/medication`, () => {
      fetchCount++
      return HttpResponse.json(medicationFixture)
    }))
    // NOT sharedWrapper(): its client leaves staleTime at TanStack's 0 default, under which the
    // second observer refetches no matter what the hook does. The app's real QueryProvider default
    // (30 s) is what makes this assertion meaningful — and `realStaleTime: 0` would override it
    // back to always-stale, which is exactly the regression being pinned.
    const { Wrapper } = appDefaultsWrapper()
    const first = renderHook(() => useMedication(), { wrapper: Wrapper })
    await waitFor(() => expect(first.result.current.medication.id).toBe('med-test'))
    expect(fetchCount).toBe(1)
    // a second page mounting the same read, against the SAME QueryClient
    const second = renderHook(() => useMedication(), { wrapper: Wrapper })
    await waitFor(() => expect(second.result.current.medication.id).toBe('med-test'))
    expect(fetchCount).toBe(1)
  })

  it('logDose POSTs to the active medication and invalidates ["medication"], ["today"] AND ["fuelDay"]', async () => {
    server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    let postedMedId: string | null = null
    server.use(http.post(`${API_BASE}/api/medication/:medId/dose`, async ({ params }) => {
      postedMedId = String(params.medId)
      return HttpResponse.json({ id: 'd-new', administeredAt: `${localDateString()}T07:00:00`, dose: 6, note: null }, { status: 201 })
    }))
    // useMedication renders alongside (as in the real Gyógyszer view) so the active medication id
    // is in the ['medication'] cache for the action's path params.
    const { result } = renderHook(
      () => ({ read: useMedication(), actions: useMedicationActions() }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.read.medication.id).toBe('med-test'))
    act(() => result.current.actions.logDose(doseToday))
    await waitFor(() => expect(postedMedId).toBe('med-test'))
    await waitFor(() => {
      const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
      expect(keys).toContain(JSON.stringify(['medication']))
      expect(keys).toContain(JSON.stringify(['today']))
      expect(keys).toContain(JSON.stringify(['fuelDay']))
    })
  })

  it('removeDose DELETEs from the active medication and invalidates the 3 caches', async () => {
    server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    let deletedMedId: string | null = null
    server.use(http.delete(`${API_BASE}/api/medication/:medId/dose/:doseId`, ({ params }) => {
      deletedMedId = String(params.medId)
      return new HttpResponse(null, { status: 204 })
    }))
    const { result } = renderHook(
      () => ({ read: useMedication(), actions: useMedicationActions() }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.read.medication.id).toBe('med-test'))
    act(() => result.current.actions.removeDose('dose-3'))
    await waitFor(() => expect(deletedMedId).toBe('med-test'))
    await waitFor(() => {
      const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
      expect(keys).toContain(JSON.stringify(['medication']))
      expect(keys).toContain(JSON.stringify(['today']))
      expect(keys).toContain(JSON.stringify(['fuelDay']))
    })
  })
})
