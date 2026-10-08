import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePlannedSkips, invalidateAfterWrite } from '@/data/train/skipHooks'
import { useRecovery } from '@/data/train/recoveryHooks'
import { useFuelDay, useMealActions, useWaterActions } from '@/data/fuel/fuelHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { fuelDayEnergy } from '@/data/fuel/fuel'
import { recoveryKey } from '@/data/train/recoveryHooks'
import { plannedSkipsQueryKey } from '@/data/train/skipHooks'
import { recoveryEmpty } from '@/data/train/recoveryMock'
import { localDateString } from '@/shared/lib/dates'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
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

  it('returns the preserved FuelDay shape (targets/consumed/meals/energy + pacing/micronutrients/supplements)', () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelDay(), { wrapper: Wrapper })
    expect(Object.keys(result.current.fuel).sort()).toEqual(
      ['consumed', 'energy', 'fuelMode', 'meals', 'micronutrients', 'pacing', 'recoveryCategory', 'recoveryDay', 'skippedKcal', 'supplements', 'targets'],
    )
    expect(result.current.fuel.targets.kcal).toBe(fuelDayEnergy.targetKcal)
    expect(result.current.fuel.meals.length).toBeGreaterThan(0)
    expect(result.current.fuel.micronutrients.length).toBeGreaterThan(0)
  })

  it('derives fuelMode / skippedKcal from the mock recovery + planned-skips caches', async () => {
    const { qc, Wrapper } = sharedWrapper()
    const today = localDateString()
    const { result } = renderHook(() => useFuelDay(), { wrapper: Wrapper })
    expect(result.current.fuel).toMatchObject({ fuelMode: null, recoveryDay: null, skippedKcal: 0 })
    const meal: PlannedSkip = { id: 'm', kind: 'MEAL', date: today, sessionKey: 'lunch#1', reasonCategory: 'NONE',
      source: 'USER', serious: false, freePass: false, excused: true, plannedKcal: 600 }
    act(() => { qc.setQueryData(plannedSkipsQueryKey(), [meal]) })
    await waitFor(() => expect(result.current.fuel.skippedKcal).toBe(600))
    act(() => {
      qc.setQueryData(recoveryKey(), { ...recoveryEmpty, period: { id: 'p', category: 'INJURY', estimate: 'WEEK',
        startDate: today, dayIndex: 1, estimateExpired: false, checkedInToday: false, releasedDates: [today], releasedUnlightened: [] } })
    })
    await waitFor(() => expect(result.current.fuel).toMatchObject({ fuelMode: 'MAINTENANCE', recoveryCategory: 'INJURY', recoveryDay: 1, skippedKcal: 600 }))
    act(() => {
      qc.setQueryData(recoveryKey(), { ...recoveryEmpty, period: { id: 'p', category: 'STOMACH', estimate: 'WEEK',
        startDate: today, dayIndex: 1, estimateExpired: false, checkedInToday: false, releasedDates: [], releasedUnlightened: [] } })
    })
    await waitFor(() => expect(result.current.fuel).toMatchObject({ fuelMode: 'GUIDANCE', skippedKcal: 0 }))
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
    // mezo-bqwyo: a mock a MENTÉSKOR pontoz, ahogy az éles (ADR 0006) — korábban `null`-t adott,
    // vagyis egy aszinkron-értékelős világot modellezett, ami a termékben már nem létezik (a napló
    // örökre „folyamatban" maradt, és a naplózást lezáró ünneplés demóban sosem nyílt meg).
    // Az érték szándékosan egyszerű DEMÓ-szám a makrókból, nem az éles pontozó.
    expect(added.score).toBeGreaterThan(0)
    expect(added.score).toBeLessThanOrEqual(1)
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
    expect(added.score).toBeGreaterThan(0) // demó-pontszám íráskor (lásd fentebb, mezo-bqwyo)
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

  it('maps the served fuelMode / recoveryCategory / recoveryDay / skippedKcal', async () => {
    server.use(http.get(`${API_BASE}/api/fuel/day/:date`, () => HttpResponse.json({
      date: '2026-09-28', targets: { kcal: 2400, p: 1, c: 1, f: 1, water: 1 }, consumed: { kcal: 0, p: 0, c: 0, f: 0, water: 0 },
      meals: [], fuelMode: 'ESTIMATE', recoveryCategory: 'TRAVEL', recoveryDay: 2, skippedKcal: 500,
    })))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelDay(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.fuel.fuelMode).toBe('ESTIMATE'))
    expect(result.current.fuel).toMatchObject({ recoveryCategory: 'TRAVEL', recoveryDay: 2, skippedKcal: 500 })
  })

  it('loads targets/consumed/meals from the API, keeps static pacing/micronutrients/supplements', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useFuelDay(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.fuel.meals.length).toBe(1))
    expect(result.current.fuel.targets.kcal).toBe(3100) // the MSW fuel-day fixture
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
      // mezo-bqwyo: a POST TELJES MealResponse-t ad vissza (a kliens ebből olvassa az íráskor
      // született pontszámot) — egy csonk `{id}` a mappelésen hasalna el, és a mutáció
      // elutasítana, vagyis ez a teszt az invalidálást sem érné el.
      return HttpResponse.json({
        id: 'new', slot: 'breakfast', loggedAt: '2026-06-12T08:00:00+02:00', mealDate: '2026-06-12',
        title: 'Teszt', macros: { kcal: 260, p: 20, c: 30, f: 5 }, score: { value: 0.8 }, items: [],
      }, { status: 201 })
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

  // Final review (mezo-3n2so): the day-log mark line reads ['intakeDays', d, d] — logging or
  // deleting food changes that day's status, so both writes must refetch it (and the weekly card).
  it('logMeal and deleteMeal invalidate ["intakeDays"] and ["expenditureWeeklyCard"]', async () => {
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    server.use(
      http.post(`${API_BASE}/api/meal`, async () => HttpResponse.json({
        id: 'new', slot: 'breakfast', loggedAt: '2026-07-02T08:00:00+02:00', mealDate: '2026-07-02',
        title: 'Teszt', macros: { kcal: 260, p: 20, c: 30, f: 5 }, score: { value: 0.8 }, items: [],
      }, { status: 201 })),
      http.delete(`${API_BASE}/api/meal/m1`, () => new HttpResponse(null, { status: 204 })),
    )
    const { result } = renderHook(() => useMealActions('2026-07-02'), { wrapper: Wrapper })
    const keysNow = () => spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
    act(() => result.current.logMeal(newMeal))
    await waitFor(() => {
      expect(keysNow()).toContain(JSON.stringify(['intakeDays']))
      expect(keysNow()).toContain(JSON.stringify(['expenditureWeeklyCard']))
    })
    spy.mockClear()
    act(() => result.current.deleteMeal('m1'))
    await waitFor(() => {
      expect(keysNow()).toContain(JSON.stringify(['intakeDays']))
      expect(keysNow()).toContain(JSON.stringify(['expenditureWeeklyCard']))
    })
  })

  it('logMeal invalidates ["habitDay"] and the day quest read (derived habit + quest re-derive)', async () => {
    // protein_breakfast / kitchen_close habits + protein_target / own_recipe_meal quests are
    // re-derived server-side on the next read — a meal log must nudge both, or the ✓ never appears.
    const { qc, Wrapper } = sharedWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    server.use(http.post(`${API_BASE}/api/meal`, async () => HttpResponse.json({
      id: 'new', slot: 'breakfast', loggedAt: '2026-07-02T08:00:00+02:00', mealDate: '2026-07-02',
      title: 'Teszt', macros: { kcal: 260, p: 20, c: 30, f: 5 }, score: { value: 0.8 }, items: [],
    }, { status: 201 })))
    const { result } = renderHook(() => useMealActions('2026-07-02'), { wrapper: Wrapper })
    act(() => result.current.logMeal(newMeal))
    await waitFor(() => {
      const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
      expect(keys).toContain(JSON.stringify(['habitDay']))
      expect(keys).toContain(JSON.stringify(['dailyQuests', '2026-07-02']))
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

  it('canUndo is false until a logWater happens in this mount; undoLastWater subtracts the last logged amount (floor 0)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => ({ day: useFuelDay(), water: useWaterActions() }), { wrapper: Wrapper })
    expect(result.current.water.canUndo).toBe(false)
    const before = result.current.day.fuel.consumed.water
    act(() => result.current.water.logWater(250))
    await waitFor(() => expect(result.current.day.fuel.consumed.water).toBe(before + 250))
    await waitFor(() => expect(result.current.water.canUndo).toBe(true))
    act(() => result.current.water.undoLastWater())
    await waitFor(() => expect(result.current.day.fuel.consumed.water).toBe(before))
    expect(result.current.water.canUndo).toBe(false)
  })

  it('undoLastWater with an empty stack is a no-op', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => ({ day: useFuelDay(), water: useWaterActions() }), { wrapper: Wrapper })
    const before = result.current.day.fuel.consumed.water
    act(() => result.current.water.undoLastWater())
    expect(result.current.day.fuel.consumed.water).toBe(before)
    expect(result.current.water.canUndo).toBe(false)
  })
})

describe('useWaterActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('POSTs /api/water-log and invalidates fuelDay + the day quest read', async () => {
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
    await waitFor(() => {
      const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
      expect(keys.some(k => k.includes('fuelDay'))).toBe(true)
      // quest evaluation is read-triggered — the water write must nudge the quest day read
      expect(keys).toContain(JSON.stringify(['dailyQuests', '2026-07-02']))
    })
  })

  it('undoLastWater DELETEs /api/water-log/{id} using the id from the log response, and invalidates fuelDay + the day quest read', async () => {
    let deletedId: string | null = null
    server.use(
      http.post(`${API_BASE}/api/water-log`, async () => HttpResponse.json({ id: 'w-123', date: '2026-07-02', amountMl: 250 }, { status: 201 })),
      http.delete(`${API_BASE}/api/water-log/:id`, ({ params }) => {
        deletedId = params.id as string
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { qc, Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useWaterActions('2026-07-02'), { wrapper: Wrapper })
    expect(result.current.canUndo).toBe(false)
    act(() => result.current.logWater(250))
    await waitFor(() => expect(result.current.canUndo).toBe(true))
    const spy = vi.spyOn(qc, 'invalidateQueries')
    act(() => result.current.undoLastWater())
    await waitFor(() => expect(deletedId).toBe('w-123'))
    await waitFor(() => {
      const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
      expect(keys.some(k => k.includes('fuelDay'))).toBe(true)
      expect(keys).toContain(JSON.stringify(['dailyQuests', '2026-07-02']))
    })
    expect(result.current.canUndo).toBe(false)
  })

  it('undoLastWater with an empty id stack is a no-op (no DELETE issued)', async () => {
    let deleteCalled = false
    server.use(http.delete(`${API_BASE}/api/water-log/:id`, () => {
      deleteCalled = true
      return new HttpResponse(null, { status: 204 })
    }))
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useWaterActions('2026-07-02'), { wrapper: Wrapper })
    act(() => result.current.undoLastWater())
    await new Promise(r => setTimeout(r, 0))
    expect(deleteCalled).toBe(false)
    expect(result.current.canUndo).toBe(false)
  })
})

describe('useFuelDay never owns a shared query in real mode (C1)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('a planned-skips refetch after invalidateAfterWrite still serves the server rows', async () => {
    let calls = 0
    server.use(http.get(`${API_BASE}/api/train/skips`, () => {
      calls += 1
      return HttpResponse.json([{
        id: 's1', date: localDateString(), kind: 'GYM', dayOfWeek: null, time: null, sessionKey: null,
        reasonCategory: 'NONE', reasonText: null, source: 'USER', serious: false, freePass: true, excused: true,
      }])
    }))
    const { qc, Wrapper } = sharedWrapper()
    const { result } = renderHook(() => ({ s: usePlannedSkips(), f: useFuelDay() }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.s.skips).toHaveLength(1))
    const before = calls
    act(() => invalidateAfterWrite(qc))
    await waitFor(() => expect(calls).toBeGreaterThan(before))
    await new Promise((r) => setTimeout(r, 30))
    expect(result.current.s.skips).toHaveLength(1)
  })

  it('a recovery refetch after the recovery invalidation still serves the server period', async () => {
    let calls = 0
    const state = {
      period: {
        id: 'p1', category: 'TRAVEL', estimate: 'WEEK', startDate: localDateString(), expectedEnd: localDateString(), endedOn: null,
        dayIndex: 1, estimateExpired: false, checkedInToday: false, releasedDates: [], releasedUnlightened: [], return: null,
      },
      protectedDates: [localDateString()],
      comeback: null,
    }
    server.use(http.get(`${API_BASE}/api/train/recovery`, () => { calls += 1; return HttpResponse.json(state) }))
    const { qc, Wrapper } = sharedWrapper()
    const { result } = renderHook(() => ({ r: useRecovery(), f: useFuelDay() }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.r.recovery.period).not.toBeNull())
    const before = calls
    act(() => { void qc.invalidateQueries({ queryKey: recoveryKey().slice(0, 2) }) })
    await waitFor(() => expect(calls).toBeGreaterThan(before))
    await new Promise((r) => setTimeout(r, 30))
    expect(result.current.r.recovery.period).not.toBeNull()
  })
})
