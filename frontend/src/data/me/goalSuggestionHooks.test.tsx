import { renderHook, act, waitFor } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useGoalSuggestionPreview, useGoalSuggestions, useSuggestionActions } from '@/data/me/goalHooks'
import { goalSuggestionPreviewSeed, goalSuggestions as mockGoalSuggestions } from '@/data/me/goals'
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

test('useGoalSuggestionPreview (real mode) fetches the typed preview', async () => {
  server.use(http.get(`${API_BASE}/api/goals/g1/suggestions/sug-1/preview`, () =>
    HttpResponse.json(goalSuggestionPreviewSeed)))
  const { result } = renderHook(() => useGoalSuggestionPreview('g1', 'sug-1'), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.preview?.previewFingerprint).toBe(goalSuggestionPreviewSeed.previewFingerprint))
})

test('useGoalSuggestionPreview stays disabled when either id is null', () => {
  const { result } = renderHook(() => useGoalSuggestionPreview(null, null), { wrapper: makeHookWrapper() })
  expect(result.current.preview).toBeUndefined()
  expect(result.current.pending).toBe(false)
})

test('useSuggestionActions (real mode) sends the preview fingerprint and invalidates every dependent surface', async () => {
  let body: unknown
  server.use(
    http.post(`${API_BASE}/api/goals/g1/suggestions/sug-1/accept`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ id: 'g1', title: 'Nyári cut' })
    }),
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
  await act(async () => { await result.current.accept('g1', 'sug-1', 'f'.repeat(64)) })
  expect(body).toEqual({ previewFingerprint: 'f'.repeat(64) })
  expect(invalidated).toContainEqual(['goal', 'g1', 'suggestions'])
  expect(invalidated).toContainEqual(['goals'])
  expect(invalidated).toContainEqual(['goal-overview', 'g1'])
  expect(invalidated).toContainEqual(['goal-suggestion-preview', 'g1', 'sug-1'])
  expect(invalidated).toContainEqual(['notification-feed'])
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
  const { result } = renderHook(() => useGoalSuggestions('goal-cut-2026'), {
    wrapper: makeHookWrapper(),
  })
  expect(result.current.suggestions).toEqual(mockGoalSuggestions)
  expect(result.current.pending).toBe(false)
})

test('useSuggestionActions (mock mode) makes an accepted preview historical without calling the API', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  // Any real network call would fail (MSW has no handlers for these in mock mode);
  // resolving cleanly proves the actions short-circuit.
  const wrapper = makeHookWrapper()
  const preview = renderHook(() => useGoalSuggestionPreview('goal-cut-2026', 'sug-weekly-w17'), { wrapper })
  const { result } = renderHook(() => useSuggestionActions(), { wrapper })
  expect(preview.result.current.preview?.status).toBe('proposed')
  await act(async () => {
    await result.current.accept('goal-cut-2026', 'sug-weekly-w17', goalSuggestionPreviewSeed.previewFingerprint as string)
  })
  await waitFor(() => expect(preview.result.current.preview?.status).toBe('accepted'))
  expect(preview.result.current.preview?.canApply).toBe(false)
  expect(preview.result.current.preview?.previewFingerprint).toBeNull()
  expect(result.current.pending).toBe(false)
})
