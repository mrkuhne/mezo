import { describe, it, expect } from 'vitest'
import {
  lineMacros, draftTotals, draftNutrients, draftQualityLines, scaleServings, diffLineKeys,
  draftToInput, goalRole, mealToDraft,
} from '@/data/fuel/workshopState'
import type { FuelMeal, MealItemLine, Recipe, WorkshopDraft, WorkshopLine } from '@/data/types'
import type { PickableIngredient } from '@/data/fuel/pantryPickables'

const zab: PickableIngredient = {
  id: 'ing-zab', name: 'Zabpehely', brand: '', source: 'kifli.hu', category: 'carb',
  per: 100, unit: 'g', macros: { kcal: 372, p: 13.5, c: 60, f: 7 },
  // A négy tárolt tény /100 g — a `draftNutrients` próbái ezen mérnek.
  fiberG: 10, sugarG: 1, saltG: 0.02, saturatedFatG: 1.2,
  price: 0, priceUnit: '', pkg: '', micros: [], nova: 1, stock: null,
  lastUsed: '—', usedInRecipes: 0, kind: 'food',
}
const pool: PickableIngredient[] = [zab]

// Őszinte-null a Műhely előnézetében (mezo-hygp): a vázlat tápérték-tényei KIZÁRÓLAG feloldott
// kamra-sorból jöhetnek — a modell makrót javasolhat (`est`), tápanyag-tényt SOHA.
describe('draftNutrients', () => {
  const withEstimate: WorkshopDraft = {
    name: 'Teszt', category: 'lunch', servings: 1, steps: [],
    lines: [
      { source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 100, unit: 'g' },
      { source: 'estimate', refId: null, name: 'Fűszerek', amount: 1, unit: 'adag', est: { kcal: 15, p: 1, c: 3, f: 0 } },
    ],
  }

  it('only a resolved pantry row contributes a fact', () => {
    expect(draftNutrients(withEstimate, pool)).toEqual({
      fiberG: 10, sugarG: 1, saltG: 0.02, saturatedFatG: 1.2,
    })
  })

  it('a draft with no resolvable pantry row keeps every fact null (never a fabricated 0)', () => {
    const estimateOnly: WorkshopDraft = { ...withEstimate, lines: [withEstimate.lines[1]] }
    expect(draftNutrients(estimateOnly, pool)).toEqual({
      fiberG: null, sugarG: null, saltG: null, saturatedFatG: null,
    })
  })
})

describe('draftQualityLines', () => {
  it('an estimate line has no NOVA and no gram basis — both honestly null', () => {
    const draft: WorkshopDraft = {
      name: 'Teszt', category: 'lunch', servings: 1, steps: [],
      lines: [
        { source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 70, unit: 'g' },
        { source: 'estimate', refId: null, name: 'Fűszerek', amount: 1, unit: 'adag', est: { kcal: 15, p: 1, c: 3, f: 0 } },
      ],
    }
    expect(draftQualityLines(draft, pool)).toEqual([
      { grams: 70, kcal: 260, nova: 1 },
      { grams: null, kcal: 15, nova: null },
    ])
  })
})

describe('lineMacros', () => {
  it('pantry line resolves via lineContribution', () => {
    const line: WorkshopLine = { source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 70, unit: 'g' }
    expect(lineMacros(line, pool)).toEqual({ kcal: 260, p: 9, c: 42, f: 5 })
  })

  it('unresolved pantry ref returns null (honest dash)', () => {
    const line: WorkshopLine = { source: 'pantry', refId: 'gone', name: 'X', amount: 70, unit: 'g' }
    expect(lineMacros(line, pool)).toBeNull()
  })

  it('estimate line returns its est totals', () => {
    const line: WorkshopLine = {
      source: 'estimate', refId: null, name: 'Csirkemell', amount: 150, unit: 'g',
      est: { kcal: 250, p: 45, c: 0, f: 6 },
    }
    expect(lineMacros(line, pool)).toEqual({ kcal: 250, p: 45, c: 0, f: 6 })
  })
})

describe('draftTotals', () => {
  it('sums non-null line macros, skipping unresolved lines', () => {
    const draft: WorkshopDraft = {
      name: 'Teszt', category: 'breakfast', servings: 2, steps: [],
      lines: [
        { source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 70, unit: 'g' },
        { source: 'pantry', refId: 'gone', name: 'X', amount: 50, unit: 'g' },
        { source: 'estimate', refId: null, name: 'Csirkemell', amount: 150, unit: 'g', est: { kcal: 250, p: 45, c: 0, f: 6 } },
      ],
    }
    expect(draftTotals(draft, pool)).toEqual({ kcal: 260 + 250, p: 9 + 45, c: 42 + 0, f: 5 + 6 })
  })
})

describe('scaleServings', () => {
  const draft: WorkshopDraft = {
    name: 'Teszt', category: 'breakfast', servings: 2, steps: [],
    lines: [
      { source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 70, unit: 'g' },
      { source: 'estimate', refId: null, name: 'Csirkemell', amount: 150, unit: 'g', est: { kcal: 250, p: 45, c: 0, f: 6 } },
    ],
  }

  it('doubles amounts (5g rounding) and est totals going 2 -> 4 servings', () => {
    const scaled = scaleServings(draft, 4)
    expect(scaled.servings).toBe(4)
    expect(scaled.lines[0].amount).toBe(140)
    expect(scaled.lines[1].amount).toBe(300)
    expect(scaled.lines[1].est).toEqual({ kcal: 500, p: 90, c: 0, f: 12 })
  })

  it('clamps servings to 1..12', () => {
    expect(scaleServings(draft, 0).servings).toBe(1)
    expect(scaleServings(draft, 99).servings).toBe(12)
  })

  it('keeps the per-serving totals invariant within rounding', () => {
    const scaled = scaleServings(draft, 4)
    const origTotals = draftTotals(draft, pool)
    const scaledTotals = draftTotals(scaled, pool)
    expect(scaledTotals.kcal / 4).toBeCloseTo(origTotals.kcal / 2, 0)
    expect(scaledTotals.p / 4).toBeCloseTo(origTotals.p / 2, 0)
    expect(scaledTotals.c / 4).toBeCloseTo(origTotals.c / 2, 0)
    expect(scaledTotals.f / 4).toBeCloseTo(origTotals.f / 2, 0)
  })
})

describe('diffLineKeys', () => {
  const prev: WorkshopDraft = {
    name: 'Teszt', category: 'breakfast', servings: 2, steps: [],
    lines: [
      { source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 70, unit: 'g' },
      { source: 'estimate', refId: null, name: 'Csirkemell', amount: 150, unit: 'g', est: { kcal: 250, p: 45, c: 0, f: 6 } },
    ],
  }

  it('flags added and amount-changed lines only', () => {
    const next: WorkshopDraft = {
      ...prev,
      lines: [
        { source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 70, unit: 'g' }, // unchanged
        { source: 'estimate', refId: null, name: 'Csirkemell', amount: 200, unit: 'g', est: { kcal: 330, p: 60, c: 0, f: 8 } }, // changed
        { source: 'pantry', refId: 'ing-mez', name: 'Méz', amount: 12, unit: 'g' }, // added
      ],
    }
    expect(diffLineKeys(prev, next)).toEqual(['est:Csirkemell', 'ing-mez'])
  })

  it('flags every line as added when there is no previous draft', () => {
    expect(diffLineKeys(null, prev)).toEqual(['ing-zab', 'est:Csirkemell'])
  })

  it('flags nothing when nothing changed', () => {
    expect(diffLineKeys(prev, { ...prev, lines: [...prev.lines] })).toEqual([])
  })
})

describe('draftToInput', () => {
  const base = { slot: 'reggeli', tags: ['gyors'], starred: true, prepMins: 10, cookMins: 5 }

  it('returns null while any line is an estimate (save gate)', () => {
    const draft: WorkshopDraft = {
      name: 'Teszt', category: 'breakfast', servings: 2, steps: [],
      lines: [
        { source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 70, unit: 'g' },
        { source: 'estimate', refId: null, name: 'Csirkemell', amount: 150, unit: 'g', est: { kcal: 250, p: 45, c: 0, f: 6 } },
      ],
    }
    expect(draftToInput(draft, base, 'standard')).toBeNull()
  })

  it('maps refId -> pantryItemId and carries base fields verbatim once every line is pantry', () => {
    const draft: WorkshopDraft = {
      name: 'Teszt', category: 'breakfast', servings: 2, steps: [],
      lines: [{ source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 70, unit: 'g' }],
    }
    expect(draftToInput(draft, base, 'pre_workout')).toEqual({
      name: 'Teszt', slot: 'reggeli', category: 'breakfast', servings: 2,
      prepMins: 10, cookMins: 5, tags: ['gyors'], starred: true, role: 'pre_workout',
      ingredients: [{ pantryItemId: 'ing-zab', amount: 70, unit: 'g' }],
    })
  })
})

describe('goalRole', () => {
  it('maps pre_workout/post_workout through, everything else to standard', () => {
    expect(goalRole('pre_workout')).toBe('pre_workout')
    expect(goalRole('post_workout')).toBe('post_workout')
    expect(goalRole('high_protein')).toBe('standard')
    expect(goalRole('before_bed')).toBe('standard')
    expect(goalRole('breakfast')).toBe('standard')
    expect(goalRole(null)).toBe('standard')
  })
})

// Logolt étkezésből recept (mezo-n9wgg): a Műhely vázlata az étkezés sorait hordozza. Kamra-sor
// 1:1, becslés-sor becslésként marad (a mentés-kapu miatt cserélni kell), recept-sor kibontva.
describe('mealToDraft', () => {
  const line = (l: Partial<MealItemLine>): MealItemLine => ({
    source: 'pantry', refId: 'ing-zab', amount: 50, unit: 'g', name: 'Zabpehely',
    contribution: { kcal: 186, p: 7, c: 30, f: 4 }, ...l,
  })
  const meal = (lines: MealItemLine[], extra: Partial<FuelMeal> = {}): FuelMeal => ({
    id: 'm-1', slot: 'lunch', title: 'Ebédtál', score: null, kcal: 0, p: 0, c: 0, f: 0,
    mealItems: lines, items: [], tags: [], loggedAt: '2026-09-24T12:00:00', mealDate: '2026-09-24',
    ...extra,
  })
  const recipe = {
    id: 'rec-9', name: 'Zabkása', servings: 2,
    ingredients: [
      { refId: 'ing-zab', amount: 80, unit: 'g', name: 'Zabpehely' },
      { refId: 'ing-tej', amount: 300, unit: 'ml' },
    ],
  } as unknown as Recipe
  const tej: PickableIngredient = { ...zab, id: 'ing-tej', name: 'Tej 1,5%', unit: 'ml' }

  it('carries name, category and a single serving', () => {
    const d = mealToDraft(meal([line({})]), [], pool)
    expect(d).toMatchObject({ name: 'Ebédtál', category: 'lunch', servings: 1, steps: [] })
  })

  it('falls back to the line-derived name, then to „Új recept", and to snack', () => {
    expect(mealToDraft(meal([], { title: '', slot: '??' }), [], pool)).toMatchObject({ name: 'Új recept', category: 'snack' })
  })

  it('a pantry line maps 1:1', () => {
    expect(mealToDraft(meal([line({})]), [], pool).lines).toEqual([
      { source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 50, unit: 'g' },
    ])
  })

  it('an estimate line stays an estimate, its totals as `est`', () => {
    const est = line({ source: 'estimate', refId: '', name: 'Lecsó', amount: 1, unit: 'adag', contribution: { kcal: 220, p: 6, c: 18, f: 14 } })
    expect(mealToDraft(meal([est]), [], pool).lines).toEqual([
      { source: 'estimate', refId: null, name: 'Lecsó', amount: 1, unit: 'adag', est: { kcal: 220, p: 6, c: 18, f: 14 } },
    ])
  })

  it('a recipe line expands into its ingredients, scaled to the logged servings', () => {
    const r = line({ source: 'recipe', refId: 'rec-9', name: 'Zabkása', amount: 1, unit: 'adag' })
    expect(mealToDraft(meal([r]), [recipe], [...pool, tej]).lines).toEqual([
      { source: 'pantry', refId: 'ing-zab', name: 'Zabpehely', amount: 40, unit: 'g' },
      { source: 'pantry', refId: 'ing-tej', name: 'Tej 1,5%', amount: 150, unit: 'ml' },
    ])
  })

  it('a recipe that is gone keeps the line as an estimate — nothing is lost', () => {
    const r = line({ source: 'recipe', refId: 'rec-gone', name: 'Régi recept', amount: 1.5, unit: 'adag' })
    expect(mealToDraft(meal([r]), [], pool).lines).toEqual([
      { source: 'estimate', refId: null, name: 'Régi recept', amount: 1.5, unit: 'adag', est: r.contribution },
    ])
  })

  it('the same pantry item in the same unit merges into one row, first position kept', () => {
    const r = line({ source: 'recipe', refId: 'rec-9', name: 'Zabkása', amount: 1, unit: 'adag' })
    const lines = mealToDraft(meal([line({ amount: 20 }), r]), [recipe], [...pool, tej]).lines
    expect(lines.map(l => [l.refId, l.amount])).toEqual([['ing-zab', 60], ['ing-tej', 150]])
  })
})
