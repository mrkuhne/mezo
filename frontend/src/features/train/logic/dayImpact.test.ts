import { describe, expect, it } from 'vitest'
import { dayImpact, regionRepresentativeToken } from '@/features/train/logic/dayImpact'

const ex = (muscle: string, workingSets: number) => ({ muscle, workingSets })

describe('dayImpact', () => {
  it('turns a Felsőtest-A-like day into three enyhe rows plus an honest Láb ma nem kap', () => {
    const rows = dayImpact([ex('chest', 3), ex('back', 3), ex('shoulder', 3)])
    expect(rows.map((r) => [r.label, r.word])).toEqual([
      ['Mell', 'enyhe'],
      ['Hát', 'enyhe'],
      ['Váll', 'enyhe'],
      ['Láb', 'ma nem kap'],
    ])
    expect(rows.map((r) => r.plannedSets)).toEqual([3, 3, 3, 0])
    // Kar/Core got nothing today and are not big families — silently omitted.
    expect(rows.some((r) => r.label === 'Kar' || r.label === 'Core')).toBe(false)
  })

  it('crosses the ladder thresholds on a leg day (quad 4 + ham 3 = Láb 7 → erős)', () => {
    const rows = dayImpact([ex('quad', 4), ex('ham', 3)])
    const leg = rows.find((r) => r.label === 'Láb')!
    expect(leg.plannedSets).toBe(7)
    expect(leg.word).toBe('erős')
    expect(leg.token).toBe('quad') // heaviest token in the region, ties → first seen
    // The other three big families are present and honest about getting nothing.
    expect(rows.filter((r) => r.plannedSets === 0).map((r) => r.word)).toEqual(['ma nem kap', 'ma nem kap', 'ma nem kap'])
  })

  it('returns the raw done total uncapped — the bar caps it, this module does not', () => {
    const rows = dayImpact([ex('chest', 3)], { chest: 5 })
    const chest = rows.find((r) => r.label === 'Mell')!
    expect(chest.plannedSets).toBe(3)
    expect(chest.doneSets).toBe(5) // overshoots plannedSets; still returned as-is
  })

  it('shows all four big families as ma nem kap on an empty day', () => {
    const rows = dayImpact([])
    expect(rows.map((r) => r.label)).toEqual(['Mell', 'Hát', 'Váll', 'Láb'])
    expect(rows.every((r) => r.word === 'ma nem kap' && r.plannedSets === 0 && r.doneSets === 0)).toBe(true)
    // Fix round 1 (finding 3): a zero-planned big-family row still carries a non-empty,
    // MuscleChip-drawable token — the region's own representative (first) token from
    // muscleColors' REGION_MUSCLES — instead of '' (which MuscleChip renders as nothing).
    expect(rows.every((r) => r.token.length > 0)).toBe(true)
    expect(rows.map((r) => r.token)).toEqual([
      regionRepresentativeToken('coral'),
      regionRepresentativeToken('sky'),
      regionRepresentativeToken('lav'),
      regionRepresentativeToken('sage'),
    ])
  })

  it('drops an unknown muscle token silently — no region, no row, no crash', () => {
    const rows = dayImpact([ex('jetpack-fuel', 5)])
    expect(rows.every((r) => r.plannedSets === 0)).toBe(true)
    expect(rows.map((r) => r.label)).toEqual(['Mell', 'Hát', 'Váll', 'Láb'])
    // Same zero-planned fallback applies here — the unknown token contributed no region,
    // so every row is the empty-day case and still carries a drawable token.
    expect(rows.every((r) => r.token.length > 0)).toBe(true)
  })
})
