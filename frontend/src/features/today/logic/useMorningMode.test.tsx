import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { normalizeDayEvaluation, mockDayEvaluation, mockDayEvaluationDates } from '@/data/me/dayEvaluation'
import { markSeen } from '@/features/today/logic/napom'
import { useMorningMode } from '@/features/today/logic/useMorningMode'

describe('useMorningMode', () => {
  test('flips to false the moment markSeen runs — no unrelated re-render needed', () => {
    const y = normalizeDayEvaluation(mockDayEvaluation(mockDayEvaluationDates.scored))
    const { result } = renderHook(() => useMorningMode(y))
    expect(result.current).toBe(true)
    act(() => markSeen(y.date))
    expect(result.current).toBe(false)
  })

  test('no evaluation yet → not morning', () => {
    const { result } = renderHook(() => useMorningMode(null))
    expect(result.current).toBe(false)
  })
})
