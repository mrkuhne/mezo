import { renderHook } from '@testing-library/react'
import { usePantry, useRecipes } from './hooks'

// NOTE: prototype pantry-data.js:20–157 actually has 18 ingredients (not 17 as the
// task text stated). Counts reflect the real data per the task's "fix to true counts" rule.
test('usePantry returns 18 ingredients, 4 imports, 3 suggestions, sources', () => {
  const { result } = renderHook(() => usePantry())
  expect(result.current.ingredients).toHaveLength(18)
  expect(result.current.imports).toHaveLength(4)
  expect(result.current.suggestions).toHaveLength(3)
  expect(result.current.sources['kifli.hu'].label).toBeTruthy()
})

test('useRecipes returns 6 recipes; logged + standalone recipes both carry a templateBreakdown', () => {
  const { result } = renderHook(() => useRecipes())
  expect(result.current.recipes).toHaveLength(6)
  expect(result.current.recipes.find(r => r.id === 'rec-1')!.templateBreakdown).toBeDefined()
  expect(result.current.recipes.find(r => r.id === 'rec-3')!.templateBreakdown).toBeDefined()
})

test('logged recipes (rec-1/2/4) carry recentLogs with non-empty loggedAt', () => {
  const { result } = renderHook(() => useRecipes())
  const linked = ['rec-1', 'rec-2', 'rec-4']
  for (const id of linked) {
    const recipe = result.current.recipes.find(r => r.id === id)!
    expect(recipe.recentLogs).toBeDefined()
    expect(recipe.recentLogs!.length).toBeGreaterThan(0)
    for (const log of recipe.recentLogs!) {
      expect(log.loggedAt.trim().length).toBeGreaterThan(0)
    }
  }

  // Verify the enrichment math (not just structure): m1 (score 0.92) ↔ rec-1
  // (mezoFit.score 0.92) → delta = +(0.92 - 0.92).toFixed(2) = 0.
  const rec1 = result.current.recipes.find(r => r.id === 'rec-1')!
  expect(rec1.recentLogs![0].score).toBe(0.92)
  expect(rec1.recentLogs![0].delta).toBe(0)
})

test('standalone recipes (rec-3/5/6) have empty recentLogs but a templateBreakdown', () => {
  const { result } = renderHook(() => useRecipes())
  for (const id of ['rec-3', 'rec-5', 'rec-6']) {
    const recipe = result.current.recipes.find(r => r.id === id)!
    expect(recipe.recentLogs).toEqual([])
    expect(recipe.templateBreakdown).toBeDefined()
  }
})
