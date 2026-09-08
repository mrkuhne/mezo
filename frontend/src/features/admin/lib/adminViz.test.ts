import { describe, it, expect } from 'vitest'
import type { AdminCostMatrixResponse } from '@/data/admin/adminInsightsApi'
import { costMatrixTotals, topNFromEntries, deltaVsTrailingAvg } from '@/features/admin/lib/adminViz'

// mezo-m079 Task 2 — cost-matrix aggregation + top-N shaping + the trailing-average delta,
// all pure functions, tested against hand-computed fixtures.

const MATRIX: AdminCostMatrixResponse = {
  period: '7d',
  users: [
    { id: 'u1', label: 'Anna' },
    { id: 'u2', label: 'Béla' },
    { id: null, label: 'Háttér' },
  ],
  features: ['companion_chat', 'meal_coach'],
  cells: [
    { userId: 'u1', feature: 'companion_chat', calls: 10, costUsd: 6, unknownCalls: 0 },
    { userId: 'u1', feature: 'meal_coach', calls: 2, costUsd: 1, unknownCalls: 0 },
    { userId: 'u2', feature: 'companion_chat', calls: 1, costUsd: 0.5, unknownCalls: 0 },
    { userId: null, feature: 'companion_chat', calls: 3, costUsd: 0, unknownCalls: 3 },
  ],
  totalUsd: 7.5,
}

describe('costMatrixTotals', () => {
  it('sums per-user totals, incl. the null-created_by Háttér bucket', () => {
    const totals = costMatrixTotals(MATRIX, 'user')
    expect(totals).toEqual([
      { key: 'u1', label: 'Anna', sub: undefined, value: 7 },
      { key: 'u2', label: 'Béla', sub: undefined, value: 0.5 },
      { key: '__background__', label: 'Háttér', sub: 'rendszer', value: 0 },
    ])
  })

  it('sums per-feature totals through the label dictionary', () => {
    const totals = costMatrixTotals(MATRIX, 'feature')
    expect(totals).toEqual([
      { key: 'companion_chat', label: 'Beszélgetés a társsal', value: 6.5 },
      { key: 'meal_coach', label: 'Étkezési tanácsadó', value: 1 },
    ])
  })
})

describe('topNFromEntries', () => {
  const entries = [
    { key: 'a', label: 'A', value: 10 },
    { key: 'b', label: 'B', value: 30 },
    { key: 'c', label: 'C', value: 20 },
  ]

  it('sorts descending, computes share relative to the leader, formats the value, and truncates to n', () => {
    const rows = topNFromEntries(entries, 2, (v) => `$${v.toFixed(2)}`)
    expect(rows).toEqual([
      { key: 'b', label: 'B', sub: undefined, value: '$30.00', share: 1 },
      { key: 'c', label: 'C', sub: undefined, value: '$20.00', share: 20 / 30 },
    ])
  })

  it('carries an entry sub through to the row', () => {
    const rows = topNFromEntries([{ key: 'x', label: 'X', value: 5, sub: 'rendszer' }], 1, String)
    expect(rows[0].sub).toBe('rendszer')
  })

  it('never divides by zero when every entry is 0', () => {
    const rows = topNFromEntries([{ key: 'z', label: 'Z', value: 0 }], 1, String)
    expect(rows[0].share).toBe(0)
  })
})

describe('deltaVsTrailingAvg', () => {
  it('reports up when yesterday beats the trailing average', () => {
    // avg of [1,1,1,1,1,1,1] = 1, yesterday = 2 → +100%
    const r = deltaVsTrailingAvg([1, 1, 1, 1, 1, 1, 1, 2], 7)
    expect(r).toEqual({ pct: 100, direction: 'up', fromZero: false })
  })

  it('reports down when yesterday is below the trailing average', () => {
    const r = deltaVsTrailingAvg([2, 2, 2, 2, 2, 2, 2, 1], 7)
    expect(r).toEqual({ pct: -50, direction: 'down', fromZero: false })
  })

  it('reports flat when yesterday equals the trailing average', () => {
    const r = deltaVsTrailingAvg([3, 3, 3, 3, 3, 3, 3, 3], 7)
    expect(r).toEqual({ pct: 0, direction: 'flat', fromZero: false })
  })

  it('treats a zero trailing average honestly (fromZero), up when yesterday is > 0', () => {
    const r = deltaVsTrailingAvg([0, 0, 0, 0, 0, 0, 0, 5], 7)
    expect(r).toEqual({ pct: 0, direction: 'up', fromZero: true })
  })

  it('treats a zero trailing average as flat when yesterday is also 0', () => {
    const r = deltaVsTrailingAvg([0, 0, 0, 0, 0, 0, 0, 0], 7)
    expect(r).toEqual({ pct: 0, direction: 'flat', fromZero: true })
  })

  it('pads missing days with 0 rather than averaging over fewer days', () => {
    // only 2 prior days of history exist; days=7 → avg = (10+10)/7, not /2
    const r = deltaVsTrailingAvg([10, 10, 20], 7)
    const expectedAvg = 20 / 7
    const expectedPct = ((20 - expectedAvg) / expectedAvg) * 100
    expect(r.pct).toBeCloseTo(expectedPct)
    expect(r.direction).toBe('up')
    expect(r.fromZero).toBe(false)
  })
})
