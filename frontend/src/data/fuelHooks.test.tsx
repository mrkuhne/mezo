import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFuelDay, useMealActions } from './fuelHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import type { MealInput } from './types'

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

afterEach(() => vi.unstubAllEnvs())

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
})

describe('useFuelDay (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

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
