// ============================================================
// Mezo · fuelSwimlane tests (Design 2.0 F3.1, mezo-d20.4.1) — the hub's window
// lane view-model. The honest-state contracts are the spec: a budget-only window
// never claims "a tervből", a fresh (unscored) log carries no fake score, a
// breakdown-less done meal offers no dead score tap, and a missing macro renders
// as 0 g of the ring rather than a fabricated number.
// ============================================================
import { describe, expect, test } from 'vitest'
import { buildWindowLane, asPastDayLane, type WindowLaneVM, type WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import type { FuelMeal, FuelSlot } from '@/data/types'

const budget: DayBudget = {
  kcal: 2400, p: 180, c: 240, f: 72,
  energy: { base: 2000, activity: 400, balance: 0, target: 2400 },
}

const meal = (over: Partial<FuelMeal> = {}): FuelMeal => ({
  id: 'm1', slot: 'breakfast', title: 'Skyr-bowl zabbal', score: 0.88,
  kcal: 420, p: 36, c: 48, f: 9,
  mealItems: [], items: [], tags: [],
  ...over,
} as FuelMeal)

const slot = (over: Partial<FuelSlot> = {}): FuelSlot => ({
  time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending',
  kcal: 400, p: 30, c: 40, f: 10,
  ...over,
})

test('one tile per user-scheduled eating window, chronological; non-meal slots never enter the lane', () => {
  const { tiles } = buildWindowLane({
    slots: [
      slot({ time: '19:00', label: 'Vacsora', slotKey: 'dinner' }),
      slot({ time: '07:30', label: 'Reggeli', slotKey: 'breakfast' }),
      { time: '18:00', kind: 'workout', label: 'Pull A', state: 'pending' },
    ],
    budget, meals: [],
  })
  expect(tiles.map(t => t.label)).toEqual(['Reggeli', 'Vacsora'])
  expect(tiles.map(t => t.icon)).toEqual(['i-reggeli', 'i-vacsora'])
})

test('every slotKey maps to its own clay window icon', () => {
  const { tiles } = buildWindowLane({
    slots: [
      slot({ time: '07:30', label: 'Reggeli', slotKey: 'breakfast' }),
      slot({ time: '10:30', label: 'Tízórai', slotKey: 'snack' }),
      slot({ time: '13:00', label: 'Ebéd', slotKey: 'lunch' }),
      slot({ time: '19:00', label: 'Vacsora', slotKey: 'dinner' }),
    ],
    budget, meals: [],
  })
  expect(tiles.map(t => t.icon)).toEqual(['i-reggeli', 'i-snack', 'i-ebed', 'i-vacsora'])
})

test('slot state maps 1:1 to the tile state — pending becomes future, nowKey follows the now window', () => {
  const { tiles, nowKey } = buildWindowLane({
    slots: [
      slot({ time: '07:30', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealId: 'm1' }),
      slot({ time: '10:30', label: 'Tízórai', slotKey: 'snack', state: 'missed' }),
      slot({ time: '13:00', label: 'Ebéd', slotKey: 'lunch', state: 'now' }),
      slot({ time: '19:00', label: 'Vacsora', slotKey: 'dinner', state: 'pending' }),
    ],
    budget, meals: [meal()],
  })
  expect(tiles.map(t => t.state)).toEqual(['done', 'missed', 'now', 'future'])
  expect(nowKey).toBe('13:00-Ebéd')
})

test('no open window → no nowKey (nothing for the lane to scroll to)', () => {
  const { nowKey } = buildWindowLane({
    slots: [slot({ state: 'done', mealId: 'm1' })],
    budget, meals: [meal()],
  })
  expect(nowKey).toBeNull()
})

test('the three mini rings fill against the DAILY macro target, capped at 100%', () => {
  const { tiles } = buildWindowLane({
    slots: [slot({ state: 'now', p: 45, c: 60, f: 18 })],
    budget, meals: [],
  })
  expect(tiles[0].rings.map(r => [r.key, r.grams, r.pct])).toEqual([
    ['p', 45, 25], // 45 / 180
    ['c', 60, 25], // 60 / 240
    ['f', 18, 25], // 18 / 72
  ])
  expect(tiles[0].rings.map(r => r.color))
    .toEqual(['var(--macro-protein)', 'var(--macro-carbs)', 'var(--macro-fat)'])
})

test('a done window reads its macros + kcal off the LOGGED meal, not the window budget', () => {
  const { tiles } = buildWindowLane({
    slots: [slot({ state: 'done', mealId: 'm1', kcal: 400, p: 30, c: 40, f: 10 })],
    budget, meals: [meal({ kcal: 420, p: 36, c: 48, f: 9 })],
  })
  expect(tiles[0].kcal).toBe(420)
  expect(tiles[0].rings.map(r => r.grams)).toEqual([36, 48, 9])
  expect(tiles[0].name).toBe('Skyr-bowl zabbal') // slot.mealName absent → the logged meal's own name
})

test('a done window prefers the slot mealName, then the logged meal display name', () => {
  const withName = buildWindowLane({
    slots: [slot({ state: 'done', mealId: 'm1', mealName: 'Túrós zabkása' })],
    budget, meals: [meal()],
  })
  expect(withName.tiles[0].name).toBe('Túrós zabkása')
  expect(withName.tiles[0].ghost).toBe(false)

  const derived = buildWindowLane({
    slots: [slot({ state: 'done', mealId: 'm1' })],
    budget, meals: [meal({ title: 'Skyr-bowl' })],
  })
  expect(derived.tiles[0].name).toBe('Skyr-bowl')
})

test('honest kcal: a window the composition carries no kcal for renders null, never 0', () => {
  const { tiles } = buildWindowLane({
    slots: [{ time: '16:30', kind: 'snack', label: 'Uzsonna', slotKey: 'snack', state: 'future' as never }],
    budget, meals: [],
  })
  expect(tiles[0].kcal).toBeNull()
  expect(tiles[0].rings.map(r => r.grams)).toEqual([0, 0, 0])
})

test('"a tervből" is only honest with a real plan suggestion — a budget-only window is not fromPlan', () => {
  const { tiles } = buildWindowLane({
    slots: [
      slot({ time: '13:00', label: 'Ebéd', slotKey: 'lunch', state: 'now', mealName: 'Csirkés bowl', suggestedRecipeId: 'r-1' }),
      slot({ time: '19:00', label: 'Vacsora', slotKey: 'dinner', state: 'future' as never }),
    ],
    budget, meals: [],
  })
  expect(tiles[0].fromPlan).toBe(true)
  expect(tiles[0].ghost).toBe(false)
  expect(tiles[1].fromPlan).toBe(false)
  expect(tiles[1].ghost).toBe(true) // nothing planned → the name is only the window label
})

test('a fresh (unscored) log carries no score — the tile says "folyamatban", never a fake 0', () => {
  const { tiles } = buildWindowLane({
    slots: [slot({ state: 'done', mealId: 'm1' })],
    budget, meals: [meal({ score: null })],
  })
  expect(tiles[0].scorePct).toBeNull()
  expect(tiles[0].scorable).toBe(false)
})

test('a scored done meal exposes its percent; only a meal WITH a breakdown is tappable', () => {
  const noBreakdown = buildWindowLane({
    slots: [slot({ state: 'done', mealId: 'm1' })],
    budget, meals: [meal({ score: 0.91 })],
  })
  expect(noBreakdown.tiles[0].scorePct).toBe(91)
  expect(noBreakdown.tiles[0].scorable).toBe(false)

  const withBreakdown = buildWindowLane({
    slots: [slot({ state: 'done', mealId: 'm1' })],
    budget, meals: [meal({ score: 0.91, breakdown: { } as never })],
  })
  expect(withBreakdown.tiles[0].scorable).toBe(true)
  expect(withBreakdown.tiles[0].mealId).toBe('m1')
})

test('a still-open window never carries a mealId or a score', () => {
  const { tiles } = buildWindowLane({
    slots: [slot({ state: 'now', mealId: 'm1' })],
    budget, meals: [meal({ score: 0.9 })],
  })
  expect(tiles[0].mealId).toBeNull()
  expect(tiles[0].scorePct).toBeNull()
})

test('a zero macro target never produces NaN — the ring reads 0%', () => {
  const { tiles } = buildWindowLane({
    slots: [slot({ state: 'now', p: 30 })],
    budget: { ...budget, p: 0, c: 0, f: 0 },
    meals: [],
  })
  expect(tiles[0].rings.every(r => Number.isFinite(r.pct))).toBe(true)
  expect(tiles[0].rings[0].pct).toBe(0)
})

const tile = (over: Partial<WindowTileVM>): WindowTileVM => ({
  key: '07:30-Reggeli', slotKey: 'breakfast', state: 'future', icon: 'i-reggeli',
  label: 'Reggeli', time: '07:30', name: 'Reggeli', ghost: true, fromPlan: false,
  kcal: null, rings: [], mealId: null, scorePct: null, scorable: false, ...over,
})

describe('asPastDayLane', () => {
  test('now és future tile missed-re normalizálódik, done marad, nowKey null', () => {
    const vm: WindowLaneVM = {
      tiles: [
        tile({ key: 'a', state: 'done', mealId: 'm1' }),
        tile({ key: 'b', state: 'now' }),
        tile({ key: 'c', state: 'missed' }),
        tile({ key: 'd', state: 'future' }),
      ],
      nowKey: 'b',
    }
    const past = asPastDayLane(vm)
    expect(past.tiles.map(t => t.state)).toEqual(['done', 'missed', 'missed', 'missed'])
    expect(past.nowKey).toBeNull()
    // minden más mező változatlan (a done tile mealId-je is)
    expect(past.tiles[0].mealId).toBe('m1')
  })

  test('üres lane identitás-szerű: üres tiles + null nowKey', () => {
    expect(asPastDayLane({ tiles: [], nowKey: null })).toEqual({ tiles: [], nowKey: null })
  })
})
