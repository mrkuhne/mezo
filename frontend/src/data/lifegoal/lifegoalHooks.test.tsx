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

  test('mock seed lists goals newest-first like the backend createdAt DESC ordering', () => {
    const { result } = renderHook(() => useLifeGoals(), { wrapper: makeHookWrapper() })
    expect(result.current.goals.map((g) => g.title)).toEqual(['Side hustle', 'Kockahas', 'Az utolsó barátnő', 'Spanyol B2', 'Félmaraton'])
  })

  test('changeStatus parks a goal in the cache', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ q: useLifeGoals(), m: useLifeGoalMutations() }), { wrapper })
    act(() => result.current.m.changeStatus('lg-kockahas', 'parked'))
    await waitFor(() => expect(result.current.q.goals.find((g) => g.id === 'lg-kockahas')?.status).toBe('parked'))
  })

  test('mock changeStatus rejects an illegal transition like the backend (draft → done)', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ q: useLifeGoals(), m: useLifeGoalMutations() }), { wrapper })
    act(() => result.current.m.create({ title: 'Draft cél', dimension: 'health', startDate: '2026-09-01' }))
    await waitFor(() => expect(result.current.q.goals.some((g) => g.title === 'Draft cél')).toBe(true))
    const draftId = result.current.q.goals.find((g) => g.title === 'Draft cél')!.id
    let error: unknown
    act(() => result.current.m.changeStatus(draftId, 'done', { onError: () => { error = true } }))
    await waitFor(() => expect(error).toBe(true))
    expect(result.current.q.goals.find((g) => g.id === draftId)?.status).toBe('draft')
  })

  test('mock changeStatus is a no-op for same-status (active → active), not an error', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ q: useLifeGoals(), m: useLifeGoalMutations() }), { wrapper })
    let error: unknown = false
    act(() => result.current.m.changeStatus('lg-kockahas', 'active', { onError: () => { error = true } }))
    await waitFor(() => expect(result.current.q.goals.find((g) => g.id === 'lg-kockahas')?.status).toBe('active'))
    expect(error).toBe(false)
  })

  test('mock changeStatus keeps closedAt on done → archived', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ q: useLifeGoals(), m: useLifeGoalMutations() }), { wrapper })
    const before = result.current.q.goals.find((g) => g.id === 'lg-felmarathon')!.closedAt
    act(() => result.current.m.changeStatus('lg-felmarathon', 'archived'))
    await waitFor(() => expect(result.current.q.goals.find((g) => g.id === 'lg-felmarathon')?.status).toBe('archived'))
    expect(result.current.q.goals.find((g) => g.id === 'lg-felmarathon')?.closedAt).toBe(before)
  })

  test('mock create rejects a 6th pillar (LIFE_GOAL_TOO_MANY_PILLARS)', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => useLifeGoalMutations(), { wrapper })
    const pillar = { label: 'X', skillKey: 'mindset', kind: 'habit' as const, weight: 1, active: true, source: { type: 'habit' as const }, rule: {} }
    let error: unknown
    act(() => result.current.create(
      { title: 'Sok pillér', dimension: 'health', startDate: '2026-09-01', pillars: [pillar, pillar, pillar, pillar, pillar, pillar] },
      { onError: () => { error = true } },
    ))
    await waitFor(() => expect(error).toBe(true))
  })

  test('mock create rejects a kind the catalog entry does not allow (kind=linked on sleep_duration)', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => useLifeGoalMutations(), { wrapper })
    const pillar = { label: 'Alvás', skillKey: 'recovery', kind: 'linked' as const, weight: 1, active: true, source: { type: 'metric' as const, key: 'SLEEP_DURATION_H' }, rule: {} }
    let error: unknown
    act(() => result.current.create(
      { title: 'Rossz kind', dimension: 'health', startDate: '2026-09-01', pillars: [pillar] },
      { onError: () => { error = true } },
    ))
    await waitFor(() => expect(error).toBe(true))
  })

  test('mock update full-replaces: an omitted whyText/targetDate/obstacleText is cleared, frame defaults to unset', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ q: useLifeGoals(), m: useLifeGoalMutations() }), { wrapper })
    act(() => result.current.m.update('lg-kockahas', { title: 'Kockahas', dimension: 'health', startDate: '2026-08-10' }))
    await waitFor(() => expect(result.current.q.goals.find((g) => g.id === 'lg-kockahas')?.whyText).toBeUndefined())
    const g = result.current.q.goals.find((g) => g.id === 'lg-kockahas')
    expect(g?.targetDate).toBeUndefined()
    expect(g?.obstacleText).toBeUndefined()
    expect(g?.frame).toBe('unset')
    expect(g?.status).toBe('active')
    expect(g?.pillars.length).toBeGreaterThan(0)
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
