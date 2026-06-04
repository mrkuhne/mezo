import { renderHook } from '@testing-library/react'
import { useFuelDay, useFuelTimeline, useStack, useProtocol } from './hooks'

test('useFuelDay returns macros, 4 meals, micronutrients', () => {
  const { result } = renderHook(() => useFuelDay())
  expect(result.current.fuel.targets.kcal).toBe(3100)
  expect(result.current.fuel.meals).toHaveLength(4)
  expect(result.current.fuel.meals[0].breakdown?.dimensions).toHaveLength(4)
  expect(result.current.fuel.meals[3].score).toBeNull()
  expect(result.current.fuel.micronutrients).toHaveLength(5)
})
test('useFuelTimeline returns 10 slots with one now-slot + getScoredMeal works', () => {
  const { result } = renderHook(() => useFuelTimeline())
  expect(result.current.plan.slots).toHaveLength(10)
  expect(result.current.plan.slots.filter(s => s.state === 'now')).toHaveLength(1)
  // NOTE: in the prototype data only kind==='meal' done slots map to a scored meal
  // (e.g. the 06:20 'snack' done slot has a mealName but no matching scored meal).
  const mealSlot = result.current.plan.slots.find(s => s.kind === 'meal' && s.mealName && s.state === 'done')!
  expect(result.current.getScoredMeal(mealSlot)?.breakdown).toBeDefined()
})
test('useStack returns 10 stash items, useProtocol returns v3', () => {
  // NOTE: task text said 11, but prototype data.js 337–348 has 10 stash items — data is source of truth.
  expect(renderHook(() => useStack()).result.current.stash).toHaveLength(10)
  expect(renderHook(() => useProtocol()).result.current.protocol.version).toBe(3)
})
