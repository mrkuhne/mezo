import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMealCoach, useMealCoachFor } from '@/data/fuel/coachHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

const MEAL_ID = '11111111-1111-1111-1111-111111111111'

const dayResponse = {
  verdicts: [{
    mealId: MEAL_ID,
    tagline: 'Remek pre-workout üzemanyag',
    summary: 'Gyors szénhidrát a Pull nap előtt.',
    improve: [{ text: 'Tegyél mellé 20g fehérjét', impact: '+fehérje' }],
  }],
}

afterEach(() => vi.unstubAllEnvs())

describe('useMealCoach (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('keys the day verdicts by mealId', async () => {
    server.use(http.get(`${API_BASE}/api/meal/coach`, () => HttpResponse.json(dayResponse)))

    const { result } = renderHook(() => useMealCoach('2026-07-27'), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.verdicts[MEAL_ID].tagline).toBe('Remek pre-workout üzemanyag')
    expect(result.current.verdicts[MEAL_ID].improve).toHaveLength(1)
  })

  it('serves an empty map when the coach produced nothing (off/unavailable is normal)', async () => {
    server.use(http.get(`${API_BASE}/api/meal/coach`, () => HttpResponse.json({ verdicts: [] })))

    const { result } = renderHook(() => useMealCoach('2026-07-27'), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.verdicts).toEqual({})
  })
})

describe('useMealCoachFor (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('returns the single meal verdict', async () => {
    server.use(http.get(`${API_BASE}/api/meal/${MEAL_ID}/coach`,
      () => HttpResponse.json(dayResponse)))

    const { result } = renderHook(() => useMealCoachFor(MEAL_ID), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.verdict).not.toBeNull())
    expect(result.current.verdict?.summary).toBe('Gyors szénhidrát a Pull nap előtt.')
  })

  it('stays null (and not pending) without a meal id — a closed sheet fetches nothing', () => {
    const { result } = renderHook(() => useMealCoachFor(null), { wrapper: wrapper() })

    expect(result.current.verdict).toBeNull()
    expect(result.current.isPending).toBe(false)
  })
})

describe('useMealCoach (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves canned prose without any backend', () => {
    const { result } = renderHook(() => useMealCoach('2026-07-27'), { wrapper: wrapper() })

    expect(result.current.verdicts['meal-1'].tagline).toBe('Remek pre-workout üzemanyag')
  })
})
