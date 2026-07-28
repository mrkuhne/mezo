import { pickHeroWindow } from '@/features/fuel/logic/heroWindow'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { FuelSlot } from '@/data/types'

const BUDGET = { kcal: 3010, p: 185, c: 265 }
const CONSUMED = { kcal: 790, p: 58 }
const GYM: PlannerBlock = { kind: 'gym', time: '17:00', durationMin: 90, label: 'Pull Day' }

const slot = (over: Partial<FuelSlot> = {}): FuelSlot => ({
  time: '13:00', kind: 'meal', label: 'Ebéd', slotKey: 'lunch', state: 'now',
  kcal: 900, p: 68, c: 105, f: 24, ...over,
})

const pick = (slots: FuelSlot[], blocks: PlannerBlock[] = []) =>
  pickHeroWindow({ slots, blocks, budget: BUDGET, consumed: CONSUMED })

test('the now window with a recipe suggestion becomes an open hero', () => {
  const now = slot({ mealName: 'Csirkés rizs bowl', suggestedRecipeId: 'r1' })
  const { hero } = pick([now])
  expect(hero.kind).toBe('open')
  if (hero.kind !== 'open') throw new Error('unreachable')
  expect(hero.suggestion).toBe(true)
  expect(hero.slot).toBe(now)
})

test('the why line names the next training block and the carb share', () => {
  const { hero } = pick([slot({ mealName: 'Csirkés rizs bowl', suggestedRecipeId: 'r1' })], [GYM])
  if (hero.kind !== 'open') throw new Error('unreachable')
  // 105 / 265 = 39.6% → 40
  expect(hero.why).toBe('Pull Day 17:00 — ez az ablak viszi a napi szénhidrát 40%-át')
})

test('with no later training block the why line falls back to the window budget', () => {
  const { hero } = pick([slot({ time: '19:00' })], [GYM])
  if (hero.kind !== 'open') throw new Error('unreachable')
  expect(hero.why).toBe('900 kcal ebben az ablakban — 68 g fehérje a napi célhoz')
})

test('a macro-less window never prints a NaN share', () => {
  const { hero } = pick([slot({ c: undefined, p: undefined })], [GYM])
  if (hero.kind !== 'open') throw new Error('unreachable')
  expect(hero.why).toBe('900 kcal ebben az ablakban')
  expect(hero.why).not.toMatch(/NaN/)
})

test('an open window without a suggestion is flagged suggestion:false', () => {
  const { hero } = pick([slot()])
  if (hero.kind !== 'open') throw new Error('unreachable')
  expect(hero.suggestion).toBe(false)
})

test('no now window → a closed summary hero with the day totals', () => {
  const { hero } = pick([slot({ state: 'done' }), slot({ time: '19:00', state: 'done' })])
  expect(hero.kind).toBe('closed')
  if (hero.kind !== 'closed') throw new Error('unreachable')
  expect(hero.consumedKcal).toBe(790)
  expect(hero.targetKcal).toBe(3010)
  expect(hero.doneCount).toBe(2)
  expect(hero.totalCount).toBe(2)
  expect(hero.proteinG).toBe(58)
  expect(hero.proteinTargetG).toBe(185)
})

test('the eating-window counts ignore supplement and training slots', () => {
  const capsule: FuelSlot = {
    time: '21:30', kind: 'evening', label: 'Esti stack', state: 'pending',
    items: [{ type: 'supplement', refId: 'mg', label: 'Magnézium', done: false }],
  }
  const gymSlot: FuelSlot = { time: '17:00', kind: 'workout', label: 'Pull Day', state: 'done', duration: 90 }
  const { hero } = pick([slot({ state: 'done' }), capsule, gymSlot])
  if (hero.kind !== 'closed') throw new Error('unreachable')
  expect(hero.totalCount).toBe(1)
})

test('missed windows are returned separately, in chronological order', () => {
  const a = slot({ time: '11:30', label: 'Tízórai', state: 'missed', kcal: 300 })
  const b = slot({ time: '09:15', label: 'Reggeli', state: 'missed', kcal: 580 })
  const { hero, missed } = pick([a, b, slot()])
  expect(hero.kind).toBe('open')
  expect(missed.map(s => s.time)).toEqual(['09:15', '11:30'])
})
