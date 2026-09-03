import { aiAverage, asPastDayHero, buildKeretHero, deriveMealRole, doneMealRows } from '@/features/fuel/logic/keretHero'
import { FIBER_TARGET_G } from '@/data/fuel/fuelConfig'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import type { FuelMeal, FuelSlot } from '@/data/types'

const BUDGET: DayBudget = { kcal: 2400, p: 160, c: 260, f: 80, energy: { base: 2000, activity: 400, balance: 0, target: 2400 } }

const meal = (over: Partial<FuelMeal> = {}): FuelMeal => ({
  id: 'm1', slot: 'breakfast', title: 'Zabkása', score: null,
  kcal: 420, p: 32, c: 50, f: 10,
  mealItems: [], items: [], tags: [], loggedAt: '2026-08-09T07:15:00', mealDate: '2026-08-09',
  ...over,
})

const slot = (over: Partial<FuelSlot> = {}): FuelSlot => ({
  time: '07:40', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'done',
  kcal: 420, p: 32, ...over,
})

const build = (over: Partial<Parameters<typeof buildKeretHero>[0]> = {}) =>
  buildKeretHero({
    budget: BUDGET,
    staticEnergy: false,
    consumed: { kcal: 420, p: 32, c: 50, f: 10 },
    meals: [],
    water: { currentMl: 1200, targetMl: 2400 },
    slots: [],
    nowHHmm: '12:00',
    fiberTargetG: 30,
    ...over,
  })

// ── rost-összegzés ───────────────────────────────────────────────────────────

test('the fiber ring sums only the meals that carry a fiberG — a missing field counts as 0', () => {
  const m1 = meal({ id: 'm1', fiberG: 12 })
  const m2 = meal({ id: 'm2', fiberG: undefined })
  const vm = build({ meals: [m1, m2] })
  const fiber = vm.rings.find(r => r.key === 'fiber')!
  expect(fiber.value).toBe('12 g')
  expect(fiber.target).toBe(`${FIBER_TARGET_G} g`)
  expect(fiber.pct).toBe(Math.round((12 / FIBER_TARGET_G) * 100))
})

test('a null fiberG (explicit no-data) also counts as 0, same as an absent field', () => {
  const m1 = meal({ id: 'm1', fiberG: 18 })
  const m2 = meal({ id: 'm2', fiberG: null })
  const vm = build({ meals: [m1, m2] })
  const fiber = vm.rings.find(r => r.key === 'fiber')!
  expect(fiber.value).toBe('18 g')
})

test('with no logged meals at all the fiber ring sits at 0%, not a ghost/unknown state', () => {
  const vm = build({ meals: [] })
  const fiber = vm.rings.find(r => r.key === 'fiber')!
  expect(fiber.pct).toBe(0)
  expect(fiber.value).toBe('0 g')
})

// ── víz-ring ─────────────────────────────────────────────────────────────────

test('the water ring pct is currentMl over targetMl', () => {
  const vm = build({ water: { currentMl: 1800, targetMl: 2400 } })
  const water = vm.rings.find(r => r.key === 'water')!
  expect(water.pct).toBe(75)
  expect(water.value).toBe('1800 ml')
  expect(water.target).toBe('2400 ml')
})

test('an overshoot water log clamps the ring pct at 100, never over', () => {
  const vm = build({ water: { currentMl: 3000, targetMl: 2400 } })
  const water = vm.rings.find(r => r.key === 'water')!
  expect(water.pct).toBe(100)
})

test('the 5 rings always render in the fixed P/C/F/Rost/Víz order', () => {
  const vm = build()
  expect(vm.rings.map(r => r.key)).toEqual(['p', 'c', 'f', 'fiber', 'water'])
})

// ── chips / static energy ─────────────────────────────────────────────────────

test('static-energy days render no chip row (chips is null)', () => {
  const vm = build({ staticEnergy: true })
  expect(vm.chips).toBeNull()
})

test('a dynamic-energy day carries the raw base/activity/balance — a negative balance passes through unformatted', () => {
  const budget: DayBudget = { ...BUDGET, energy: { base: 2000, activity: 400, balance: -400, target: 2000 } }
  const vm = build({ budget, staticEnergy: false })
  expect(vm.chips).toEqual({ base: 2000, activity: 400, balance: -400 })
})

test('a surplus day carries a positive raw balance — formatting (the sign glyph) is the components job', () => {
  const budget: DayBudget = { ...BUDGET, energy: { base: 2000, activity: 400, balance: 300, target: 2700 } }
  const vm = build({ budget, staticEnergy: false })
  expect(vm.chips).toEqual({ base: 2000, activity: 400, balance: 300 })
})

// ── nap-sáv szegmensek ─────────────────────────────────────────────────────────

test('the day-bar segments come from the logged meal windows, sharing one denominator with the budget', () => {
  const s1 = slot({ time: '07:40', slotKey: 'breakfast', state: 'done', kcal: 480 })
  const s2 = slot({ time: '12:30', slotKey: 'lunch', state: 'done', kcal: 720 })
  const pending = slot({ time: '19:30', slotKey: 'dinner', state: 'pending', kcal: 600 })
  const vm = build({ slots: [pending, s2, s1] }) // out of order — the module sorts chronologically
  // 480/2400 = 20%, 720/2400 = 30% — both share the budget.kcal denominator (2400).
  expect(vm.segments).toEqual([
    { widthPct: 20, toneAlt: false },
    { widthPct: 30, toneAlt: true },
  ])
})

test('a segment never exceeds 100% width even on a single-meal overshoot day', () => {
  const s1 = slot({ time: '07:40', slotKey: 'breakfast', state: 'done', kcal: 5000 })
  const vm = build({ slots: [s1] })
  expect(vm.segments[0].widthPct).toBe(100)
})

test('non-meal (workout/protocol) slots never enter the segments or the n/m window count', () => {
  const done = slot({ time: '07:40', slotKey: 'breakfast', state: 'done', kcal: 400 })
  const workout: FuelSlot = { time: '17:00', kind: 'workout', label: 'Pull Day', state: 'done', duration: 60 }
  const stack: FuelSlot = { time: '08:00', kind: 'wake', label: 'Reggeli stack', state: 'done', items: [{ type: 'supplement', refId: 'x', label: 'D3', done: true }] }
  const vm = build({ slots: [done, workout, stack] })
  expect(vm.segments).toHaveLength(1)
  expect(vm.doneCount).toBe(1)
  expect(vm.totalCount).toBe(1)
})

test('doneCount/totalCount count meal windows regardless of state', () => {
  const done = slot({ time: '07:40', slotKey: 'breakfast', state: 'done' })
  const now = slot({ time: '12:30', slotKey: 'lunch', state: 'now' })
  const pending = slot({ time: '19:30', slotKey: 'dinner', state: 'pending' })
  const vm = build({ slots: [done, now, pending] })
  expect(vm.doneCount).toBe(1)
  expect(vm.totalCount).toBe(3)
})

// ── remaining/consumed/target kcal ────────────────────────────────────────────

test('remaining kcal passes through negative on an overshoot day — no clamp, honest overshoot', () => {
  const vm = build({ consumed: { kcal: 3000, p: 32, c: 50, f: 10 }, budget: BUDGET })
  expect(vm.remainingKcal).toBe(-600)
  expect(vm.consumedKcal).toBe(3000)
  expect(vm.targetKcal).toBe(2400)
})

test('a normal day reports the plain kcal-to-go', () => {
  const vm = build({ consumed: { kcal: 900, p: 32, c: 50, f: 10 } })
  expect(vm.remainingKcal).toBe(1500)
})

// ── most-jelző (nowFrac) ───────────────────────────────────────────────────────

test('nowFrac sits between the earliest and latest meal window when a window is open now', () => {
  const s1 = slot({ time: '08:00', slotKey: 'breakfast', state: 'done' })
  const s2 = slot({ time: '12:00', slotKey: 'lunch', state: 'now' })
  const s3 = slot({ time: '20:00', slotKey: 'dinner', state: 'pending' })
  const vm = build({ slots: [s1, s2, s3], nowHHmm: '12:00' })
  // (12:00 - 08:00) / (20:00 - 08:00) = 240/720 = 1/3
  expect(vm.nowFrac).toBeCloseTo(1 / 3, 5)
})

test('nowFrac is null once every window is already logged (no open window left)', () => {
  const s1 = slot({ time: '08:00', slotKey: 'breakfast', state: 'done' })
  const s2 = slot({ time: '12:00', slotKey: 'lunch', state: 'done' })
  const vm = build({ slots: [s1, s2], nowHHmm: '18:00' })
  expect(vm.nowFrac).toBeNull()
})

// ── doneMealRows ─────────────────────────────────────────────────────────────

test('doneMealRows lists the done windows chronologically, carrying name/time/kcal/protein/score', () => {
  const lunch = meal({ id: 'lunch', title: 'Csirkés rizs', score: 0.92, kcal: 640, p: 48 })
  const breakfast = meal({ id: 'breakfast', title: 'Zabkása', score: 0.7, kcal: 420, p: 32 })
  const s1 = slot({ time: '12:30', slotKey: 'lunch', label: 'Ebéd', state: 'done', mealId: 'lunch', mealName: 'Csirkés rizs', kcal: 640, p: 48 })
  const s2 = slot({ time: '07:40', slotKey: 'breakfast', label: 'Reggeli', state: 'done', mealId: 'breakfast', mealName: 'Zabkása', kcal: 420, p: 32 })
  const rows = doneMealRows([lunch, breakfast], [s1, s2])
  expect(rows.map(r => r.mealId)).toEqual(['breakfast', 'lunch'])
  expect(rows[0]).toEqual({ mealId: 'breakfast', name: 'Zabkása', time: '07:40', kcal: 420, proteinG: 32, scorePct: 70 })
  expect(rows[1].scorePct).toBe(92)
})

test('a done meal without a score never fabricates one — scorePct is null', () => {
  const m = meal({ id: 'm1', score: null })
  const s = slot({ mealId: 'm1', mealName: 'Zabkása' })
  const rows = doneMealRows([m], [s])
  expect(rows[0].scorePct).toBeNull()
})

test('doneMealRows excludes pending/now/missed windows and non-meal slots', () => {
  const m = meal({ id: 'm1' })
  const done = slot({ mealId: 'm1' })
  const now = slot({ time: '12:30', slotKey: 'lunch', state: 'now', mealId: undefined })
  const workout: FuelSlot = { time: '17:00', kind: 'workout', label: 'Pull Day', state: 'done', duration: 60 }
  const rows = doneMealRows([m], [done, now, workout])
  expect(rows).toHaveLength(1)
  expect(rows[0].mealId).toBe('m1')
})

// ── aiAverage ────────────────────────────────────────────────────────────────

test('aiAverage averages only the scored values, ignoring null ones', () => {
  expect(aiAverage([90, null, 70])).toBe(80)
})

test('aiAverage is null when no value is scored', () => {
  expect(aiAverage([null])).toBeNull()
})

test('aiAverage is null on an empty list', () => {
  expect(aiAverage([])).toBeNull()
})

// ── deriveMealRole ───────────────────────────────────────────────────────────

test('no workout today → always standard, regardless of meal time', () => {
  expect(deriveMealRole('12:30', null)).toBe('standard')
})

test('a meal 0-90min before the workout start is pre', () => {
  expect(deriveMealRole('12:30', '13:00')).toBe('pre') // 30 min before
  expect(deriveMealRole('11:30', '13:00')).toBe('pre') // exactly 90 min before
})

test('a meal more than 90min before the workout is standard, not pre', () => {
  expect(deriveMealRole('11:29', '13:00')).toBe('standard') // 91 min before
})

test('a meal 0-120min after the workout start is post', () => {
  expect(deriveMealRole('13:00', '13:00')).toBe('post') // exactly at kickoff
  expect(deriveMealRole('13:40', '13:00')).toBe('post') // 40 min after
  expect(deriveMealRole('15:00', '13:00')).toBe('post') // exactly 120 min after
})

test('a meal more than 120min after the workout is standard, not post', () => {
  expect(deriveMealRole('15:01', '13:00')).toBe('standard') // 121 min after
})

// ── múlt nap (mezo-zeeq) ──────────────────────────────────────────────────────

test('asPastDayHero: chips + now-marker go, everything else stays (energy/clock are TODAY\'s)', () => {
  const vm = build({
    slots: [slot({ time: '08:00', state: 'done' }), slot({ time: '13:00', label: 'Ebéd', slotKey: 'lunch', state: 'now' }),
      slot({ time: '19:00', label: 'Vacsora', slotKey: 'dinner', state: 'pending' })],
    nowHHmm: '13:30',
  })
  expect(vm.chips).not.toBeNull()
  expect(vm.nowFrac).not.toBeNull()
  const past = asPastDayHero(vm)
  expect(past.chips).toBeNull()
  expect(past.nowFrac).toBeNull()
  expect({ ...past, chips: vm.chips, nowFrac: vm.nowFrac }).toEqual(vm)
})
