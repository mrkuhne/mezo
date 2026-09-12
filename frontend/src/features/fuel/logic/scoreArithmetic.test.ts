// ============================================================
// Mezo · scoreArithmetic tests (mezo-33k6) — a score-envelope aritmetikája, ami két
// felületen (MealScoreSheet + FuelMealScorePage) ugyanazt KELL, hogy mondja.
// ============================================================
import { expect, test } from 'vitest'
import type { MealBreakdown, MealDimension } from '@/data/types'
import {
  breakdownTotalPct, dimAvailablePts, dimContributionPts, dimWeightPct,
} from '@/features/fuel/logic/scoreArithmetic'

const dim = (over: Partial<MealDimension> = {}): MealDimension => ({
  id: 'macro', label: 'Makró', weight: 0.22, score: 0.9, color: 'var(--coral)', detail: '',
  ...over,
} as MealDimension)

const breakdown = (dimensions: MealDimension[]): MealBreakdown => ({
  confidence: 0.8, summary: null, tagline: null, dimensions, improve: [], tools: [],
})

test('a súly százaléka és a pontok az envelope saját mezőiből jönnek', () => {
  const d = dim({ weight: 0.22, score: 0.9 })
  expect(dimWeightPct(d)).toBe(22)
  expect(dimContributionPts(d)).toBeCloseTo(19.8, 6)
  expect(dimAvailablePts(d)).toBeCloseTo(22, 6)
})

test('a súlyozott összeg csak az ÉLŐ dimenziókat számolja', () => {
  const b = breakdown([
    dim({ id: 'macro', weight: 0.5, score: 0.8 }),
    dim({ id: 'micro', weight: 0, score: 0 }),
    dim({ id: 'nova', weight: 0.5, score: 0.6 }),
  ])
  expect(breakdownTotalPct(b)).toBe(70)
})

test('a mentett pontszám elsőbbséget kap az újraszámolt közelítés előtt', () => {
  const b = breakdown([dim({ weight: 1, score: 0.5 })])
  expect(breakdownTotalPct(b, 82)).toBe(82)
})
