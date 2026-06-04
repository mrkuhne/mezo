import { renderHook } from '@testing-library/react'
import { useProfile, useGoals, useSleep } from './hooks'

test('useProfile returns the extended user + Profil consts', () => {
  const { result } = renderHook(() => useProfile())
  expect(result.current.user.name).toBe('Daniel')
  expect(result.current.user.streakDays).toBe(27)
  expect(result.current.identityGoal.quote).toMatch(/Peak performance/)
  expect(result.current.areas).toHaveLength(4)
  expect(result.current.quickSettings).toHaveLength(4)
  expect(result.current.version).toMatch(/v2\.0\.1/)
})

test('useGoals returns the active cut goal + trends + linked mesocycles', () => {
  const { result } = renderHook(() => useGoals())
  expect(result.current.goal.kind).toBe('cut')
  expect(result.current.goal.currentWeight).toBe(78.6)
  expect(result.current.weightLog.length).toBe(15)
  expect(result.current.weightTrends.factors).toHaveLength(4)
  expect(result.current.linkedMesocycles['meso-hyp-04'].status).toBe('active')
})

test('useSleep returns the log, trends, and last night', () => {
  const { result } = renderHook(() => useSleep())
  expect(result.current.sleepLog.length).toBe(14)
  expect(result.current.lastNight.duration).toBe(7.4)
  expect(result.current.sleepTrends.target.duration).toBe(7.5)
})
