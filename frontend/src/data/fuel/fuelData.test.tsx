import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { useFuelDay, useFuelTimeline, useStack, useProtocol } from '@/data/hooks'
import type { FuelSlot } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'

// useFuelDay became a composed dual-mode TanStack query (mezo-arb). Pin mock mode so it returns
// the static Phase-1 seed synchronously (initialData) and wrap in QueryWrapper for the client.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('useFuelDay returns macros, 4 meals, micronutrients', () => {
  const { result } = renderHook(() => useFuelDay(), { wrapper: QueryWrapper })
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
  // useStack/useProtocol became dual-mode TanStack queries (mezo-09g) — they need a QueryClient.
  expect(renderHook(() => useStack(), { wrapper: QueryWrapper }).result.current.stash).toHaveLength(10)
  expect(renderHook(() => useProtocol(), { wrapper: QueryWrapper }).result.current.protocol.version).toBe(3)
})

test('every seed meal carries structured mealItems + mealDate and a null pending score', async () => {
  const { fuelDay } = await import('@/data/fuel/fuel')
  for (const m of fuelDay.meals) {
    expect(Array.isArray(m.mealItems)).toBe(true)
    expect(m.mealItems.length).toBeGreaterThan(0)
    expect(m.mealItems[0]).toHaveProperty('source')
    expect(m.mealItems[0]).toHaveProperty('contribution')
    expect(typeof m.mealDate).toBe('string')
    expect(typeof m.loggedAt).toBe('string')
    expect(m.score).toBeNull()
  }
})

test('getScoredMeal resolves a slot by mealId (id-join, not title-join)', async () => {
  const { getScoredMeal, fuelDay } = await import('@/data/fuel/fuel')
  const slot: FuelSlot = { time: '09:15', kind: 'meal', label: 'Reggeli', state: 'done', mealId: 'm1' }
  const meal = getScoredMeal(slot, fuelDay.meals)
  expect(meal?.id).toBe('m1')
  expect(meal?.breakdown).toBeDefined()
})

test('getScoredMeal returns null for a slot with a matching title but NO mealId (title-join is dead)', async () => {
  const { getScoredMeal, fuelDay } = await import('@/data/fuel/fuel')
  const slot: FuelSlot = { time: '09:15', kind: 'meal', label: 'Reggeli', state: 'done', mealName: 'Túrós zabkása · áfonyával' }
  expect(getScoredMeal(slot, fuelDay.meals)).toBeNull()
})

test('toMin/toHHmm convert and clamp HH:mm ↔ minutes', async () => {
  const { toMin, toHHmm } = await import('@/data/fuel/fuelConfig')
  expect(toMin('07:30')).toBe(450)
  expect(toHHmm(450)).toBe('07:30')
  expect(toHHmm(-10)).toBe('00:00')
  expect(toHHmm(2000)).toBe('23:59')
})
