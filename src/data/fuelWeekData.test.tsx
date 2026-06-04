import { renderHook } from '@testing-library/react'
import { useFuelWeek, useReplanScenarios } from './hooks'

test('useFuelWeek returns 7 reta days, gym schedule, supplement matrix, patterns', () => {
  const { result } = renderHook(() => useFuelWeek())
  expect(result.current.retaWeek).toHaveLength(7)
  expect(result.current.retaWeek[2].label).toBe('Stable')
  expect(result.current.gymSchedule).toHaveLength(7)
  expect(result.current.weeklySupplements.length).toBeGreaterThan(0)
  expect(result.current.patterns.length).toBe(4)
})

test('useReplanScenarios returns scenarios with cascades', () => {
  const { result } = renderHook(() => useReplanScenarios())
  expect(result.current.scenarios.length).toBeGreaterThan(0)
  expect(result.current.scenarios[0].cascades.length).toBeGreaterThan(0)
})
