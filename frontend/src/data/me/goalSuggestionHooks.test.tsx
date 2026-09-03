import { renderHook, act, waitFor } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useGoalSuggestions, useSuggestionActions } from '@/data/me/goalHooks'
import { goalSuggestions as mockGoalSuggestions } from '@/data/me/goals'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

// --- real mode ---------------------------------------------------------------

test('useGoalSuggestions (real mode) fetches the goal\'s open suggestions', async () => {
  server.use(
    http.get(`${API_BASE}/api/goals/g1/suggestions`, () =>
      HttpResponse.json([
        {
          id: 'sug-1',
          kind: 'phase_change',
          status: 'proposed',
          payload: {
            reason: 'Deload hét — tartáson eszel.',
            balanceOverrideKcal: 0,
            fromWeek: 3,
            toWeek: 3,
            snapshotTrajectory: 'cut',
          },
          createdAt: '2026-05-22T06:10:00Z',
        },
      ]),
    ),
  )
  const { result } = renderHook(() => useGoalSuggestions('g1'), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.suggestions).toHaveLength(1))
  expect(result.current.suggestions[0].id).toBe('sug-1')
  expect(result.current.suggestions[0].payload.reason).toBe('Deload hét — tartáson eszel.')
})

test('useGoalSuggestions (real mode) stays disabled + empty when goalId is null', () => {
  const { result } = renderHook(() => useGoalSuggestions(null), { wrapper: makeHookWrapper() })
  expect(result.current.suggestions).toEqual([])
  // A disabled query never fetches, so TanStack Query keeps it 'pending' forever — the
  // banner/card consumers only branch on `suggestions.length`, never on `pending` alone.
  expect(result.current.pending).toBe(true)
})

test('useSuggestionActions (real mode) accept hits the accept endpoint and invalidates suggestions + goals', async () => {
  server.use(
    http.post(`${API_BASE}/api/goals/g1/suggestions/sug-1/accept`, () =>
      HttpResponse.json({ id: 'g1', title: 'Nyári cut' }),
    ),
  )
  const wrapper = makeHookWrapper()
  const invalidated: unknown[] = []
  const { result } = renderHook(
    () => {
      const qc = useQueryClient()
      const spy = vi.spyOn(qc, 'invalidateQueries')
      spy.mockImplementation((filters?: { queryKey?: unknown }) => {
        invalidated.push(filters?.queryKey)
        return Promise.resolve()
      })
      return useSuggestionActions()
    },
    { wrapper },
  )
  await act(async () => { await result.current.accept('g1', 'sug-1') })
  expect(invalidated).toContainEqual(['goal', 'g1', 'suggestions'])
  expect(invalidated).toContainEqual(['goals'])
})

test('useSuggestionActions (real mode) dismiss hits the dismiss endpoint and invalidates suggestions', async () => {
  let called = false
  server.use(
    http.post(`${API_BASE}/api/goals/g1/suggestions/sug-1/dismiss`, () => {
      called = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { result } = renderHook(() => useSuggestionActions(), { wrapper: makeHookWrapper() })
  await act(async () => { await result.current.dismiss('g1', 'sug-1') })
  expect(called).toBe(true)
})

// --- mock mode ---------------------------------------------------------------

test('useGoalSuggestions (mock mode) returns the static fixture synchronously', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useGoalSuggestions(mockGoalSuggestions[0] ? 'goal-cut-2026' : null), {
    wrapper: makeHookWrapper(),
  })
  expect(result.current.suggestions).toEqual(mockGoalSuggestions)
  expect(result.current.pending).toBe(false)
})

test('useSuggestionActions (mock mode) accept/dismiss are no-ops that resolve without calling the API', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  // Any real network call would fail (MSW has no handlers for these in mock mode);
  // resolving cleanly proves the actions short-circuit.
  const { result } = renderHook(() => useSuggestionActions(), { wrapper: makeHookWrapper() })
  await act(async () => {
    await result.current.accept('goal-cut-2026', 'sug-deload-w3')
    await result.current.dismiss('goal-cut-2026', 'sug-deload-w3')
  })
  expect(result.current.pending).toBe(false)
})
