import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { API_BASE } from '@/data/_client/api'
import { useLifeGoals, useLifeGoalMutations, useLifeGoalProgress, useLifeGoalToday } from '@/data/lifegoal/lifegoalHooks'
import { MOCK_LIFE_GOALS } from '@/data/lifegoal/lifegoalMock'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

function renderDataHook<T>(hook: () => T) {
  return renderHook(hook, { wrapper: makeHookWrapper() })
}

describe('useLifeGoals (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('seeds the four prototype goals synchronously', () => {
    const { result } = renderHook(() => useLifeGoals(), { wrapper: makeHookWrapper() })
    expect(result.current.goals.map((g) => g.title)).toEqual(['Kockahas', 'Side hustle', 'Az utolsó barátnő', 'Spanyol B2'])
  })

  test('changeStatus parks a goal in the cache', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ q: useLifeGoals(), m: useLifeGoalMutations() }), { wrapper })
    act(() => result.current.m.changeStatus('lg-kockahas', 'parked'))
    await waitFor(() => expect(result.current.q.goals.find((g) => g.id === 'lg-kockahas')?.status).toBe('parked'))
  })
})

describe('useLifeGoals (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty while unresolved, then the fetched list', async () => {
    server.use(http.get(`${API_BASE}/api/life-goals`, () => HttpResponse.json([MOCK_LIFE_GOALS[0]])))
    const { result } = renderHook(() => useLifeGoals(), { wrapper: makeHookWrapper() })
    expect(result.current.goals).toEqual([])
    await waitFor(() => expect(result.current.goals).toHaveLength(1))
  })

  // mezo-iizd.1 final review, item 2: `create` used to only call `invalidateQueries`, which does
  // NOT refetch an inactive query — so the wizard's navigation to /me/goals/{id} landed on a list
  // that still lacked the new id and `useLifeGoal` rendered "Nincs ilyen cél.". The created goal
  // must be in the list cache the moment the mutation resolves, BEFORE any refetch.
  test('create seeds the list cache with the created goal', async () => {
    const created = { ...MOCK_LIFE_GOALS[0], id: 'lg-brand-new', title: 'Frissen mentett' }
    server.use(
      // The list read is deliberately never resolved: the only way the new goal can appear is
      // the explicit setQueryData in `create`'s real arm.
      http.get(`${API_BASE}/api/life-goals`, () => new Promise(() => {})),
      http.post(`${API_BASE}/api/life-goals`, () => HttpResponse.json(created, { status: 201 })),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ q: useLifeGoals(), m: useLifeGoalMutations() }), { wrapper })
    act(() => result.current.m.create({ title: 'Frissen mentett', dimension: 'health', startDate: '2026-09-01' }))
    await waitFor(() => expect(result.current.q.goals.map((g) => g.id)).toContain('lg-brand-new'))
  })

  // mezo-iizd.1 final review, item 3: a failed list read must be distinguishable from an empty one.
  test('exposes isError and a working refetch when the list read fails', async () => {
    let calls = 0
    server.use(http.get(`${API_BASE}/api/life-goals`, () => { calls += 1; return new HttpResponse(null, { status: 500 }) }))
    const { result } = renderHook(() => useLifeGoals(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.goals).toEqual([])
    const before = calls
    await act(async () => { await result.current.refetch() })
    expect(calls).toBeGreaterThan(before)
  })
})

describe('useLifeGoalProgress / useLifeGoalToday (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('useLifeGoalProgress returns 28 days per pillar', async () => {
    const { result } = renderDataHook(() => useLifeGoalProgress(MOCK_LIFE_GOALS[0].id))
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.progress?.pillars[0]?.days).toHaveLength(28)
  })

  test('useLifeGoalToday lists only active goals', async () => {
    const { result } = renderDataHook(() => useLifeGoalToday())
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.today.goals.length).toBeGreaterThan(0)
    expect(result.current.today.goals.every((g) => g.days7.length === 7)).toBe(true)
  })
})

describe('useLifeGoalProgress / useLifeGoalToday (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('useLifeGoalProgress fetches the 28-day window from the backend', async () => {
    const { result } = renderDataHook(() => useLifeGoalProgress(MOCK_LIFE_GOALS[0].id))
    expect(result.current.progress).toBeNull()
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.progress?.goalId).toBe(MOCK_LIFE_GOALS[0].id)
    expect(result.current.progress?.pillars[0]?.days).toHaveLength(28)
  })

  test('useLifeGoalToday fetches today summary from the backend', async () => {
    const { result } = renderDataHook(() => useLifeGoalToday())
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.today.goals.length).toBeGreaterThan(0)
  })
})
