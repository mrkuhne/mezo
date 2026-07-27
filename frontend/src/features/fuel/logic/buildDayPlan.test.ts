import {
  activityKcal,
  blockKcal,
  buildDayPlan,
  deriveDailyBudget,
  mealSlotKey,
  pickRecipe,
  placeWindows,
  splitBudget,
  PROTOCOL_KIND,
  type DayBudget,
  type DayPlanInput,
  type Macro4,
  type PlannedWindow,
  type PlannerBlock,
} from '@/features/fuel/logic/buildDayPlan'
import type { FuelMeal, FuelPlanToday, MealItemLine, ProtocolSlotData, Recipe } from '@/data/types'
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
    ...over,
  }
}
function proto(over: Partial<ProtocolSlotData> & { kind: string; time: string }): ProtocolSlotData {
  return {
    window: 'w',
    kindColor: '#fff',
    items: [],
    reasoning: 'why',
    primary: false,
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
    intakes: [],
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

// ── protocol + intake pips ───────────────────────────────────────────────────
test('protocol slots map kinds onto FuelKind and set item done-state from intakes', () => {
  expect(PROTOCOL_KIND).toMatchObject({ morning: 'wake', 'pre-fuel': 'snack', 'pre-workout': 'preworkout', 'fat-bound': 'midday', evening: 'evening' })
  const p = proto({
    kind: 'evening',
    time: '21:00',
    items: [
      { refId: 'mg', name: 'Magnézium', dose: '300mg', color: '#f' },
      { refId: 'omega', name: 'Omega-3', dose: '2g', color: '#f' },
    ],
  })
  const plan = buildDayPlan(baseInput({ protocolSlots: [p], intakes: [{ id: 'i1', pantryItemId: 'mg', takenAt: 'x', dose: null, slotKey: null }] }))
  const slot = plan.slots.find(s => s.kind === 'evening')!
  expect(slot.items!.map(it => it.done)).toEqual([true, false]) // mg taken, omega not
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
  const base = { wake: '06:00', bed: '23:00', mealsPerDay: 4, blocks: [], budget: NO_BUDGET, meals: [], recipes: [], protocolSlots: [], intakes: [], caffeineCutoff: '14:00' }

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
