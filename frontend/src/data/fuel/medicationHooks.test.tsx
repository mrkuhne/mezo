import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMedication, useMedicationActions } from '@/data/fuel/medicationHooks'
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

  it('reads medication + cycle + doses from the overridden API handler', async () => {
    server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useMedication(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.medication.name).toBe('Teszt gyógyszer'))
    expect(result.current.cycle.cycleDay).toBe(3)
    expect(result.current.cycle.phaseKey).toBe('stable')
    expect(result.current.doses.length).toBe(3)
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
