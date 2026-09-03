import {
  activityKcal,
  blockKcal,
  buildDayPlan,
  deriveDailyBudget,
  mealSlotKey,
  pickRecipe,
  placeWindows,
  splitBudget,
  splitBudgetPct,
  ZONE_FUEL_KIND,
  type DayBudget,
  type DayPlanInput,
  type Macro4,
  type PlannedWindow,
  type PlannerBlock,
} from '@/features/fuel/logic/buildDayPlan'
import type { FuelMeal, FuelPlanToday, MealItemLine, Recipe, SlotTemplate, SlotTemplateRow } from '@/data/types'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'
import { toHHmm, toMin } from '@/data/fuel/fuelConfig'

// ── fixture factories ────────────────────────────────────────────────────────
function meal(over: Partial<FuelMeal> & { slot: string; loggedAt: string }): FuelMeal {
  return {
    id: 'm',
    title: 'Meal',
    score: null,
    kcal: 500,
    p: 40,
    c: 50,
    f: 15,
    mealItems: [],
    items: [],
    tags: [],
    mealDate: '2026-07-02',
    ...over,
  }
}
function recipe(over: Partial<Recipe> & { id: string; category: Recipe['category'] }): Recipe {
  return {
    name: `Recipe ${over.id}`,
    slot: '',
    createdDate: '2026-01-01',
    timesLogged: 0,
    avgScore: 0,
    lastLogged: '',
    servings: 1,
    prepMins: 5,
    cookMins: 5,
    tags: [],
    ingredients: [],
    macros: { kcal: 500, p: 40, c: 50, f: 15 },
    novaDominant: 1,
    mezoFit: { score: null, fitsFor: [] },
    starred: false,
    role: 'standard',
    ...over,
  }
}
function stackEntry(over: Partial<StackDayEntry> & { pantryItemId: string; name: string }): StackDayEntry {
  return {
    occurrenceId: `occ-${over.pantryItemId}`,
    persistedZone: 'wake',
    dose: null,
    pinned: false,
    placementSource: 'rule',
    reason: null,
    dailyTotalHint: null,
    skippedToday: false,
    displacedToday: false,
    taken: false,
    ...over,
  }
}
function stackSlot(over: Partial<StackDaySlot> & { zone: StackDaySlot['zone']; time: string }): StackDaySlot {
  return {
    label: 'w',
    anchorNote: null,
    entries: [],
    ...over,
  }
}
const NO_BUDGET: DayBudget = { kcal: 2400, p: 180, c: 240, f: 73, energy: { base: 2400, activity: 0, balance: 0, target: 2400 } }
const FB = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
function baseInput(over: Partial<DayPlanInput> = {}): DayPlanInput {
  return {
    wake: '06:00',
    bed: '23:00',
    mealsPerDay: 4,
    blocks: [],
    budget: NO_BUDGET,
    meals: [],
    recipes: [],
    protocolSlots: [],
    caffeineCutoff: '14:00',
    nowHHmm: '12:00',
    ...over,
  }
}
const times = (ws: PlannedWindow[]) => ws.map(w => toHHmm(w.time))

// ── mealSlotKey (real enum + mock display string) ────────────────────────────
test('mealSlotKey recognises the real enum and the Hungarian mock display strings', () => {
  expect(mealSlotKey(meal({ slot: 'breakfast', loggedAt: 'x' }))).toBe('breakfast')
  expect(mealSlotKey(meal({ slot: 'lunch', loggedAt: 'x' }))).toBe('lunch')
  expect(mealSlotKey(meal({ slot: 'dinner', loggedAt: 'x' }))).toBe('dinner')
  expect(mealSlotKey(meal({ slot: 'snack', loggedAt: 'x' }))).toBe('snack')
  expect(mealSlotKey(meal({ slot: 'Reggeli · 09:15 · post-workout', loggedAt: 'x' }))).toBe('breakfast')
  expect(mealSlotKey(meal({ slot: 'Ebéd · 13:00', loggedAt: 'x' }))).toBe('lunch')
  expect(mealSlotKey(meal({ slot: 'Vacsora · 19:30 (tervezett)', loggedAt: 'x' }))).toBe('dinner')
  expect(mealSlotKey(meal({ slot: 'Snack · 16:00', loggedAt: 'x' }))).toBe('snack')
  expect(mealSlotKey(meal({ slot: 'ismeretlen', loggedAt: 'x' }))).toBeNull()
})

// ── window placement — 3/4/5/6 meals across the default 06:00/23:00 span ──────
// eatingStart = 06:45, kitchenClose = 21:30 (span 885 min); mains at 0/0.5/1.
test('placeWindows spreads 3 meals at the default span fractions', () => {
  const ws = placeWindows('06:00', '23:00', 3, [])
  expect(ws.map(w => w.slotKey)).toEqual(['breakfast', 'lunch', 'dinner'])
  expect(times(ws)).toEqual(['06:45', '14:08', '21:30'])
})
test('placeWindows adds one snack after Ebéd for 4 meals', () => {
  const ws = placeWindows('06:00', '23:00', 4, [])
  expect(times(ws)).toEqual(['06:45', '14:08', '17:49', '21:30'])
  expect(ws.map(w => w.slotKey)).toEqual(['breakfast', 'lunch', 'snack', 'dinner'])
})
test('placeWindows adds both-gap snacks for 5 meals', () => {
  const ws = placeWindows('06:00', '23:00', 5, [])
  expect(times(ws)).toEqual(['06:45', '10:26', '14:08', '17:49', '21:30'])
  expect(ws.map(w => w.slotKey)).toEqual(['breakfast', 'snack', 'lunch', 'snack', 'dinner'])
})
test('placeWindows adds an evening snack (Vacsora−90) for 6 meals', () => {
  const ws = placeWindows('06:00', '23:00', 6, [])
  expect(times(ws)).toEqual(['06:45', '10:26', '14:08', '17:49', '20:00', '21:30'])
})

// ── invariants hold for every meals-per-day count ────────────────────────────
test('windows are strictly increasing, ≥90min apart, within [eatingStart, kitchenClose]', () => {
  for (const n of [3, 4, 5, 6]) {
    const ws = placeWindows('06:00', '23:00', n, [])
    expect(ws).toHaveLength(n)
    for (let i = 1; i < ws.length; i++) {
      expect(ws[i].time).toBeGreaterThan(ws[i - 1].time)
      expect(ws[i].time - ws[i - 1].time).toBeGreaterThanOrEqual(90)
    }
    expect(ws[0].time).toBeGreaterThanOrEqual(6 * 60 + 45)
    expect(ws[ws.length - 1].time).toBeLessThanOrEqual(21 * 60 + 30)
  }
})

// ── training snaps ───────────────────────────────────────────────────────────
test('morning gym (07:30, duration null → end 08:30) snaps breakfast to 09:15 as post-workout main', () => {
  const gym: PlannerBlock = { kind: 'gym', time: '07:30', durationMin: null, label: 'Pull Day · gym' }
  const ws = placeWindows('06:00', '23:00', 4, [gym])
  const breakfast = ws.find(w => w.slotKey === 'breakfast')!
  expect(toHHmm(breakfast.time)).toBe('09:15')
  expect(breakfast.weight).toBe(2.5) // post-workout main
})
test('evening volleyball (18:15+90) snaps a pre slot to 17:00 and dinner to 20:15 clamped to kitchenClose', () => {
  // bed 21:45 → kitchenClose 20:15, so blockEnd+45 (20:30) clamps down to 20:15.
  const sport: PlannerBlock = { kind: 'sport', time: '18:15', durationMin: 90, label: 'Röpi · edzés' }
  const ws = placeWindows('06:00', '21:45', 4, [sport])
  const snack = ws.find(w => w.slotKey === 'snack')!
  const dinner = ws.find(w => w.slotKey === 'dinner')!
  expect(toHHmm(snack.time)).toBe('17:00') // pre-fuel: block−75
  expect(toHHmm(dinner.time)).toBe('20:15') // post-workout, clamped to kitchenClose
  expect(dinner.weight).toBe(2.5)
})

// ── kitchen close on the unwrapped axis (mezo-t1vh) ─────────────────────────────
test('kitchen close on a crossing day (wake 07:00 / bed 03:00) renders on the unwrapped axis', () => {
  const plan = buildDayPlan(baseInput({ wake: '07:00', bed: '03:00' }))
  expect(plan.kitchenClose).toBe('01:30') // bedMin = 1620 (unwrapped), kitchenCloseMin = 1530, mod 1440 = 90 → 01:30
})
test('kitchen close on a crossing day with early bed (wake 07:00 / bed 00:30) wraps past midnight', () => {
  const plan = buildDayPlan(baseInput({ wake: '07:00', bed: '00:30' }))
  expect(plan.kitchenClose).toBe('23:00') // bedMin = 1470 (unwrapped), kitchenCloseMin = 1380, mod 1440 = 1380 → 23:00
})
test('kitchen close on a non-crossing day (wake 06:00 / bed 23:00) is byte-identical (no behavior change)', () => {
  const plan = buildDayPlan(baseInput({ wake: '06:00', bed: '23:00' }))
  expect(plan.kitchenClose).toBe('21:30') // bedMin = 1380 (non-crossing), kitchenCloseMin = 1290, mod 1440 = 1290 → 21:30
})

// ── budget split — sums EXACTLY to the daily budget, drift on dinner ──────────
test('splitBudget rounds per macro and lands the drift on the dinner window', () => {
  const windows: PlannedWindow[] = [
    { slotKey: 'breakfast', kind: 'meal', label: 'R', time: 0, weight: 2 },
    { slotKey: 'lunch', kind: 'meal', label: 'E', time: 1, weight: 2 },
    { slotKey: 'snack', kind: 'snack', label: 'S', time: 2, weight: 1 },
    { slotKey: 'dinner', kind: 'meal', label: 'V', time: 3, weight: 2 },
  ]
  const daily: Macro4 = { kcal: 2150, p: 163, c: 226, f: 66 } // Σweights = 7
  const out = splitBudget(daily, windows)
  expect(out[0]).toEqual({ kcal: 614, p: 47, c: 65, f: 19 }) // breakfast
  expect(out[1]).toEqual({ kcal: 614, p: 47, c: 65, f: 19 }) // lunch
  expect(out[2]).toEqual({ kcal: 307, p: 23, c: 32, f: 9 }) // snack
  expect(out[3]).toEqual({ kcal: 615, p: 46, c: 64, f: 19 }) // dinner absorbs drift
  for (const k of ['kcal', 'p', 'c', 'f'] as const) {
    expect(out.reduce((s, b) => s + b[k], 0)).toBe(daily[k])
  }
})

// ── splitBudgetPct (mezo-7102, template windows) ─────────────────────────────
const pctWindow = (over: Partial<PlannedWindow> & { budgetPct: number }): PlannedWindow => ({
  slotKey: 'lunch', kind: 'meal', label: 'W', time: 0, weight: over.budgetPct, ...over,
})
test('splitBudgetPct: an empty windows array returns [] instead of throwing (no largest-pct index to absorb drift into)', () => {
  const daily: Macro4 = { kcal: 2000, p: 150, c: 200, f: 60 }
  expect(splitBudgetPct(daily, [])).toEqual([])
})
test('splitBudgetPct: all-standard-role windows sum EXACTLY to the daily budget per macro (25/25/25/25)', () => {
  const windows = [25, 25, 25, 25].map(pct => pctWindow({ budgetPct: pct }))
  const daily: Macro4 = { kcal: 2000, p: 200, c: 200, f: 100 }
  const out = splitBudgetPct(daily, windows)
  // role multipliers are all 1 for 'standard' → this is a straight proportional split (no skew).
  expect(out).toEqual([
    { kcal: 500, p: 50, c: 50, f: 25 },
    { kcal: 500, p: 50, c: 50, f: 25 },
    { kcal: 500, p: 50, c: 50, f: 25 },
    { kcal: 500, p: 50, c: 50, f: 25 },
  ])
  for (const k of ['kcal', 'p', 'c', 'f'] as const) {
    expect(out.reduce((s, b) => s + b[k], 0)).toBe(daily[k])
  }
})
test('splitBudgetPct: rounding drift is absorbed by the LARGEST-pct window, not the first one', () => {
  // pct [20, 50, 30] — index 1 is the largest pct, and must absorb the drift even though it is
  // neither first nor last. f: 0.2·13=2.6→3, 0.5·13=6.5→7, 0.3·13=3.9→4 naive sum=14 ≠ 13.
  const windows = [
    pctWindow({ budgetPct: 20, label: 'A' }),
    pctWindow({ budgetPct: 50, label: 'B' }),
    pctWindow({ budgetPct: 30, label: 'C' }),
  ]
  const daily: Macro4 = { kcal: 1000, p: 100, c: 100, f: 13 }
  const out = splitBudgetPct(daily, windows)
  expect(out).toEqual([
    { kcal: 200, p: 20, c: 20, f: 3 },
    { kcal: 500, p: 50, c: 50, f: 6 }, // absorbs the -1 drift (naive round would be 7)
    { kcal: 300, p: 30, c: 30, f: 4 },
  ])
  for (const k of ['kcal', 'p', 'c', 'f'] as const) {
    expect(out.reduce((s, b) => s + b[k], 0)).toBe(daily[k])
  }
})
test('splitBudgetPct: a pre_workout slot gets more carbs and less protein/fat than a standard slot at the same pct', () => {
  const windows: PlannedWindow[] = [
    pctWindow({ budgetPct: 50, role: 'standard', label: 'Standard' }),
    pctWindow({ budgetPct: 50, role: 'pre_workout', label: 'PreWorkout' }),
  ]
  const daily: Macro4 = { kcal: 2000, p: 150, c: 200, f: 60 }
  const out = splitBudgetPct(daily, windows)
  const [standard, preWorkout] = out
  expect(preWorkout.c).toBeGreaterThan(standard.c)
  expect(preWorkout.p).toBeLessThan(standard.p)
  expect(preWorkout.f).toBeLessThan(standard.f)
  expect(standard).toEqual({ kcal: 1000, p: 100, c: 77, f: 43 })
  expect(preWorkout).toEqual({ kcal: 1000, p: 50, c: 123, f: 17 })
  for (const k of ['kcal', 'p', 'c', 'f'] as const) {
    expect(out.reduce((s, b) => s + b[k], 0)).toBe(daily[k])
  }
})

// ── deriveDailyBudget ────────────────────────────────────────────────────────
test('deriveDailyBudget (no energy) keeps the static base kcal + derived carbs/fat', () => {
  const fallback = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  expect(deriveDailyBudget({ kcal: 2150, proteinG: 163 }, fallback)).toMatchObject({ kcal: 2150, p: 163, c: 226, f: 66 })
})
test('deriveDailyBudget (no energy, no segment) passes the fallback MacroSet through', () => {
  const fallback = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  expect(deriveDailyBudget(null, fallback)).toMatchObject({ kcal: 3100, p: 220, c: 380, f: 95 })
})

const ENERGY = (blocks: PlannerBlock[]) => ({ bmr: 1720, neat: 1.2, weightKg: 78.6, blocks })
test('dynamic budget — rest day floors at BMR (raw 2064−516=1548 < 1720)', () => {
  const b = deriveDailyBudget({ kcal: 2150, proteinG: 163, dailyEnergyBalanceKcal: -516 }, FB, ENERGY([]))
  expect(b.energy).toMatchObject({ base: 2064, activity: 0, balance: -516, target: 1720 })
  expect(b.kcal).toBe(1720)
  expect(b.p).toBe(163) // protein fixed
  expect(b.f).toBe(66) // fat from the BASE segment, not the floored target
  expect(b.c).toBe(Math.round((1720 - 163 * 4 - 66 * 9) / 4)) // 119 — carbs absorb
})
test('dynamic budget — big training day adds activity, carbs absorb the bonus', () => {
  const blocks: PlannerBlock[] = [
    { kind: 'gym', time: '18:00', durationMin: 60, label: 'Plyo Leg' },
    { kind: 'sport', time: '18:00', durationMin: 240, label: 'Volleyball' },
  ]
  const b = deriveDailyBudget({ kcal: 2150, proteinG: 163, dailyEnergyBalanceKcal: -516 }, FB, ENERGY(blocks))
  expect(b.energy.activity).toBeGreaterThan(1800)
  expect(b.energy.target).toBeGreaterThan(3300)
  expect(b.kcal).toBe(b.energy.target)
  expect(b.f).toBe(66) // fat stable (base-tied)
  expect(b.c).toBeGreaterThan(500) // big carb day
})

test('deriveDailyBudget prefers the segment fatG over FAT_KCAL_SHARE', () => {
  const segment = { kcal: 2150, proteinG: 163, carbsG: 226, fatG: 90, dailyEnergyBalanceKcal: -516 }
  const fallback = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  // static path (no energy inputs): f from segment, c from segment
  const staticBudget = deriveDailyBudget(segment, fallback)
  expect(staticBudget.f).toBe(90)
  expect(staticBudget.c).toBe(226)
  // dynamic path: fat stays the segment's, carbs absorb the activity bonus
  const dyn = deriveDailyBudget(segment, fallback, { bmr: 1720, neat: 1.2, weightKg: 84, blocks: [] })
  expect(dyn.f).toBe(90)
  expect(dyn.c).toBe(Math.max(0, Math.round((dyn.kcal - 163 * 4 - 90 * 9) / 4)))
})

test('deriveDailyBudget keeps the FAT_KCAL_SHARE fallback for pre-slice-1 segments', () => {
  const segment = { kcal: 2150, proteinG: 163, dailyEnergyBalanceKcal: -516 } // no carbsG/fatG
  const fallback = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  const budget = deriveDailyBudget(segment, fallback)
  expect(budget.f).toBe(Math.round((2150 * 0.275) / 9)) // 66 — unchanged legacy behavior
})

// ── recipe fit ───────────────────────────────────────────────────────────────
const budget600: Macro4 = { kcal: 600, p: 45, c: 70, f: 15 }
test('pickRecipe matches category + ±20% kcal and ranks by |Δkcal|', () => {
  const recipes = [
    recipe({ id: 'r1', category: 'breakfast', macros: { kcal: 1160, p: 80, c: 140, f: 24 }, servings: 2 }), // 580/serv → |Δ|=20
    recipe({ id: 'r2', category: 'breakfast', macros: { kcal: 640, p: 50, c: 60, f: 20 }, servings: 1 }), // 640 → |Δ|=40
    recipe({ id: 'rWrong', category: 'lunch', macros: { kcal: 600, p: 45, c: 70, f: 15 }, servings: 1 }), // wrong category
    recipe({ id: 'rFar', category: 'breakfast', macros: { kcal: 900, p: 60, c: 90, f: 30 }, servings: 1 }), // |Δ|=300 > 120
  ]
  expect(pickRecipe('breakfast', budget600, recipes)!.id).toBe('r1')
  expect(pickRecipe('breakfast', budget600, [recipes[3]])).toBeNull() // only the out-of-tolerance one
})
test('pickRecipe tie-breaks equal |Δkcal| by starred then |Δprotein|', () => {
  const rA = recipe({ id: 'rA', category: 'breakfast', macros: { kcal: 580, p: 40, c: 70, f: 15 }, servings: 1 }) // |Δkcal|=20, |Δp|=5
  const rB = recipe({ id: 'rB', category: 'breakfast', macros: { kcal: 620, p: 44, c: 70, f: 15 }, servings: 1 }) // |Δkcal|=20, |Δp|=1
  const rC = recipe({ id: 'rC', category: 'breakfast', macros: { kcal: 620, p: 44, c: 70, f: 15 }, servings: 1, starred: true })
  expect(pickRecipe('breakfast', budget600, [rA, rB])!.id).toBe('rB') // |Δprotein| wins
  expect(pickRecipe('breakfast', budget600, [rA, rB, rC])!.id).toBe('rC') // starred wins first
})

// ── slot filling through buildDayPlan ────────────────────────────────────────
test('a fitting recipe fills an un-logged window with the recipe per-serving macros + suggestedRecipeId', () => {
  const rec = recipe({ id: 'r1', name: 'Túrós zab', category: 'breakfast', macros: { kcal: 1160, p: 84, c: 140, f: 24 }, servings: 2 })
  const plan = buildDayPlan(baseInput({ budget: { kcal: 2100, p: 168, c: 260, f: 64, energy: { base: 2100, activity: 0, balance: 0, target: 2100 } }, recipes: [rec], nowHHmm: '05:00' }))
  const breakfast = plan.slots.find(s => s.label === 'Reggeli')!
  // At 05:00 nothing is logged and `now` precedes every meal → the earliest window is the current
  // "now" one (fixed-plan state, mezo-1oy5). The recipe-fill itself (suggestion + macros below) is
  // independent of that state; the missed/now/pending machine has its own tests.
  expect(breakfast.state).toBe('now')
  expect(breakfast.suggestedRecipeId).toBe('r1')
  expect(breakfast.mealName).toBe('Túrós zab')
  expect({ kcal: breakfast.kcal, p: breakfast.p, c: breakfast.c, f: breakfast.f }).toEqual({ kcal: 580, p: 42, c: 70, f: 12 })
})
test('an un-logged window with no fitting recipe carries the budget macros and no suggestedRecipeId', () => {
  const plan = buildDayPlan(baseInput({ recipes: [] }))
  const breakfast = plan.slots.find(s => s.label === 'Reggeli')!
  expect(breakfast.suggestedRecipeId).toBeUndefined()
  expect(breakfast.kcal).toBeGreaterThan(0) // budget-only
})
test('a logged meal renders done with mealId + real macros and consumes its window', () => {
  const logged = meal({ id: 'm1', slot: 'breakfast', title: 'Rántotta', loggedAt: '2026-07-02T08:40:00', kcal: 512, p: 44, c: 12, f: 30 })
  const plan = buildDayPlan(baseInput({ meals: [logged] }))
  const done = plan.slots.filter(s => s.state === 'done' && s.kind === 'meal')
  expect(done).toHaveLength(1)
  expect(done[0]).toMatchObject({ time: '08:40', mealId: 'm1', mealName: 'Rántotta', kcal: 512, p: 44, c: 12, f: 30 })
})
test('multiple logged snacks fill snack windows in loggedAt order', () => {
  const s1 = meal({ id: 's1', slot: 'snack', title: 'Korai snack', loggedAt: '2026-07-02T10:30:00' })
  const s2 = meal({ id: 's2', slot: 'snack', title: 'Kései snack', loggedAt: '2026-07-02T17:05:00' })
  const plan = buildDayPlan(baseInput({ mealsPerDay: 5, meals: [s2, s1] })) // deliberately out of order
  const doneSnacks = plan.slots.filter(s => s.kind === 'snack' && s.state === 'done')
  expect(doneSnacks.map(s => s.mealId)).toEqual(['s1', 's2']) // sorted by loggedAt
  expect(doneSnacks.map(s => s.time)).toEqual(['10:30', '17:05'])
})
test('a UTC-serialized loggedAt (real mode, Z) renders at the LOCAL wall-clock, not the UTC hour', () => {
  // Real mode serializes loggedAt as UTC OffsetDateTime. Compute the expectation from the SAME
  // Date parsing so the assertion is independent of the process TZ the suite happens to run in.
  const logged = meal({ id: 'm1', slot: 'breakfast', title: 'Rántotta', loggedAt: '2026-07-02T07:15:00Z' })
  const plan = buildDayPlan(baseInput({ meals: [logged], nowHHmm: '05:00' }))
  const done = plan.slots.find(s => s.state === 'done' && s.kind === 'meal')!
  const d = new Date('2026-07-02T07:15:00Z')
  const expected = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  expect(done.mealId).toBe('m1')
  expect(done.time).toBe(expected)
})
test('an offset-less (mock) loggedAt still renders its local wall-clock unchanged', () => {
  const logged = meal({ id: 'm1', slot: 'breakfast', loggedAt: '2026-07-02T08:40:00' })
  const plan = buildDayPlan(baseInput({ meals: [logged], nowHHmm: '05:00' }))
  const done = plan.slots.find(s => s.state === 'done' && s.kind === 'meal')!
  expect(done.time).toBe('08:40')
})

// ── logged-meal display name: item-derived fallback when the title is blank (mezo-u68c) ───────────
const line = (name: string): MealItemLine => ({
  source: 'pantry', refId: `p-${name}`, amount: 1, unit: 'adag', name, contribution: { kcal: 0, p: 0, c: 0, f: 0 },
})
test('derives a slot name from meal items when the logged meal has no title', () => {
  const logged = meal({ id: 'm1', slot: 'breakfast', title: '', loggedAt: '2026-07-02T08:40:00', mealItems: [line('Zabpehely')] })
  const plan = buildDayPlan(baseInput({ meals: [logged] }))
  const breakfast = plan.slots.find(s => s.mealId === 'm1')!
  expect(breakfast.mealName).toBe('Zabpehely')
})
test('keeps the explicit title when the logged meal has one', () => {
  const logged = meal({ id: 'm1', slot: 'breakfast', title: 'Reggelim', loggedAt: '2026-07-02T08:40:00', mealItems: [line('Zabpehely')] })
  const plan = buildDayPlan(baseInput({ meals: [logged] }))
  const breakfast = plan.slots.find(s => s.mealId === 'm1')!
  expect(breakfast.mealName).toBe('Reggelim')
})
test('a title-less SURPLUS logged snack (no window) also derives its name from item names', () => {
  // A snack on a 3-meal day has no window → it lands via the surplus-slot path (mealName: displayName(m)).
  const s = meal({ id: 's1', slot: 'snack', title: '', loggedAt: '2026-07-02T15:00:00', mealItems: [line('Alma'), line('Mandula')] })
  const plan = buildDayPlan(baseInput({ mealsPerDay: 3, meals: [s] }))
  const snack = plan.slots.find(sl => sl.mealId === 's1')!
  expect(snack.mealName).toBe('Alma, Mandula')
})

// ── nothing logged is ever dropped (surplus logged meals become extra done slots) ────────────────
test('a second logged snack on a 4-meal day (one snack window) is never dropped', () => {
  const s1 = meal({ id: 's1', slot: 'snack', title: 'Snack A', loggedAt: '2026-07-02T15:00:00', kcal: 200, p: 10, c: 20, f: 8 })
  const s2 = meal({ id: 's2', slot: 'snack', title: 'Snack B', loggedAt: '2026-07-02T18:30:00', kcal: 150, p: 8, c: 18, f: 5 })
  const plan = buildDayPlan(baseInput({ mealsPerDay: 4, meals: [s1, s2] }))
  const doneSnacks = plan.slots.filter(s => s.kind === 'snack' && s.state === 'done')
  expect(doneSnacks.map(s => s.mealId).sort()).toEqual(['s1', 's2'])
  expect(doneSnacks.map(s => s.time).sort()).toEqual(['15:00', '18:30'])
})
test('any logged snack on a 3-meal day (no snack window) is never dropped', () => {
  const s = meal({ id: 's1', slot: 'snack', title: 'Tízórai', loggedAt: '2026-07-02T15:00:00', kcal: 180, p: 9, c: 22, f: 6 })
  const plan = buildDayPlan(baseInput({ mealsPerDay: 3, meals: [s] }))
  const doneSnacks = plan.slots.filter(s => s.kind === 'snack' && s.state === 'done')
  expect(doneSnacks).toHaveLength(1)
  expect(doneSnacks[0]).toMatchObject({ mealId: 's1', mealName: 'Tízórai', time: '15:00', kcal: 180 })
})
test('done meal/snack slots carry the FULL logged-meal totals — nothing logged is dropped', () => {
  const meals = [
    meal({ id: 'b', slot: 'breakfast', loggedAt: '2026-07-02T08:00:00', kcal: 500, p: 40, c: 50, f: 15 }),
    meal({ id: 's1', slot: 'snack', loggedAt: '2026-07-02T11:00:00', kcal: 200, p: 10, c: 20, f: 8 }),
    meal({ id: 's2', slot: 'snack', loggedAt: '2026-07-02T15:00:00', kcal: 150, p: 8, c: 18, f: 5 }),
    meal({ id: 's3', slot: 'snack', loggedAt: '2026-07-02T18:00:00', kcal: 180, p: 9, c: 22, f: 6 }),
    meal({ id: 'd', slot: 'dinner', loggedAt: '2026-07-02T20:00:00', kcal: 700, p: 55, c: 60, f: 25 }),
  ]
  const plan = buildDayPlan(baseInput({ mealsPerDay: 4, meals })) // 1 snack window → s2 + s3 are extras
  const doneMeals = plan.slots.filter(s => s.state === 'done' && (s.kind === 'meal' || s.kind === 'snack'))
  expect(doneMeals).toHaveLength(meals.length) // every logged meal appears exactly once
  const sum = (k: 'kcal' | 'p' | 'c' | 'f') => doneMeals.reduce((acc, x) => acc + (x[k] ?? 0), 0)
  const expected = meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { kcal: 0, p: 0, c: 0, f: 0 })
  expect({ kcal: sum('kcal'), p: sum('p'), c: sum('c'), f: sum('f') }).toEqual(expected)
})

// ── buildDayPlan template branch (mezo-7102) ─────────────────────────────────
const templateRow = (over: Partial<SlotTemplateRow> & { label: string; anchor: SlotTemplateRow['anchor'] }): SlotTemplateRow => ({
  slotKind: 'lunch', role: 'standard', budgetPct: 50, ...over,
})
const twoLunchTemplate: SlotTemplate = {
  dayType: 'rest',
  slots: [
    templateRow({ label: 'Ebéd 1', anchor: { type: 'fixed', time: '12:00' } }),
    templateRow({ label: 'Ebéd 2', anchor: { type: 'fixed', time: '15:00' } }),
  ],
}
test('buildDayPlan with a template: un-logged windows carry the template labels, fixed times and slotKey', () => {
  const plan = buildDayPlan(baseInput({ template: twoLunchTemplate, meals: [] }))
  const ebed1 = plan.slots.find(s => s.label === 'Ebéd 1')!
  const ebed2 = plan.slots.find(s => s.label === 'Ebéd 2')!
  expect(ebed1).toMatchObject({ time: '12:00', slotKey: 'lunch' })
  expect(ebed2).toMatchObject({ time: '15:00', slotKey: 'lunch' })
})
test('buildDayPlan with a template: two logged lunch meals fill the two lunch windows in loggedAt order', () => {
  const early = meal({ id: 'lunch-early', slot: 'lunch', title: 'Korai ebéd', loggedAt: '2026-07-02T11:50:00' })
  const late = meal({ id: 'lunch-late', slot: 'lunch', title: 'Kései ebéd', loggedAt: '2026-07-02T15:10:00' })
  // Deliberately out of order in the input array — the cursor logic sorts by loggedAt (existing
  // behavior, pinned here for the template path).
  const plan = buildDayPlan(baseInput({ template: twoLunchTemplate, meals: [late, early] }))
  const ebed1 = plan.slots.find(s => s.label === 'Ebéd 1')!
  const ebed2 = plan.slots.find(s => s.label === 'Ebéd 2')!
  expect(ebed1).toMatchObject({ state: 'done', mealId: 'lunch-early' }) // earliest loggedAt fills the FIRST (by time) window
  expect(ebed2).toMatchObject({ state: 'done', mealId: 'lunch-late' })
})
test('buildDayPlan: template absent/null is a zero-regression pin — output DEEP-EQUALS the no-template path', () => {
  const plainInput = baseInput({ meals: [meal({ id: 'm1', slot: 'breakfast', loggedAt: '2026-07-02T08:00:00' })] })
  const withoutTemplate = buildDayPlan(plainInput)
  const withNullTemplate = buildDayPlan({ ...plainInput, template: null })
  expect(withNullTemplate).toEqual(withoutTemplate)
  expect(plainInput.template).toBeUndefined() // baseInput never sets template — absent is the default
})
test('buildDayPlan: a template whose every row is training-anchored, on a blockless day, never crashes — empty meal windows', () => {
  // Every row anchors to training_start/training_end; with `blocks: []` compileTemplate defensively
  // drops all of them (nothing to resolve against) → windows = [] flows into splitBudgetPct, which
  // must not throw (the guard fixed here) — the day still renders (protocol/block slots, top fields).
  const allTrainingAnchored: SlotTemplate = {
    dayType: 'training_am',
    slots: [
      templateRow({ label: 'Pre', slotKind: 'snack', anchor: { type: 'training_start', offsetMin: -45 } }),
      templateRow({ label: 'Post', slotKind: 'lunch', anchor: { type: 'training_end', offsetMin: 30 } }),
    ],
  }
  expect(() => buildDayPlan(baseInput({ template: allTrainingAnchored, blocks: [], meals: [] }))).not.toThrow()
  const plan = buildDayPlan(baseInput({ template: allTrainingAnchored, blocks: [], meals: [] }))
  expect(plan.slots.filter(s => s.slotKey)).toEqual([]) // no meal/snack windows at all
})

// ── midnight-crossing template axis (mezo-9rtw) ──────────────────────────────
// Repro from the mezo-7102 final review: wake 07:00 / bed 03:00 (crosses midnight) with a template
// producing Ebéd 13:00, Vacsora 20:00 and a bed−120 "Késői snack" that lands at 01:00 wall-clock —
// a time legitimately BEFORE wake on the raw HH:mm axis but AFTER the evening on the real day.
// Pre-fix, step 7 sorted by raw minutes (01:00 = 60 landed FIRST) and step 6 classified it 'missed'
// hours before it was even scheduled. Both must resolve on the unwrapped wake→bed axis instead.
test('buildDayPlan with a template on a NON-crossing day: unwrap is the identity — order/state match the pre-fix (raw-axis) expectations exactly', () => {
  // This is the non-crossing regression pin (mezo-9rtw): on a normal day `unwrap` is the identity,
  // so the sort/state machine must still produce exactly what the raw-minute axis always produced.
  const plan = buildDayPlan(baseInput({ template: twoLunchTemplate, meals: [], nowHHmm: '13:30' }))
  const named = plan.slots.filter(s => s.label === 'Ebéd 1' || s.label === 'Ebéd 2')
  expect(named.map(s => s.time)).toEqual(['12:00', '15:00'])
  // 13:30 is at/before Ebéd 1 (12:00) but not Ebéd 2 (15:00) → Ebéd 1 is "now", Ebéd 2 "pending".
  expect(named.map(s => s.state)).toEqual(['now', 'pending'])
})

describe('midnight-crossing template axis (mezo-9rtw)', () => {
  const midnightTemplate: SlotTemplate = {
    dayType: 'rest',
    slots: [
      templateRow({ label: 'Ebéd', slotKind: 'lunch', anchor: { type: 'fixed', time: '13:00' }, budgetPct: 45 }),
      templateRow({ label: 'Vacsora', slotKind: 'dinner', anchor: { type: 'fixed', time: '20:00' }, budgetPct: 40 }),
      templateRow({ label: 'Késői snack', slotKind: 'snack', anchor: { type: 'bed', offsetMin: -120 }, budgetPct: 15 }),
    ],
  }
  const crossingInput = (nowHHmm: string) =>
    baseInput({ wake: '07:00', bed: '03:00', template: midnightTemplate, meals: [], blocks: [], nowHHmm })
  const namedSlots = (plan: FuelPlanToday) => plan.slots.filter(s => ['Ebéd', 'Vacsora', 'Késői snack'].includes(s.label))

  test('nowHHmm 12:00: the 01:00 late slot sorts LAST and is "pending" (not "missed"); 13:00 is "now"', () => {
    const plan = buildDayPlan(crossingInput('12:00'))
    const named = namedSlots(plan)
    // Sort order on the unwrapped axis: 13:00 (780) < 20:00 (1200) < 01:00 (1500, unwrapped) — the
    // 01:00 slot sorts LAST despite its raw minute-of-day (60) being the smallest of the three.
    expect(named.map(s => s.label)).toEqual(['Ebéd', 'Vacsora', 'Késői snack'])
    expect(named.map(s => s.time)).toEqual(['13:00', '20:00', '01:00'])
    // now=12:00 precedes every unwrapped window (780/1200/1500 all > 720) → earliest (Ebéd) is "now".
    expect(named.map(s => s.state)).toEqual(['now', 'pending', 'pending'])
  })

  test('nowHHmm 00:30 (unwrapped past-midnight, still before bed 03:00): Vacsora is "now", Ebéd "missed", Késői snack stays "pending"', () => {
    const plan = buildDayPlan(crossingInput('00:30'))
    const named = namedSlots(plan)
    // unwrappedNow = 1470 (00:30 is before wake → +1440). Latest unlogged window at/before 1470
    // among {780, 1200, 1500} is 1200 (Vacsora) → Vacsora "now"; Ebéd (780 < 1470) "missed";
    // Késői snack (1500 > 1470) "pending".
    expect(named.map(s => s.label)).toEqual(['Ebéd', 'Vacsora', 'Késői snack'])
    expect(named.map(s => s.state)).toEqual(['missed', 'now', 'pending'])
  })
})

// ── protocol (stack-day) zones ───────────────────────────────────────────────
test('protocol slots map zones onto FuelKind and carry done-state straight from the entry\'s `taken`', () => {
  expect(ZONE_FUEL_KIND).toMatchObject({
    wake: 'wake', breakfast: 'snack', pre_workout: 'preworkout', post_workout: 'snack',
    lunch: 'midday', dinner: 'evening', evening: 'evening', bedtime: 'evening',
  })
  const slot = stackSlot({
    zone: 'evening',
    time: '21:00',
    label: 'Este',
    entries: [
      stackEntry({ pantryItemId: 'mg', name: 'Magnézium', dose: '300mg', taken: true }),
      stackEntry({ pantryItemId: 'omega', name: 'Omega-3', dose: '2g', taken: false }),
    ],
  })
  const plan = buildDayPlan(baseInput({ protocolSlots: [slot] }))
  const found = plan.slots.find(s => s.kind === 'evening')!
  expect(found.label).toBe('Este stack')
  expect(found.items!.map(it => it.done)).toEqual([true, false]) // mg taken, omega not
})
test('a protocol slot with a skipped entry drops that item from the rendered stack card', () => {
  const slot = stackSlot({
    zone: 'evening',
    time: '21:00',
    label: 'Este',
    entries: [
      stackEntry({ pantryItemId: 'mg', name: 'Magnézium', taken: true }),
      stackEntry({ pantryItemId: 'pwo', name: 'PWO', skippedToday: true }),
    ],
  })
  const plan = buildDayPlan(baseInput({ protocolSlots: [slot] }))
  const found = plan.slots.find(s => s.kind === 'evening')!
  expect(found.items).toHaveLength(1) // the skipped entry never renders as an item pip
  expect(found.items![0].label).toContain('Magnézium')
})
test('a protocol slot whose entries are ALL skipped is dropped entirely — never an empty stack card', () => {
  const slot = stackSlot({
    zone: 'breakfast',
    time: '06:20',
    label: 'Reggeli',
    entries: [stackEntry({ pantryItemId: 'pwo', name: 'PWO', skippedToday: true })],
  })
  const plan = baseInput({ protocolSlots: [slot] })
  const built = buildDayPlan(plan)
  expect(built.slots.some(s => s.label === 'Reggeli stack')).toBe(false)
})

// ── blocks render as workout/sport slots ─────────────────────────────────────
test('blocks render as workout/sport slots (run → sport carrying Futás)', () => {
  const blocks: PlannerBlock[] = [
    { kind: 'gym', time: '07:30', durationMin: 78, label: 'Pull Day · gym' },
    { kind: 'run', time: '18:00', durationMin: 40, label: 'Futás · 6km' },
  ]
  const plan = buildDayPlan(baseInput({ blocks, nowHHmm: '20:00' }))
  const gymSlot = plan.slots.find(s => s.kind === 'workout')!
  const runSlot = plan.slots.find(s => s.kind === 'sport')!
  expect(gymSlot.label).toBe('Pull Day · gym')
  expect(gymSlot.state).toBe('done') // 07:30+78 = 08:48 has passed by 20:00
  expect(runSlot.label).toContain('Futás')
})

// ── top context fields ───────────────────────────────────────────────────────
test('top fields derive workout/volleyball/kitchenClose/caffeineCutoff from the blocks + rhythm', () => {
  const plan = buildDayPlan(
    baseInput({
      blocks: [
        { kind: 'gym', time: '07:30', durationMin: 78, label: 'Pull Day · gym' },
        { kind: 'sport', time: '18:15', durationMin: 90, label: 'Röpi' },
      ],
    }),
  )
  expect(plan.workout).toEqual({ type: 'Pull Day', start: '07:30', end: '08:48', duration: 78 })
  expect(plan.volleyball).toEqual({ start: '18:15', end: '19:45', noneToday: false })
  expect(plan.bedtime).toBe('23:00')
  expect(plan.kitchenClose).toBe('21:30') // bed − 90
  expect(plan.caffeineCutoff).toBe('14:00')
})
test('workout falls back and volleyball reports noneToday when the blocks are absent', () => {
  const plan = buildDayPlan(baseInput())
  expect(plan.workout).toEqual({ type: '', start: '—', end: '—', duration: 0 })
  expect(plan.volleyball).toEqual({ start: '—', end: '—', noneToday: true })
})
test('a gym block with unknown duration reports end "—" / duration 0 in the top field', () => {
  const plan = buildDayPlan(baseInput({ blocks: [{ kind: 'gym', time: '07:30', durationMin: null, label: 'Edzés · gym' }] }))
  expect(plan.workout).toEqual({ type: 'Edzés', start: '07:30', end: '—', duration: 0 })
})

// ── slot identity + determinism (mezo-53su) ──────────────────────────────────
// (the now-aware re-flow cases were removed in mezo-1oy5 — the plan is now fixed; `now` only
//  classifies each window's state, it never moves a window. See the fixed-plan state tests below.)
describe('slot identity + determinism (mezo-53su)', () => {
  // Baseline inputs used across the cases: wake 06:00, bed 23:00 -> eatingStart 06:45, kitchenClose 21:30.
  const base = { wake: '06:00', bed: '23:00', mealsPerDay: 4, blocks: [], budget: NO_BUDGET, meals: [], recipes: [], protocolSlots: [], caffeineCutoff: '14:00' }

  it('meal slots carry their slotKey; block slots do not', () => {
    const plan = buildDayPlan({ ...base, blocks: [{ kind: 'gym', label: 'Pull', time: '07:30', durationMin: 60 }], nowHHmm: '06:00' })
    const mealSlot = plan.slots.find(s => s.label === 'Reggeli')!
    const block = plan.slots.find(s => s.kind === 'workout')!
    expect(mealSlot.slotKey).toBe('breakfast')
    expect(block.slotKey).toBeUndefined()
  })

  it('is deterministic: same inputs, same plan', () => {
    const a = buildDayPlan({ ...base, nowHHmm: '13:30' })
    const b = buildDayPlan({ ...base, nowHHmm: '13:30' })
    expect(a).toEqual(b)
  })

  it('passes the caffeineCutoff input through', () => {
    const plan = buildDayPlan({ ...base, caffeineCutoff: '12:30', nowHHmm: '06:00' })
    expect(plan.caffeineCutoff).toBe('12:30')
  })
})

// ── fixed-plan state + energy field (mezo-1oy5) ──────────────────────────────
test('fixed plan: pending meal windows keep their anchored time regardless of now (no reflow)', () => {
  const early = buildDayPlan(baseInput({ nowHHmm: '05:00', meals: [] }))
  const late = buildDayPlan(baseInput({ nowHHmm: '23:19', meals: [] }))
  const breakfastEarly = early.slots.find(s => s.slotKey === 'breakfast')!
  const breakfastLate = late.slots.find(s => s.slotKey === 'breakfast')!
  expect(breakfastLate.time).toBe(breakfastEarly.time) // breakfast never migrates to the evening
})
test('evening, nothing logged: past meal windows are "missed", the last open one is "now"', () => {
  const plan = buildDayPlan(baseInput({ nowHHmm: '23:19', meals: [], bed: '23:59' }))
  const meals = plan.slots.filter(s => s.slotKey && (s.kind === 'meal' || s.kind === 'snack'))
  expect(meals.filter(s => s.state === 'missed').length).toBeGreaterThan(0)
  expect(meals.filter(s => s.state === 'now').length).toBe(1) // exactly one current/last-open window
  expect(meals.every(s => s.state !== 'pending')).toBe(true) // nothing is "upcoming" at 23:19
})
test('midday: the window you are currently in is "now", earlier unlogged is "missed", later is "pending"', () => {
  const plan = buildDayPlan(baseInput({ nowHHmm: '14:30', meals: [] }))
  const meals = plan.slots.filter(s => s.slotKey).sort((a, z) => toMin(a.time) - toMin(z.time))
  const nowIdx = meals.findIndex(s => s.state === 'now')
  expect(nowIdx).toBeGreaterThanOrEqual(0)
  expect(meals.slice(0, nowIdx).every(s => s.state === 'missed')).toBe(true)
  expect(meals.slice(nowIdx + 1).every(s => s.state === 'pending')).toBe(true)
})
test('no two meal slots share the same minute (collision-free) even with two blocks at 18:00', () => {
  const blocks = [
    { kind: 'gym' as const, time: '18:00', durationMin: 60, label: 'Plyo Leg' },
    { kind: 'sport' as const, time: '18:00', durationMin: 240, label: 'Volleyball' },
  ]
  const plan = buildDayPlan(baseInput({ nowHHmm: '13:00', meals: [], blocks }))
  const mealTimes = plan.slots.filter(s => s.slotKey).map(s => s.time)
  expect(new Set(mealTimes).size).toBe(mealTimes.length)
})
test('plan carries the energy breakdown from the budget', () => {
  const plan = buildDayPlan(baseInput({ nowHHmm: '13:00', meals: [] }))
  expect(plan.energy).toEqual(expect.objectContaining({ base: expect.any(Number), activity: expect.any(Number), balance: expect.any(Number), target: expect.any(Number) }))
})

// ── peri-workout snack windows (mezo-1oy5) ───────────────────────────────────
const snacks = (p: FuelPlanToday) => p.slots.filter(s => s.kind === 'snack').length
test('a significant block (≥90min or ≥300kcal) adds a peri-workout snack window', () => {
  // A 3-meal day carries no baseline snack near the pre-workout hour, so the peri-snack is
  // unambiguously additive (the 4-meal day's 17:49 Uzsonna would otherwise dedupe it — asserted below).
  const noBlock = buildDayPlan(baseInput({ mealsPerDay: 3, nowHHmm: '05:00', meals: [], blocks: [] }))
  const bigBlock = buildDayPlan(baseInput({
    mealsPerDay: 3, nowHHmm: '05:00', meals: [],
    blocks: [{ kind: 'sport', time: '18:00', durationMin: 240, label: 'Volleyball' }],
  }))
  expect(snacks(bigBlock)).toBeGreaterThan(snacks(noBlock)) // one extra peri-snack around the session
})
test('the peri-snack is deduped when a meal/snack window already covers the pre-workout min-gap', () => {
  // On a 4-meal day the Uzsonna (≈17:49) already sits within MIN_SLOT_GAP_MIN of the 17:00 peri
  // window, so no redundant second snack is added — the snack count matches the no-block day.
  const noBlock = buildDayPlan(baseInput({ mealsPerDay: 4, nowHHmm: '05:00', meals: [], blocks: [] }))
  const bigBlock = buildDayPlan(baseInput({
    mealsPerDay: 4, nowHHmm: '05:00', meals: [],
    blocks: [{ kind: 'sport', time: '18:00', durationMin: 240, label: 'Volleyball' }],
  }))
  expect(snacks(bigBlock)).toBe(snacks(noBlock)) // deduped: the existing snack already covers pre-workout
})

// ── MET-based activity energy (mezo-1oy5) ────────────────────────────────────
test('blockKcal = MET × kg × hours; null duration falls back per kind', () => {
  expect(blockKcal('gym', 60, 78.6)).toBeCloseTo(6.0 * 78.6 * 1, 1) // ≈472
  expect(blockKcal('sport', 240, 78.6)).toBeCloseTo(4.5 * 78.6 * 4, 1) // ≈1415
  expect(blockKcal('run', null, 78.6)).toBeCloseTo(9.5 * 78.6 * (45 / 60), 1) // DEFAULT_RUN_MIN
})
test('activityKcal sums every scheduled block (gym + sport + run all count)', () => {
  const blocks = [
    { kind: 'gym' as const, time: '18:00', durationMin: 60, label: 'Plyo Leg' },
    { kind: 'sport' as const, time: '18:00', durationMin: 240, label: 'Volleyball' },
    { kind: 'run' as const, time: '07:00', durationMin: 40, label: 'Futás · 6km' },
  ]
  expect(activityKcal(blocks, 78.6)).toBeCloseTo(6.0 * 78.6 + 4.5 * 78.6 * 4 + blockKcal('run', 40, 78.6), 0) // ≈2384
})
