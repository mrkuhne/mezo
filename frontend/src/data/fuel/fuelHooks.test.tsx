import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFuelDay, useMealActions, useWaterActions } from '@/data/fuel/fuelHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import type { MealInput } from '@/data/types'

function sharedWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

const newMeal: MealInput = {
  slot: 'snack', loggedAt: null, title: 'Snack',
  items: [{ source: 'pantry', refId: 'ing-zab', amount: 70, unit: 'g' }],
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('useFuelDay (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('returns the preserved FuelDay shape (targets/consumed/meals + pacing/micronutrients/supplements)', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelDay(), { wrapper: Wrapper })
    expect(Object.keys(result.current.fuel).sort()).toEqual(
      ['consumed', 'meals', 'micronutrients', 'pacing', 'supplements', 'targets'],
    )
    expect(result.current.fuel.targets.kcal).toBe(3100)
    expect(result.current.fuel.meals.length).toBeGreaterThan(0)
    expect(result.current.fuel.micronutrients.length).toBeGreaterThan(0)
  })

  it('logMeal appends a meal with whole-number contribution into the SAME ["fuelDay"] cache', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ read: useFuelDay(), actions: useMealActions() }),
      { wrapper: Wrapper },
    )
    const before = result.current.read.fuel.meals.length
    act(() => result.current.actions.logMeal(newMeal))
    await waitFor(() => expect(result.current.read.fuel.meals.length).toBe(before + 1))
    const added = result.current.read.fuel.meals.at(-1)!
    // ing-zab per 100, kcal 372 → round(372 × 70/100) = 260
    expect(added.mealItems[0].contribution.kcal).toBe(260)
    expect(added.kcal).toBe(260)
    expect(added.score).toBeNull()
  })

  it('deleteMeal removes a meal from the ["fuelDay"] cache', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ read: useFuelDay(), actions: useMealActions() }),
      { wrapper: Wrapper },
    )
    const id = result.current.read.fuel.meals[0].id
    const before = result.current.read.fuel.meals.length
    act(() => result.current.actions.deleteMeal(id))
    await waitFor(() => expect(result.current.read.fuel.meals.length).toBe(before - 1))
    expect(result.current.read.fuel.meals.some(m => m.id === id)).toBe(false)
  })

  it('draftMealFromAi returns the canned draft in mock mode', async () => {
    vi.useFakeTimers()
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useMealActions(), { wrapper: Wrapper })
    const promise = result.current.draftMealFromAi({ date: '2026-07-18', text: 'csirkés wrap' })
    await vi.advanceTimersByTimeAsync(700)
    const draft = await promise
    expect(draft.items.length).toBeGreaterThan(0)
    expect(draft.items.some(l => l.source === 'estimate')).toBe(true)
    vi.useRealTimers()
  })

  it('logMeal accepts an estimate line and computes its contribution from snapshots', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ read: useFuelDay('2026-07-18'), actions: useMealActions('2026-07-18') }),
      { wrapper: Wrapper },
    )
    const before = result.current.read.fuel.meals.length
    act(() => result.current.actions.logMeal({
      slot: 'lunch',
      loggedAt: new Date('2026-07-18T12:00:00Z').toISOString(),
      title: null,
      items: [{ source: 'estimate', name: 'Csirkés wrap', amount: 1, unit: 'db',
                per: 1, basisUnit: 'db', kcal: 450, proteinG: 28, carbsG: 40, fatG: 18 }],
      provenance: { origin: 'ai-text', rawText: 'csirkés wrap' },
    }))
    await waitFor(() => expect(result.current.read.fuel.meals.length).toBe(before + 1))
    // per = amount = 1 ⇒ contribution equals the given snapshot macros (round(450/1×1) = 450)
    const added = result.current.read.fuel.meals.at(-1)!
    expect(added.mealItems[0].source).toBe('estimate')
    expect(added.mealItems[0].contribution.kcal).toBe(450)
    expect(added.kcal).toBe(450)
    expect(added.score).toBeNull()
  })
})

describe('useFuelDay (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('returns a zero day (NOT the mock seed) before the query resolves', () => {
    // "no static fallback in real mode": a cold real-mode load must never flash the
    // seed's fabricated macros + 4 fake meals before the backend day lands.
    server.use(http.get(`${API_BASE}/api/fuel/day/:date`, () => new Promise(() => {}))) // never resolves
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelDay(), { wrapper: Wrapper })
    expect(result.current.fuel.targets.kcal).toBe(0)
    expect(result.current.fuel.consumed.kcal).toBe(0)
    expect(result.current.fuel.meals).toEqual([])
    // the static legs still compose in (they are not query-driven)
    expect(result.current.fuel.pacing).toBeDefined()
  })

  it('loads targets/consumed/meals from the API, keeps static pacing/micronutrients/supplements', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelDay(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.fuel.meals.length).toBe(1))
    expect(result.current.fuel.targets.kcal).toBe(3100)
    expect(result.current.fuel.consumed.kcal).toBe(580)
    expect(result.current.fuel.meals[0].mealItems[0].refId).toBe('p-zab')
    // composed static legs still present
    expect(result.current.fuel.pacing).toBeDefined()
    expect(result.current.fuel.micronutrients.length).toBeGreaterThan(0)
  })

  it('logMeal POSTs and invalidates ["fuelDay"], ["recipes"] AND ["pantry"]', async () => {
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    let posted = false
    server.use(http.post(`${API_BASE}/api/meal`, async () => {
      posted = true
      return HttpResponse.json({ id: 'new' }, { status: 201 })
    }))
    const { result } = renderHook(() => useMealActions(), { wrapper: Wrapper })
    act(() => result.current.logMeal(newMeal))
    await waitFor(() => expect(posted).toBe(true))
    await waitFor(() => {
      const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
      expect(keys.some(k => k.includes('fuelDay'))).toBe(true)
      expect(keys).toContain(JSON.stringify(['recipes']))
      expect(keys).toContain(JSON.stringify(['pantry']))
    })
  })

  it('deleteMeal DELETEs and invalidates the 3 caches', async () => {
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    let deleted = false
    server.use(http.delete(`${API_BASE}/api/meal/m1`, () => {
      deleted = true
      return new HttpResponse(null, { status: 204 })
    }))
    const { result } = renderHook(() => useMealActions(), { wrapper: Wrapper })
    act(() => result.current.deleteMeal('m1'))
    await waitFor(() => expect(deleted).toBe(true))
    await waitFor(() => {
      const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
      expect(keys.some(k => k.includes('fuelDay'))).toBe(true)
      expect(keys).toContain(JSON.stringify(['recipes']))
      expect(keys).toContain(JSON.stringify(['pantry']))
    })
  })
})

describe('useWaterActions (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('increments consumed.water and survives a subsequent meal log', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => ({ day: useFuelDay(), water: useWaterActions(), meals: useMealActions() }), { wrapper: Wrapper })
    const before = result.current.day.fuel.consumed.water
    act(() => result.current.water.logWater(250))
    await waitFor(() => expect(result.current.day.fuel.consumed.water).toBe(before + 250))
    act(() => result.current.meals.logMeal({ slot: 'snack', items: [] }))
    await waitFor(() => expect(result.current.day.fuel.consumed.water).toBe(before + 250))
  })
})

describe('useWaterActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('POSTs /api/water-log and invalidates fuelDay', async () => {
    const posted: unknown[] = []
    server.use(http.post(`${API_BASE}/api/water-log`, async ({ request }) => {
      posted.push(await request.json())
      return HttpResponse.json({ id: 'w1', date: '2026-07-02', amountMl: 250 }, { status: 201 })
    }))
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useWaterActions('2026-07-02'), { wrapper: Wrapper })
    act(() => result.current.logWater(250))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({ date: '2026-07-02', amountMl: 250 })
    await waitFor(() => expect(spy.mock.calls.some(c => JSON.stringify(c[0]).includes('fuelDay'))).toBe(true))
  })
})
