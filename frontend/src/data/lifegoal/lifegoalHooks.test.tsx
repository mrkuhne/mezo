import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { API_BASE } from '@/data/_client/api'
import { useLifeGoals, useLifeGoalMutations } from '@/data/lifegoal/lifegoalHooks'
import { MOCK_LIFE_GOALS } from '@/data/lifegoal/lifegoalMock'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

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
})
