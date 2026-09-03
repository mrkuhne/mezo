// Day evaluation (mezo-jcpt.4) — useDayEvaluation, mock-mode render. Real-mode wiring is the
// same apiFetch/useQuery idiom every other me/* hook uses (meWeekHooks.ts precedent) and is
// exercised end-to-end by Task 10's page tests via MSW; this file covers the mock branch per
// the slice brief.
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDayEvaluation } from '@/data/me/dayEvaluationHooks'
import { mockDayEvaluation, mockDayEvaluationDates } from '@/data/me/dayEvaluation'
import { makeHookWrapper } from '@/test/queryWrapper'

describe('useDayEvaluation (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('returns the scored fixture synchronously, no loading frame', () => {
    const { result } = renderHook(() => useDayEvaluation(mockDayEvaluationDates.scored), { wrapper: makeHookWrapper() })
    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual(mockDayEvaluation(mockDayEvaluationDates.scored))
    expect(result.current.data?.dimensions).toHaveLength(6)
  })

  it('returns the in_progress fixture for its named date', async () => {
    const { result } = renderHook(() => useDayEvaluation(mockDayEvaluationDates.inProgress), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.state).toBe('in_progress')
    expect(result.current.data?.dimensions.filter((d) => d.status === 'DONE')).toHaveLength(2)
  })

  it('re-renders with the new date\'s fixture when the requested date changes', async () => {
    const { result, rerender } = renderHook(
      ({ date }: { date: string }) => useDayEvaluation(date),
      { wrapper: makeHookWrapper(), initialProps: { date: mockDayEvaluationDates.thin as string } },
    )
    expect(result.current.data?.state).toBe('thin')
    rerender({ date: mockDayEvaluationDates.future })
    await waitFor(() => expect(result.current.data?.state).toBe('future'))
  })
})
