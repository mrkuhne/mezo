import {
  buildDayPlan,
  deriveDailyBudget,
  mealSlotKey,
  pickRecipe,
  placeWindows,
  splitBudget,
  PROTOCOL_KIND,
  type DayPlanInput,
  type Macro4,
  type PlannedWindow,
  type PlannerBlock,
} from '@/features/fuel/logic/buildDayPlan'
import type { FuelMeal, MacroSet, ProtocolSlotData, Recipe } from '@/data/types'
import { toHHmm } from '@/data/fuel/fuelConfig'

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
const NO_BUDGET: Macro4 = { kcal: 2400, p: 180, c: 240, f: 73 }
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
test('deriveDailyBudget derives carbs/fat from a prescription segment', () => {
  const fallback: MacroSet = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  // f = round(2150×0.275/9) = 66 ; c = round((2150 − 163×4 − 66×9)/4) = 226
  expect(deriveDailyBudget({ kcal: 2150, proteinG: 163 }, fallback)).toEqual({ kcal: 2150, p: 163, c: 226, f: 66 })
})
test('deriveDailyBudget passes the fallback MacroSet through (no water) when there is no segment', () => {
  const fallback: MacroSet = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  expect(deriveDailyBudget(null, fallback)).toEqual({ kcal: 3100, p: 220, c: 380, f: 95 })
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
  const plan = buildDayPlan(baseInput({ budget: { kcal: 2100, p: 168, c: 260, f: 64 }, recipes: [rec], nowHHmm: '05:00' }))
  const breakfast = plan.slots.find(s => s.label === 'Reggeli')!
  expect(breakfast.state).toBe('pending')
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

// ── now-flag ─────────────────────────────────────────────────────────────────
test('now-flag lands on the LAST non-done slot at or before nowHHmm', () => {
  const logged = meal({ id: 'm1', slot: 'breakfast', loggedAt: '2026-07-02T08:40:00' })
  const plan = buildDayPlan(baseInput({ meals: [logged], nowHHmm: '15:00' }))
  const nowSlots = plan.slots.filter(s => s.state === 'now')
  expect(nowSlots).toHaveLength(1)
  const now = nowSlots[0]
  const [h, m] = now.time.split(':').map(Number)
  expect(h * 60 + m).toBeLessThanOrEqual(15 * 60)
  // no later slot is also at/before now and non-done
  for (const s of plan.slots) {
    if (s === now) continue
    const [hh, mm] = s.time.split(':').map(Number)
    if (hh * 60 + mm <= 15 * 60 && s.state !== 'done') expect(hh * 60 + mm).toBeLessThanOrEqual(h * 60 + m)
  }
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
