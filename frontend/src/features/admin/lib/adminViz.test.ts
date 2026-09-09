import { describe, it, expect } from 'vitest'
import type { AdminCostMatrixResponse, AdminUserInsightResponse } from '@/data/admin/adminInsightsApi'
import {
  costDeltaCopy,
  costMatrixTotals,
  domainTotals,
  featureLegend,
  firstLastActivity,
  monthRunRate,
  quietTesters,
  spikeDays,
  testerStatus,
  topNFromEntries,
  deltaVsTrailingAvg,
  valueScore,
} from '@/features/admin/lib/adminViz'

// mezo-m079 Task 2 — cost-matrix aggregation + top-N shaping + the trailing-average delta,
// all pure functions, tested against hand-computed fixtures.

describe('valueScore', () => {
  it('is neutral (×1) when there is no feedback source at all', () => {
    // 10 × (1 + 0.4) × 1 = 14
    expect(valueScore({ uniqueUsers: 10, habitUserShare: 0.4, helped: null })).toBeCloseTo(14)
  })

  it('scales up by the helped ratio — up=14,down=3 → ×(0.5 + 14/17)', () => {
    const factor = 0.5 + 14 / 17
    // 8 × (1 + 0.5) × factor
    expect(valueScore({ uniqueUsers: 8, habitUserShare: 0.5, helped: { up: 14, down: 3 } }))
      .toBeCloseTo(8 * 1.5 * factor)
  })

  it('scales down toward ×0.5 when feedback is all-negative', () => {
    // 6 × (1 + 0.2) × 0.5 = 3.6
    expect(valueScore({ uniqueUsers: 6, habitUserShare: 0.2, helped: { up: 0, down: 5 } })).toBeCloseTo(3.6)
  })

  it('folds the habit-user-share factor in — a higher habit share raises the score at equal reach', () => {
    const low = valueScore({ uniqueUsers: 10, habitUserShare: 0.1, helped: null })
    const high = valueScore({ uniqueUsers: 10, habitUserShare: 0.8, helped: null })
    expect(high).toBeGreaterThan(low)
    expect(low).toBeCloseTo(11)
    expect(high).toBeCloseTo(18)
  })

  it('treats an empty-but-present helped object (0 up, 0 down) as neutral, not NaN', () => {
    expect(valueScore({ uniqueUsers: 4, habitUserShare: 0, helped: { up: 0, down: 0 } })).toBeCloseTo(4)
  })
})

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

describe('domainTotals', () => {
  it('sums each domain series own days, labelled through the dictionary', () => {
    const totals = domainTotals([
      { key: 'train', days: [{ count: 2 }, { count: 3 }] },
      { key: 'food', days: [{ count: 1 }, { count: 1 }] },
    ])
    expect(totals).toEqual([
      { key: 'train', label: 'Edzés', missing: undefined, value: 5 },
      { key: 'food', label: 'Étkezés', missing: undefined, value: 2 },
    ])
  })

  it('flags an unrecognized domain key as missing while still returning the raw key as the label', () => {
    const totals = domainTotals([{ key: 'nonexistent_domain', days: [{ count: 4 }] }])
    expect(totals).toEqual([{ key: 'nonexistent_domain', label: 'nonexistent_domain', missing: true, value: 4 }])
  })
})

describe('featureLegend', () => {
  it('keeps the top n features and folds the remainder into an Egyéb bucket off matrix.totalUsd', () => {
    const matrix: AdminCostMatrixResponse = {
      period: '30d',
      users: [],
      features: ['companion_chat', 'meal_coach', 'meal_draft', 'train_meso_plan'],
      cells: [
        { userId: 'u1', feature: 'companion_chat', calls: 1, costUsd: 10, unknownCalls: 0 },
        { userId: 'u1', feature: 'meal_coach', calls: 1, costUsd: 5, unknownCalls: 0 },
        { userId: 'u1', feature: 'meal_draft', calls: 1, costUsd: 2, unknownCalls: 0 },
        { userId: 'u1', feature: 'train_meso_plan', calls: 1, costUsd: 1, unknownCalls: 0 },
      ],
      totalUsd: 20, // deliberately > the cells' own sum (18) — Egyéb must read off this field
    }
    const legend = featureLegend(matrix, 2)
    expect(legend).toEqual([
      { key: 'companion_chat', label: 'Beszélgetés a társsal', missing: undefined, value: 10 },
      { key: 'meal_coach', label: 'Étkezési tanácsadó', missing: undefined, value: 5 },
      { key: '__other__', label: 'Egyéb', value: 5 },
    ])
  })

  it('omits the Egyéb bucket when nothing is left over', () => {
    const matrix: AdminCostMatrixResponse = {
      period: '30d',
      users: [],
      features: ['companion_chat'],
      cells: [{ userId: 'u1', feature: 'companion_chat', calls: 1, costUsd: 3, unknownCalls: 0 }],
      totalUsd: 3,
    }
    expect(featureLegend(matrix, 3)).toEqual([
      { key: 'companion_chat', label: 'Beszélgetés a társsal', missing: undefined, value: 3 },
    ])
  })
})

describe('quietTesters', () => {
  const NOW = new Date('2026-09-08T12:00:00Z')
  const users: Pick<AdminUserInsightResponse, 'id' | 'name' | 'role' | 'lastActivityAt'>[] = [
    { id: 'owner', name: 'Owner', role: 'OWNER', lastActivityAt: null },
    { id: 'fresh', name: 'Fresh', role: 'USER', lastActivityAt: '2026-09-08T10:00:00Z' }, // today, <3 days
    { id: 'quiet4', name: 'Quiet4', role: 'USER', lastActivityAt: '2026-09-04T12:00:00Z' }, // 4 days
    { id: 'quiet10', name: 'Quiet10', role: 'USER', lastActivityAt: '2026-08-29T12:00:00Z' }, // 10 days
    { id: 'never', name: 'Never', role: 'USER', lastActivityAt: null },
  ]

  it('excludes the owner and anyone quiet less than the threshold, sorts quietest first', () => {
    const rows = quietTesters(users, NOW)
    expect(rows.map((r) => r.key)).toEqual(['never', 'quiet10', 'quiet4'])
  })

  it('renders an honest "még nem aktív" row instead of inventing a day count for a never-active user, no share bar', () => {
    const rows = quietTesters(users, NOW)
    const never = rows.find((r) => r.key === 'never')
    expect(never?.value).toBe('még nem aktív')
    expect(never?.tone).toBe('mut')
    expect(never?.share).toBeUndefined()
  })

  it('formats a quiet day count as "X napja", warn-toned with no share bar, links to the user detail page', () => {
    const rows = quietTesters(users, NOW)
    const quiet4 = rows.find((r) => r.key === 'quiet4')
    expect(quiet4?.value).toBe('4 napja')
    expect(quiet4?.tone).toBe('warn')
    expect(quiet4?.share).toBeUndefined()
    expect(quiet4?.to).toBe('/admin/users/quiet4')
  })

  it('returns an empty list when nobody has been quiet long enough', () => {
    const rows = quietTesters([{ id: 'a', name: 'A', role: 'USER', lastActivityAt: NOW.toISOString() }], NOW)
    expect(rows).toEqual([])
  })

  // Final review F5: uncapped otherwise — the tile's own "Minden tesztelő aktivitása →" link
  // already covers the rest, same reasoning as the two cost top-lists' own `topNFromEntries(…, 5, …)`.
  it('caps the list at maxRows (default 5), keeping the quietest ones', () => {
    const many: Pick<AdminUserInsightResponse, 'id' | 'name' | 'role' | 'lastActivityAt'>[] = Array.from(
      { length: 8 },
      (_, i) => ({
        id: `u${i}`,
        name: `U${i}`,
        role: 'USER' as const,
        // quiet for 3..10 days, i=0 quietest (10 days) .. i=7 least quiet (3 days)
        lastActivityAt: new Date(NOW.getTime() - (10 - i) * 86_400_000).toISOString(),
      }),
    )
    const rows = quietTesters(many, NOW)
    expect(rows).toHaveLength(5)
    expect(rows.map((r) => r.key)).toEqual(['u0', 'u1', 'u2', 'u3', 'u4'])
  })

  it('honors an explicit maxRows override', () => {
    const rows = quietTesters(users, NOW, 3, 1)
    expect(rows).toHaveLength(1)
    expect(rows[0].key).toBe('never')
  })
})

describe('testerStatus', () => {
  const NOW = new Date('2026-09-08T12:00:00Z')

  it('reads meg_nem_aktiv for a never-active user (null lastActivityAt), no invented day count', () => {
    expect(testerStatus(null, NOW)).toBe('meg_nem_aktiv')
  })

  it('reads aktiv at 0/1/2 days (the boundary)', () => {
    expect(testerStatus(NOW.toISOString(), NOW)).toBe('aktiv')
    expect(testerStatus(new Date(NOW.getTime() - 1 * 86_400_000).toISOString(), NOW)).toBe('aktiv')
    expect(testerStatus(new Date(NOW.getTime() - 2 * 86_400_000).toISOString(), NOW)).toBe('aktiv')
  })

  it('reads csendesedik at the 3-day boundary and still at 6 days', () => {
    expect(testerStatus(new Date(NOW.getTime() - 3 * 86_400_000).toISOString(), NOW)).toBe('csendesedik')
    expect(testerStatus(new Date(NOW.getTime() - 6 * 86_400_000).toISOString(), NOW)).toBe('csendesedik')
  })

  it('reads lemorzsolodott at the 7-day boundary and beyond', () => {
    expect(testerStatus(new Date(NOW.getTime() - 7 * 86_400_000).toISOString(), NOW)).toBe('lemorzsolodott')
    expect(testerStatus(new Date(NOW.getTime() - 30 * 86_400_000).toISOString(), NOW)).toBe('lemorzsolodott')
  })
})

describe('costDeltaCopy', () => {
  it('reads "új költés" when there is no trailing average to compare against', () => {
    expect(costDeltaCopy({ pct: 0, direction: 'up', fromZero: true })).toBe('új költés')
    expect(costDeltaCopy({ pct: 0, direction: 'flat', fromZero: true })).toBe('új költés')
  })

  it('spells out an "up" delta with the ▲ glyph and "több" wording', () => {
    expect(costDeltaCopy({ pct: 86.4, direction: 'up', fromZero: false })).toBe('▲ 86%-kal több a heti átlagnál')
  })

  it('spells out a "down" delta with the ▼ glyph and "kevesebb" wording, using the absolute value', () => {
    expect(costDeltaCopy({ pct: -46.2, direction: 'down', fromZero: false })).toBe('▼ 46%-kal kevesebb a heti átlagnál')
  })

  it('reads a neutral copy for a flat (non-zero-base) delta', () => {
    expect(costDeltaCopy({ pct: 0.1, direction: 'flat', fromZero: false })).toBe('– megegyezik a heti átlaggal')
  })
})

// mezo-zde2 Task 3 — the Emberek detail's Aktivitás tab "first seen / last seen" line.
describe('firstLastActivity', () => {
  it('finds the earliest and latest active day across every domain, summed by index', () => {
    // domain A active only at index 1, domain B active only at index 3 — the sum is active at
    // both, so first active index is 1 (daysAgo 5-1-1=3) and last is 3 (daysAgo 5-1-3=1).
    const series = [
      { days: [{ count: 0 }, { count: 1 }, { count: 0 }, { count: 0 }, { count: 0 }] },
      { days: [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 2 }, { count: 0 }] },
    ]
    expect(firstLastActivity(series)).toEqual({ firstDaysAgo: 3, lastDaysAgo: 1 })
  })

  it('reports both as null when no domain was ever active', () => {
    const series = [{ days: [{ count: 0 }, { count: 0 }] }, { days: [{ count: 0 }, { count: 0 }] }]
    expect(firstLastActivity(series)).toEqual({ firstDaysAgo: null, lastDaysAgo: null })
  })

  it('reports both as null for an empty series list', () => {
    expect(firstLastActivity([])).toEqual({ firstDaysAgo: null, lastDaysAgo: null })
  })

  it('collapses to a single day when the only active day is the last one (today)', () => {
    const series = [{ days: [{ count: 0 }, { count: 0 }, { count: 5 }] }]
    expect(firstLastActivity(series)).toEqual({ firstDaysAgo: 0, lastDaysAgo: 0 })
  })
})

// mezo-pfdv Task 2 — the Költés trend tile's anomaly dots + month-end run-rate, both pure
// functions mirroring backend rules the client cannot re-fetch per-day (spikeDays mirrors
// AdminAlertService.costSpike's exact semantics, hand-computed here against the same formula).
describe('spikeDays', () => {
  it('fires on a day that clears the floor and beats 2x the prior-7 average (missing days = 0)', () => {
    // day 8 (index 7): usd=2, prior 7 days (idx 0..6) are all 0 -> priorAvg=0 -> fires (avg-zero branch)
    const series = [
      { day: '2026-09-01', usd: 0 },
      { day: '2026-09-02', usd: 0 },
      { day: '2026-09-03', usd: 0 },
      { day: '2026-09-04', usd: 0 },
      { day: '2026-09-05', usd: 0 },
      { day: '2026-09-06', usd: 0 },
      { day: '2026-09-07', usd: 0 },
      { day: '2026-09-08', usd: 2 },
    ]
    expect(spikeDays(series)).toEqual(['2026-09-08'])
  })

  it('does not fire below the absolute usd floor even with a zero prior average', () => {
    const series = [
      { day: '2026-09-01', usd: 0 },
      { day: '2026-09-02', usd: 0.1 }, // below the default minUsd=0.5
    ]
    expect(spikeDays(series)).toEqual([])
  })

  it('fires only when strictly greater than factor x prior avg, not merely equal', () => {
    // Prior 7 days average to 0.49 each — below the 0.5 floor, so none of them fire on their
    // own. Target exactly 2x that avg (0.98) does NOT fire (needs to be strictly greater); a
    // hair over (0.99) fires.
    const priorSeven = Array.from({ length: 7 }, (_, i) => ({ day: `p${i}`, usd: 0.49 }))
    const exact = [...priorSeven, { day: 'target', usd: 0.98 }]
    const over = [...priorSeven, { day: 'target', usd: 0.99 }]
    expect(spikeDays(exact)).toEqual([])
    expect(spikeDays(over)).toEqual(['target'])
  })

  it('treats missing history (fewer than 7 prior entries) as zeros in the average, not a shorter window', () => {
    // Only 2 prior days seeded (both 0.6). d1/d2 themselves fire too — each has NO prior history
    // of its own (the zero-prior-avg branch), same as the very first test above; that is not
    // what this test is about. What distinguishes "missing = 0" from "average over the entries
    // that exist" is d3: priorSum=1.2 over the FIXED 7-slot window -> avg ≈ 0.171, so
    // 1.0 > 2×0.171 fires — whereas a shrunk 2-day window would average 0.6, and 1.0 would NOT
    // exceed 2×0.6=1.2.
    const series = [
      { day: 'd1', usd: 0.6 },
      { day: 'd2', usd: 0.6 },
      { day: 'd3', usd: 1.0 },
    ]
    expect(spikeDays(series)).toEqual(['d1', 'd2', 'd3'])
  })

  it('respects custom factor/minUsd overrides', () => {
    // Seven real prior days at 0.49 (below the 0.5 floor, so none of them fire on their own) ->
    // priorAvg=0.49 for the target. factor=2 threshold is 0.98 (2.5... wait, target below);
    // factor=3 threshold is 1.47 — target 1.2 clears the first, not the second.
    const priorSeven = Array.from({ length: 7 }, (_, i) => ({ day: `p${i}`, usd: 0.49 }))
    const series = [...priorSeven, { day: 'target', usd: 1.2 }]
    expect(spikeDays(series, 2, 0.5)).toEqual(['target'])
    expect(spikeDays(series, 3, 0.5)).toEqual([])
  })

  it('can flag more than one day in a series', () => {
    const zeros = Array.from({ length: 7 }, (_, i) => ({ day: `z${i}`, usd: 0 }))
    const series = [...zeros, { day: 'spike1', usd: 3 }, ...Array.from({ length: 6 }, (_, i) => ({ day: `q${i}`, usd: 0 })), { day: 'spike2', usd: 4 }]
    expect(spikeDays(series)).toEqual(['spike1', 'spike2'])
  })

  it('returns an empty list for an empty series', () => {
    expect(spikeDays([])).toEqual([])
  })
})

describe('monthRunRate', () => {
  it('projects the month-end total from the running cost and elapsed days', () => {
    // $18 spent through day 12 of a 30-day month -> $18/12*30 = $45
    expect(monthRunRate(18, 12, 30)).toBeCloseTo(45)
  })

  it('returns the month-so-far figure unchanged on the very last day', () => {
    expect(monthRunRate(45, 30, 30)).toBeCloseTo(45)
  })

  it('does not divide by zero on an invalid dayOfMonth (guards to 0)', () => {
    expect(monthRunRate(10, 0, 30)).toBe(0)
  })
})
