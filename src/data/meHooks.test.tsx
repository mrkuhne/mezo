import { renderHook, act } from '@testing-library/react'
import { useGoals } from './hooks'
import { useSleep } from './hooks'

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

test('useSleep.logSleep appends a mapped SleepEntry', () => {
  const { result } = renderHook(() => useSleep())
  const before = result.current.sleepLog.length
  act(() => {
    result.current.logSleep({
      date: '2026-06-08', bedtime: '23:00', wakeup: '06:30',
      durationH: 7.5, quality: 8, awakenings: 1, note: 'jó',
    })
  })
  expect(result.current.sleepLog.length).toBe(before + 1)
  expect(result.current.lastNight).toMatchObject({ duration: 7.5, quality: 8, awakenings: 1, notes: 'jó' })
})
