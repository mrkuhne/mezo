import { describe, it, expect } from 'vitest'
import {
  lineMacros, draftTotals, scaleServings, diffLineKeys, draftToInput, goalRole,
} from '@/data/fuel/workshopState'
import type { WorkshopDraft, WorkshopLine } from '@/data/types'
import type { PickableIngredient } from '@/data/fuel/pantryPickables'

const zab: PickableIngredient = {
  id: 'ing-zab', name: 'Zabpehely', brand: '', source: 'kifli.hu', category: 'carb',
  per: 100, unit: 'g', macros: { kcal: 372, p: 13.5, c: 60, f: 7 },
  price: 0, priceUnit: '', pkg: '', micros: [], nova: 1, stock: null,
  lastUsed: '—', usedInRecipes: 0, kind: 'food',
}
const pool: PickableIngredient[] = [zab]

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
