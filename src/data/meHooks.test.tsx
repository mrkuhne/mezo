import { renderHook, act } from '@testing-library/react'
import { useGoals } from './hooks'

test('useGoals.logWeight appends a mapped WeightEntry to the log', () => {
  const { result } = renderHook(() => useGoals())
  const before = result.current.weightLog.length
  act(() => {
    result.current.logWeight({ date: '2026-06-08', weightKg: 71.9, note: 'teszt' })
  })
  expect(result.current.weightLog.length).toBe(before + 1)
  const last = result.current.weightLog[result.current.weightLog.length - 1]
  expect(last).toMatchObject({ date: '2026-06-08', value: 71.9, note: 'teszt' })
})
