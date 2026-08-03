// matchMealsToStack — deterministic meal-match logic for the Fuel/Stack day (mezo-vx9v). Covers:
// fat-bound zone suggestion ranking + metric, protein-bound post_workout suggestion, the max-1-
// per-zone cap + the no-bound-entry empty case, today verdict ok/warn + advice, yesterday's
// dayLabel, and skippedToday entries being excluded from both suggestions and verdicts.

import { FAT_BOUND_NEEDLES, FAT_OK_G, PROTEIN_OK_G, matchMealsToStack } from '@/features/fuel/logic/matchMealsToStack'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'
import type { FuelMeal, Recipe, StackZoneKey } from '@/data/types'

// ── fixture factories ────────────────────────────────────────────────────────
function entry(over: Partial<StackDayEntry> & { name: string }): StackDayEntry {
  return {
    occurrenceId: 'o1',
    pantryItemId: 'p1',
    persistedZone: 'lunch',
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
function slot(over: Partial<StackDaySlot> & { zone: StackZoneKey; entries: StackDayEntry[] }): StackDaySlot {
  return {
    time: '12:00',
    label: 'Zone',
    anchorNote: null,
    ...over,
  }
}
function meal(over: Partial<FuelMeal> & { slot: string; loggedAt: string }): FuelMeal {
  return {
    id: 'm1',
    title: 'Meal',
    score: null,
    kcal: 500,
    p: 40,
    c: 50,
    f: 15,
    mealItems: [],
    items: [],
    tags: [],
    mealDate: '2026-08-03',
    ...over,
  }
}
function recipe(over: Partial<Recipe> & { id: string }): Recipe {
  return {
    name: `Recipe ${over.id}`,
    slot: '',
    category: 'lunch',
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

// ── constants sanity ─────────────────────────────────────────────────────────
test('exported constants match the spec', () => {
  expect(FAT_BOUND_NEEDLES).toEqual(['d3', 'k2', 'omega', 'halolaj', 'krill', 'kurkum', 'q10', 'koenzim'])
  expect(FAT_OK_G).toBe(15)
  expect(PROTEIN_OK_G).toBe(25)
})

// ── 1. fat-bound zone: suggestion ranking + metric ───────────────────────────
describe('fat-bound zone suggestion', () => {
  test('suggests the fattier-per-serving candidate recipe, naming the metric', () => {
    const slots: StackDaySlot[] = [
      slot({ zone: 'lunch', time: '12:30', label: 'Ebéd', entries: [entry({ name: 'D3-K2', persistedZone: 'lunch' })] }),
    ]
    const recipes: Recipe[] = [
      recipe({ id: 'fatty', category: 'lunch', macros: { kcal: 800, p: 40, c: 60, f: 64 }, servings: 2 }), // 32g f/serving
      recipe({ id: 'lean', category: 'lunch', macros: { kcal: 500, p: 40, c: 50, f: 8 }, servings: 1 }), // 8g f/serving
    ]
    const result = matchMealsToStack(slots, recipes, [], [])
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0]).toMatchObject({
      zone: 'lunch',
      zoneLabel: 'Ebéd',
      time: '12:30',
      recipeId: 'fatty',
      recipeName: 'Recipe fatty',
      metric: '32g zsír / adag',
    })
  })
})

// ── 2. protein-bound post_workout zone: suggestion ranking + metric ─────────
describe('protein-bound post_workout suggestion', () => {
  test('suggests the highest protein-per-serving recipe among role=post_workout candidates', () => {
    const slots: StackDaySlot[] = [
      slot({ zone: 'post_workout', time: '19:00', label: 'Edzés után', entries: [entry({ name: 'Whey Protein', persistedZone: 'post_workout' })] }),
    ]
    const recipes: Recipe[] = [
      recipe({ id: 'shake', role: 'post_workout', macros: { kcal: 400, p: 84, c: 20, f: 5 }, servings: 2 }), // 42g p/serving
      recipe({ id: 'other', role: 'post_workout', macros: { kcal: 400, p: 20, c: 20, f: 5 }, servings: 1 }),
    ]
    const result = matchMealsToStack(slots, recipes, [], [])
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0]).toMatchObject({
      zone: 'post_workout',
      recipeId: 'shake',
      recipeName: 'Recipe shake',
      metric: '42g fehérje / adag',
    })
  })
})

// ── candidate filter: category/role narrowing excludes a "better" cross-zone recipe ──
describe('candidate filter narrows to the zone category/role', () => {
  test('a higher-fat dinner recipe is excluded from a lunch suggestion — matching-category wins despite less fat', () => {
    const slots: StackDaySlot[] = [
      slot({ zone: 'lunch', time: '12:30', label: 'Ebéd', entries: [entry({ name: 'D3', persistedZone: 'lunch' })] }),
    ]
    const recipes: Recipe[] = [
      recipe({ id: 'lunch-lean', category: 'lunch', macros: { kcal: 500, p: 40, c: 50, f: 10 } }), // 10g f/serving, matching category
      recipe({ id: 'dinner-fatty', category: 'dinner', macros: { kcal: 500, p: 40, c: 50, f: 40 } }), // 40g f/serving, wrong category
    ]
    const result = matchMealsToStack(slots, recipes, [], [])
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0]).toMatchObject({ zone: 'lunch', recipeId: 'lunch-lean', metric: '10g zsír / adag' })
  })

  test('a higher-protein standard-role recipe is excluded from a post_workout suggestion — role=post_workout wins', () => {
    const slots: StackDaySlot[] = [
      slot({ zone: 'post_workout', time: '19:00', label: 'Edzés után', entries: [entry({ name: 'Whey Protein', persistedZone: 'post_workout' })] }),
    ]
    const recipes: Recipe[] = [
      recipe({ id: 'pwo-shake', role: 'post_workout', macros: { kcal: 400, p: 30, c: 20, f: 5 } }), // 30g p/serving, matching role
      recipe({ id: 'standard-highprotein', role: 'standard', macros: { kcal: 400, p: 90, c: 20, f: 5 } }), // 90g p/serving, wrong role
    ]
    const result = matchMealsToStack(slots, recipes, [], [])
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0]).toMatchObject({ zone: 'post_workout', recipeId: 'pwo-shake', metric: '30g fehérje / adag' })
  })
})

// ── 3. suggestion cap + empty cases ──────────────────────────────────────────
describe('suggestion cap + empty cases', () => {
  test('at most one suggestion per zone, even with many candidate recipes', () => {
    const slots: StackDaySlot[] = [
      slot({ zone: 'lunch', time: '12:30', label: 'Ebéd', entries: [entry({ name: 'Omega-3', persistedZone: 'lunch' })] }),
    ]
    const recipes: Recipe[] = [
      recipe({ id: 'a', category: 'lunch', macros: { kcal: 500, p: 30, c: 50, f: 10 } }),
      recipe({ id: 'b', category: 'lunch', macros: { kcal: 500, p: 30, c: 50, f: 20 } }),
      recipe({ id: 'c', category: 'lunch', macros: { kcal: 500, p: 30, c: 50, f: 30 } }),
    ]
    const result = matchMealsToStack(slots, recipes, [], [])
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0].recipeId).toBe('c')
  })

  test('a zone with no fat/protein-bound entries produces no suggestions', () => {
    const slots: StackDaySlot[] = [
      slot({ zone: 'breakfast', time: '07:00', label: 'Reggeli', entries: [entry({ name: 'Magnézium', persistedZone: 'breakfast' })] }),
    ]
    const recipes: Recipe[] = [recipe({ id: 'a', category: 'breakfast', macros: { kcal: 500, p: 30, c: 50, f: 30 } })]
    const result = matchMealsToStack(slots, recipes, [], [])
    expect(result.suggestions).toEqual([])
  })
})

// ── 4. today verdict: ok / warn + advice ─────────────────────────────────────
describe('today verdict', () => {
  test('ok when the logged meal in the fat-bound zone hits FAT_OK_G', () => {
    const slots: StackDaySlot[] = [
      slot({ zone: 'lunch', time: '12:30', label: 'Ebéd', entries: [entry({ name: 'D3', persistedZone: 'lunch' })] }),
    ]
    const todayMeals: FuelMeal[] = [meal({ slot: 'lunch', loggedAt: '2026-08-03T12:35:00', title: 'Csirke rizzsel', f: 28 })]
    const result = matchMealsToStack(slots, [], todayMeals, [])
    expect(result.verdicts).toHaveLength(1)
    expect(result.verdicts[0]).toMatchObject({
      zone: 'lunch',
      dayLabel: 'ma',
      mealTitle: 'Csirke rizzsel',
      ok: true,
      metric: '28g zsír',
      advice: null,
    })
  })

  test('not ok + advice naming the first fat-bound entry when below FAT_OK_G', () => {
    const slots: StackDaySlot[] = [
      slot({ zone: 'lunch', time: '12:30', label: 'Ebéd', entries: [entry({ name: 'D3', persistedZone: 'lunch' })] }),
    ]
    const todayMeals: FuelMeal[] = [meal({ slot: 'lunch', loggedAt: '2026-08-03T12:35:00', title: 'Saláta', f: 6 })]
    const result = matchMealsToStack(slots, [], todayMeals, [])
    expect(result.verdicts).toHaveLength(1)
    expect(result.verdicts[0]).toMatchObject({
      zone: 'lunch',
      dayLabel: 'ma',
      mealTitle: 'Saláta',
      ok: false,
      metric: '6g zsír',
      advice: 'A D3 zsíros étkezést kér — legközelebb tedd zsírosabb fogás mellé, vagy mozgasd vacsorára.',
    })
  })
})

// ── 5. yesterday's meals → dayLabel 'tegnap' ─────────────────────────────────
describe('yesterday verdict', () => {
  test('yesterday meals produce tegnap-labelled verdicts', () => {
    const slots: StackDaySlot[] = [
      slot({ zone: 'dinner', time: '19:00', label: 'Vacsora', entries: [entry({ name: 'Omega-3', persistedZone: 'dinner' })] }),
    ]
    const yesterdayMeals: FuelMeal[] = [meal({ slot: 'dinner', loggedAt: '2026-08-02T19:10:00', title: 'Lazac', f: 22 })]
    const result = matchMealsToStack(slots, [], [], yesterdayMeals)
    expect(result.verdicts).toHaveLength(1)
    expect(result.verdicts[0]).toMatchObject({ zone: 'dinner', dayLabel: 'tegnap', mealTitle: 'Lazac', ok: true, metric: '22g zsír' })
  })
})

// ── 6. skippedToday entries are excluded ─────────────────────────────────────
describe('skippedToday exclusion', () => {
  test('a skippedToday fat-bound entry triggers neither a suggestion nor a verdict', () => {
    const slots: StackDaySlot[] = [
      slot({ zone: 'lunch', time: '12:30', label: 'Ebéd', entries: [entry({ name: 'D3', persistedZone: 'lunch', skippedToday: true })] }),
    ]
    const recipes: Recipe[] = [recipe({ id: 'a', category: 'lunch', macros: { kcal: 500, p: 30, c: 50, f: 30 } })]
    const todayMeals: FuelMeal[] = [meal({ slot: 'lunch', loggedAt: '2026-08-03T12:35:00', title: 'Saláta', f: 6 })]
    const result = matchMealsToStack(slots, recipes, todayMeals, [])
    expect(result.suggestions).toEqual([])
    expect(result.verdicts).toEqual([])
  })
})
