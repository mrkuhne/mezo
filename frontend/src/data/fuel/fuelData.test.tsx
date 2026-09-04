import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { useFuelDay, useFuelTimeline, useStack, useProtocol } from '@/data/hooks'
import type { FuelSlot } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'

// useFuelDay became a composed dual-mode TanStack query (mezo-arb). Pin mock mode so it returns
// the static Phase-1 seed synchronously (initialData) and wrap in QueryWrapper for the client.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('useFuelDay returns macros, 3 logged meals, micronutrients', () => {
  // The mock's CLOCK is 13:30 (MOCK_NOW_HHMM, mezo-1oy5): breakfast + lunch are logged before
  // `now`, and since fix-round-1 F1 (mezo-jcpt.3) a third meal — a coherent late-miss dinner
  // (`m4`, logged 23:35, after `now`) — is ALSO already logged, exercising the timing strip's
  // out-of-window rendering in the live mock app. The midday/evening WINDOWS still open before
  // `now` remain now/pending in the computed plan; a logged meal fills its own window purely off
  // its presence (buildDayPlan.ts step 3), never off the clock.
  const { result } = renderHook(() => useFuelDay(), { wrapper: QueryWrapper })
  expect(result.current.fuel.targets.kcal).toBe(3100)
  expect(result.current.fuel.meals).toHaveLength(3)
  expect(result.current.fuel.meals[0].breakdown?.dimensions).toHaveLength(8)
  // Both seed meals now carry a real score — Σ(weight × dimension.score) off their OWN breakdown
  // (fix wave item 10), never a null placeholder or a fabricated flat number.
  expect(result.current.fuel.meals[1].score).toBeCloseTo(0.91, 2)
  expect(result.current.fuel.micronutrients).toHaveLength(5)
})
test('useFuelTimeline returns a computed plan with one now-slot + getScoredMeal works', () => {
  // useFuelTimeline became a composed dual-mode hook (mezo-9ys) — it calls useFuelDay/useGoal/…
  // TanStack queries, so it needs a QueryClient even in mock mode (all seed synchronously).
  // Since mezo-53su the mock plan is COMPUTED (buildDayPlan over the mock data); the slot count
  // varies with the real weekday's blocks, so assert the contract, not a pinned count.
  const { result } = renderHook(() => useFuelTimeline(), { wrapper: QueryWrapper })
  expect(result.current.plan.slots.length).toBeGreaterThan(0)
  // Fixed-plan state (mezo-1oy5): the partial mock day at 13:30 has exactly one `now` MEAL window
  // (the next open meal/snack), never a supplement/block slot.
  const nowSlots = result.current.plan.slots.filter(s => s.state === 'now')
  expect(nowSlots).toHaveLength(1)
  expect(nowSlots[0].slotKey).toBeDefined() // the now-slot is a meal window, not a protocol/block slot
  // NOTE: in the prototype data only kind==='meal' done slots map to a scored meal
  // (e.g. the 06:20 'snack' done slot has a mealName but no matching scored meal).
  const mealSlot = result.current.plan.slots.find(s => s.kind === 'meal' && s.mealName && s.state === 'done')!
  expect(result.current.getScoredMeal(mealSlot)?.breakdown).toBeDefined()
})
test('useStack returns 9 stash items, useProtocol returns v3', () => {
  // NOTE: the mock stash is the source of truth — the generic aakg/betaalanin/caffeine200
  // trio was replaced by the two real stim products (Tasty Dose + Origin PWO), 10 → 9 (mezo-67rb).
  // useStack/useProtocol became dual-mode TanStack queries (mezo-09g) — they need a QueryClient.
  expect(renderHook(() => useStack(), { wrapper: QueryWrapper }).result.current.stash).toHaveLength(9)
  expect(renderHook(() => useProtocol(), { wrapper: QueryWrapper }).result.current.protocol.version).toBe(3)
})

test('every seed meal carries structured mealItems + mealDate and a score matching its own breakdown', async () => {
  const { fuelDay } = await import('@/data/fuel/fuel')
  for (const m of fuelDay.meals) {
    expect(Array.isArray(m.mealItems)).toBe(true)
    expect(m.mealItems.length).toBeGreaterThan(0)
    expect(m.mealItems[0]).toHaveProperty('source')
    expect(m.mealItems[0]).toHaveProperty('contribution')
    expect(typeof m.mealDate).toBe('string')
    expect(typeof m.loggedAt).toBe('string')
    // score is Σ(weight × dimension.score) off the meal's OWN breakdown (fix wave item 10) —
    // never null/fabricated; recompute it here so the seed can never silently drift from its
    // own dimensions.
    const expected = m.breakdown!.dimensions.reduce((sum, d) => sum + d.weight * d.score, 0)
    expect(m.score).toBeCloseTo(Math.round(expected * 100) / 100, 2)
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
