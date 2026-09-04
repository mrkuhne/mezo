import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { usePantry, useRecipes } from '@/data/hooks'
import { QueryWrapper } from '@/test/queryWrapper'
import { ingredients } from '@/data/fuel/pantry'
import { lineContribution } from '@/data/fuel/recipeMacros'
import type { ContextDimension } from '@/data/types'

// usePantry became a dual-mode TanStack query (Task 7, mezo-9xu). Pin mock mode so
// it returns the static Phase-1 seed synchronously (initialData) and wrap the hook
// in QueryWrapper so useQuery has a client.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

// NOTE: prototype pantry-data.js:20–157 actually has 18 ingredients (not 17 as the
// task text stated). Counts reflect the real data per the task's "fix to true counts" rule.
test('usePantry returns 18 ingredients, 4 imports, 3 suggestions, sources', () => {
  const { result } = renderHook(() => usePantry(), { wrapper: QueryWrapper })
  expect(result.current.ingredients).toHaveLength(18)
  expect(result.current.imports).toHaveLength(4)
  expect(result.current.suggestions).toHaveLength(3)
  expect(result.current.sources['kifli.hu'].label).toBeTruthy()
})

test('useRecipes returns 6 recipes; logged + standalone recipes both carry a templateBreakdown', () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  expect(result.current.recipes).toHaveLength(6)
  expect(result.current.recipes.find(r => r.id === 'rec-1')!.templateBreakdown).toBeDefined()
  expect(result.current.recipes.find(r => r.id === 'rec-3')!.templateBreakdown).toBeDefined()
})

test('logged recipes (rec-1/2 — breakfast + lunch) carry recentLogs with non-empty loggedAt', () => {
  // Partial mock day (mezo-1oy5): only breakfast (rec-1) + lunch (rec-2) are logged; the 16:00 snack
  // (rec-4) is now a future/unlogged window, so rec-4 no longer carries a recentLog today.
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const linked = ['rec-1', 'rec-2']
  for (const id of linked) {
    const recipe = result.current.recipes.find(r => r.id === id)!
    expect(recipe.recentLogs).toBeDefined()
    expect(recipe.recentLogs!.length).toBeGreaterThan(0)
    for (const log of recipe.recentLogs!) {
      expect(log.loggedAt.trim().length).toBeGreaterThan(0)
    }
  }

  // Verify the enrichment math (not just structure): m1 (score 0.92) ↔ rec-1.
  // In v1, mezoFit scoring is deferred so the seed recipe's mezoFit.score is null;
  // the delta formula falls back to 0 → delta = +(0.92 - 0).toFixed(2) = 0.92.
  const rec1 = result.current.recipes.find(r => r.id === 'rec-1')!
  expect(rec1.recentLogs![0].score).toBe(0.92)
  expect(rec1.recentLogs![0].delta).toBe(0.92)
})

test('a tükrözött recept-sablon breakdownból hiányzik a timing (meal-only, mezo-jcpt.3 fix-round-1 F2)', () => {
  // rec-1 ↔ m1, rec-2 ↔ m2 mirror their linked meal's FULL breakdown (pantry.ts's `sourceMeal`
  // path) — including its `context` dimension, which since mezo-jcpt.3 carries `timing`. The new
  // MealTimingStrip is gated to a logged MEAL's context dimension only (DimensionCard.tsx); if
  // `stripMealOnlyTiming` (pantry.ts) regressed, the strip would silently leak back onto these
  // recipe pages — exactly the bug the Task 4 runtime check caught by hand. This pins it.
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  for (const id of ['rec-1', 'rec-2']) {
    const recipe = result.current.recipes.find(r => r.id === id)!
    const ctx = recipe.templateBreakdown!.dimensions.find(d => d.id === 'context') as ContextDimension
    expect(ctx).toBeDefined()
    expect(ctx.timing).toBeUndefined()
    // The pre-existing (out-of-scope) fact-chip mirroring is untouched by the fix — only `timing`
    // is stripped, so the dimension's `context` rows still carry the linked meal's real facts.
    expect(ctx.context.length).toBeGreaterThan(0)
  }
})

test('standalone recipes (rec-3/5/6) have empty recentLogs but a templateBreakdown', () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  for (const id of ['rec-3', 'rec-5', 'rec-6']) {
    const recipe = result.current.recipes.find(r => r.id === id)!
    expect(recipe.recentLogs).toEqual([])
    expect(recipe.templateBreakdown).toBeDefined()
  }
})

test('every mock recipe line carries a computed name + contribution; macros = Σ contributions', () => {
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  for (const recipe of result.current.recipes) {
    let sum = { kcal: 0, p: 0, c: 0, f: 0 }
    for (const line of recipe.ingredients) {
      const ing = ingredients.find(i => i.id === line.refId)
      expect(line.name).toBe(ing?.name)
      expect(line.contribution).toEqual(lineContribution(line.amount, ing!.per, ing!.macros))
      const c = line.contribution!
      sum = { kcal: sum.kcal + c.kcal, p: sum.p + c.p, c: sum.c + c.c, f: sum.f + c.f }
    }
    const r = (n: number) => Math.round(n) // whole number, matching computeRecipeMacros / backend setScale(0, HALF_UP)
    expect(recipe.macros).toEqual({ kcal: r(sum.kcal), p: r(sum.p), c: r(sum.c), f: r(sum.f) })
  }
})
