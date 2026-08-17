import { buildWindowRiver } from '@/features/fuel/logic/windowIslands'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import type { HeroResult } from '@/features/fuel/logic/heroWindow'
import type { MealMatchVerdict } from '@/features/fuel/logic/matchMealsToStack'
import type { FuelMeal, FuelPlanToday, FuelSlot } from '@/data/types'

const BUDGET: DayBudget = { kcal: 3000, p: 160, c: 300, f: 90, energy: { base: 2000, activity: 500, balance: 0, target: 2500 } }

const PLAN_BASE: Omit<FuelPlanToday, 'slots'> = {
  workout: { type: '', start: '—', end: '—', duration: 0 },
  volleyball: { start: '—', end: '—', noneToday: true },
  bedtime: '23:00',
  kitchenClose: '21:30',
  caffeineCutoff: '14:00',
  energy: { base: 2000, activity: 0, balance: 0, target: 2000 },
}

const slot = (over: Partial<FuelSlot> = {}): FuelSlot => ({
  time: '07:40', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done',
  kcal: 420, p: 92, ...over,
})

const heroFor = (nowSlot: FuelSlot | null): HeroResult =>
  nowSlot
    ? { hero: { kind: 'open', slot: nowSlot, suggestion: false, why: '', started: true }, missed: [] }
    : { hero: { kind: 'closed', consumedKcal: 0, targetKcal: 0, doneCount: 0, totalCount: 0, proteinG: 0, proteinTargetG: 0 }, missed: [] }

const build = (opts: {
  slots: FuelSlot[]
  stackVerdicts?: MealMatchVerdict[]
  workoutTime?: string | null
  medPeak?: boolean
  nowHHmm?: string
  meals?: FuelMeal[]
  /** Override the hero's now-slot resolution — the 'closed no-now-but-missed-remains' scenario
   *  (after-bedtime, unlogged past windows) isn't naturally reachable via `heroFor`'s own
   *  now-slot search, since it always derives 'now' from a literal `state: 'now'` slot. */
  hero?: HeroResult
}) => {
  const nowSlot = opts.slots.find(s => s.state === 'now') ?? null
  return buildWindowRiver({
    plan: { ...PLAN_BASE, slots: opts.slots },
    budget: BUDGET,
    hero: opts.hero ?? heroFor(nowSlot),
    stackVerdicts: opts.stackVerdicts ?? [],
    workoutTime: opts.workoutTime ?? null,
    medPeak: opts.medPeak ?? false,
    nowHHmm: opts.nowHHmm ?? '12:00',
    meals: opts.meals ?? [],
  })
}

test('done windows are excluded from islands; the now key is the default (mezo-c9t5)', () => {
  const s1 = slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealName: 'zabkása + skyr' })
  const s2 = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'done', mealName: 'csirkés rizs' })
  const s3 = slot({ time: '16:00', label: 'Uzsonna', slotKey: 'snack', state: 'now' })
  const s4 = slot({ time: '19:30', label: 'Vacsora', slotKey: 'dinner', state: 'pending' })
  const vm = build({ slots: [s4, s1, s3, s2] })
  expect(vm.islands.map(i => i.key)).toEqual(['16:00-Uzsonna', '19:30-Vacsora'])
  expect(vm.nowKey).toBe('16:00-Uzsonna')
  expect(vm.defaultKey).toBe(vm.nowKey)
})

test('a still-open window (now/missed/future) formats essence with the food name', () => {
  const s = slot({ time: '16:00', label: 'Uzsonna', slotKey: 'snack', state: 'now', mealName: 'fehérje-turmix' })
  const vm = build({ slots: [s] })
  const island = vm.islands[0]
  expect(island.essence).toBe('16:00 · fehérje-turmix')
  expect(island.count).toBe('3 ›')
})

test('a missed slot becomes a still-open missed island, excluded from the done group', () => {
  const done = slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 420, p: 92 })
  const missed = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'missed', mealName: undefined, kcal: undefined, p: undefined })
  const vm = build({ slots: [done, missed] })
  const island = vm.islands.find(i => i.key === '12:30-Ebéd')!
  expect(island.state).toBe('missed')
  expect(island.count).toBe('Pótold')
  expect(island.essence).toContain('kimaradt')
  expect(vm.doneGroup).toEqual({ count: 1, kcal: 420, avgScore: null })
})

test('the done group averages the scored done meals, joined off each slot\'s mealId', () => {
  const m1: FuelMeal = { id: 'm1', slot: 'Reggeli', title: 'Zabkása', score: 0.92, kcal: 420, p: 30, c: 40, f: 10, loggedAt: '', mealDate: '', mealItems: [], items: [], tags: [] } as unknown as FuelMeal
  const m2: FuelMeal = { id: 'm2', slot: 'Ebéd', title: 'Csirke', score: 0.8, kcal: 600, p: 40, c: 50, f: 15, loggedAt: '', mealDate: '', mealItems: [], items: [], tags: [] } as unknown as FuelMeal
  const s1 = slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 420, p: 30, mealId: 'm1' })
  const s2 = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'done', kcal: 600, p: 40, mealId: 'm2' })
  const vm = build({ slots: [s1, s2], meals: [m1, m2] })
  expect(vm.doneGroup).toEqual({ count: 2, kcal: 1020, avgScore: 86 })
})

test('a done meal with no score (or no mealId join) contributes nothing to the average — never a fake 0', () => {
  const s1 = slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', kcal: 420, p: 30, mealId: 'unknown' })
  const vm = build({ slots: [s1], meals: [] })
  expect(vm.doneGroup).toEqual({ count: 1, kcal: 420, avgScore: null })
})

test('no done windows today → doneGroup is null (no fabricated empty capsule)', () => {
  const now = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'now' })
  const vm = build({ slots: [now] })
  expect(vm.doneGroup).toBeNull()
})

test('with every slot done there are no islands left and the default key is null — no belt to fall back onto (mezo-c9t5)', () => {
  const s1 = slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done' })
  const s2 = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'done' })
  const vm = build({ slots: [s1, s2] })
  expect(vm.islands).toEqual([])
  expect(vm.nowKey).toBeNull()
  expect(vm.defaultKey).toBeNull()
})

test('no now window but a missed/future window remains (after-bedtime edge) → the default key is the chronologically first remaining island', () => {
  const done = slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done' })
  const missed = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'missed' })
  const closedHero: HeroResult = { hero: { kind: 'closed', consumedKcal: 0, targetKcal: 0, doneCount: 1, totalCount: 2, proteinG: 0, proteinTargetG: 0 }, missed: [missed] }
  const vm = build({ slots: [done, missed], hero: closedHero })
  expect(vm.nowKey).toBeNull()
  expect(vm.islands.map(i => i.key)).toEqual(['12:30-Ebéd'])
  expect(vm.defaultKey).toBe('12:30-Ebéd')
})

test('the protein jump projects the now window onto todays consumed protein', () => {
  const done = slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', p: 62 })
  const now = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'now', p: 42 })
  const vm = build({ slots: [done, now] })
  const island = vm.islands.find(i => i.key === '12:30-Ebéd')!
  expect(island.facts.proteinJump).toEqual({ addG: 42, fromG: 62, toG: 104, pctOfTarget: 65 })
})

test('the now island subtitle names the workout time and, at med peak, the appetite note', () => {
  const now = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'now' })
  const vm = build({ slots: [now], workoutTime: '13:00', medPeak: true })
  const island = vm.islands[0]
  expect(island.subtitle).toContain('edzés 13:00')
  expect(island.subtitle).toContain('étvágy')
})

test('a stack verdict lands only in its own zones island, both in stackDoses and l1Count', () => {
  const breakfast = slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'missed' })
  const lunch = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'now' })
  const verdict: MealMatchVerdict = { zone: 'breakfast', dayLabel: 'ma', mealTitle: 'Zabkása', ok: false, metric: '6g zsír', advice: 'Tedd zsírosabbá.' }
  const vm = build({ slots: [breakfast, lunch], stackVerdicts: [verdict] })
  const bIsland = vm.islands.find(i => i.key === '07:40-Reggeli')!
  const lIsland = vm.islands.find(i => i.key === '12:30-Ebéd')!
  // L1 always renders 3 rows (ablak étkezése/tervezz + csere + AI) regardless of doses, so
  // l1Count is 3 + doses.length, not doses.length alone.
  expect(bIsland.stackDoses).toHaveLength(1)
  expect(bIsland.l1Count).toBe(4)
  expect(lIsland.stackDoses).toHaveLength(0)
  expect(lIsland.l1Count).toBe(3)
})

test('two stack verdicts (breakfast + dinner zones) land doses on only their two matching islands', () => {
  const breakfast = slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'missed' })
  const lunch = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'now' })
  const dinner = slot({ time: '19:30', label: 'Vacsora', slotKey: 'dinner', state: 'pending' })
  const breakfastVerdict: MealMatchVerdict = { zone: 'breakfast', dayLabel: 'ma', mealTitle: 'Zabkása', ok: false, metric: '6g zsír', advice: 'Tedd zsírosabbá.' }
  const dinnerVerdict: MealMatchVerdict = { zone: 'dinner', dayLabel: 'ma', mealTitle: 'Csirke', ok: true, metric: '30g P', advice: null }
  const vm = build({ slots: [breakfast, lunch, dinner], stackVerdicts: [breakfastVerdict, dinnerVerdict] })
  const bIsland = vm.islands.find(i => i.key === '07:40-Reggeli')!
  const lIsland = vm.islands.find(i => i.key === '12:30-Ebéd')!
  const dIsland = vm.islands.find(i => i.key === '19:30-Vacsora')!
  expect(bIsland.stackDoses.map(d => d.name)).toEqual(['Zabkása'])
  expect(dIsland.stackDoses.map(d => d.name)).toEqual(['Csirke'])
  expect(lIsland.stackDoses).toHaveLength(0)
})

test('a window with no doses still shows the real L1 row count, not "0 ›"', () => {
  const now = slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'now' })
  const vm = build({ slots: [now] })
  const island = vm.islands[0]
  expect(island.l1Count).toBe(3)
  expect(island.count).toBe('3 ›')
})
