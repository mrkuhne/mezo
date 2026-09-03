import { describe, expect, it } from 'vitest'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'

const ex = (over: { type?: 'compound' | 'isolation' | 'plyo'; workingSets?: number; warmupSets?: number; repMin?: number; repMax?: number } = {}) => ({
  type: over.type ?? 'compound' as const,
  workingSets: over.workingSets ?? 3,
  warmupSets: over.warmupSets ?? 2,
  repMin: over.repMin ?? 8,
  repMax: over.repMax ?? 10,
})

describe('estimateSessionMinutes', () => {
  it('returns 0 for an empty session', () => {
    expect(estimateSessionMinutes([])).toBe(0)
  })
  it('single compound: 3×(8-10) + 2 warmups → 18 min', () => {
    // exec 3×9×3.5 = 94.5 s · rests 2×150 = 300 s · warmups 2×(20+45) = 130 s ·
    // transition 90 s → 614.5 s = 10.24 → 10 min + 8 min block = 18
    expect(estimateSessionMinutes([ex()])).toBe(18)
  })
  it('plyo prices reps at 2 s and rests at 90 s', () => {
    // 3×5×2 = 30 s · rests 2×90 = 180 s · no warmups · transition 90 s → 300 s = 5 + 8 = 13
    expect(estimateSessionMinutes([ex({ type: 'plyo', workingSets: 3, warmupSets: 0, repMin: 5, repMax: 5 })])).toBe(13)
  })
  it('isolation: 2×(12-15) + 1 warmup → 14 min', () => {
    // exec 2×13.5×3.5 = 94.5 s · rest 1×90 = 90 s · warmup 65 s · transition 90 s → 339.5 s = 5.66 → 6 + 8 = 14
    expect(estimateSessionMinutes([ex({ type: 'isolation', workingSets: 2, warmupSets: 1, repMin: 12, repMax: 15 })])).toBe(14)
  })
  it('rounds once on the session total, not per exercise', () => {
    // compound 614.5 s + isolation 339.5 s = 954 s = 15.9 → 16 + 8 = 24
    // (per-exercise rounding would give 10 + 6 + 8 = 24 here too — so also assert
    // the raw-sum case where they differ: two isolations 339.5×2 = 679 s = 11.32 → 11 + 8 = 19,
    // while per-exercise rounding would yield 6+6+8 = 20.)
    expect(estimateSessionMinutes([ex(), ex({ type: 'isolation', workingSets: 2, warmupSets: 1, repMin: 12, repMax: 15 })])).toBe(24)
    const iso = ex({ type: 'isolation', workingSets: 2, warmupSets: 1, repMin: 12, repMax: 15 })
    expect(estimateSessionMinutes([iso, iso])).toBe(19)
  })
  it('a single-set exercise has no inter-set rest', () => {
    // exec 1×9×3.5 = 31.5 s · rests 0 · no warmup · transition 90 s → 121.5 s = 2.03 → 2 + 8 = 10
    expect(estimateSessionMinutes([ex({ workingSets: 1, warmupSets: 0 })])).toBe(10)
  })
})

describe('estimateSessionMinutes with a timing profile', () => {
  const ex = (type: 'compound' | 'isolation', workingSets: number) =>
    ({ type, workingSets, warmupSets: 0, repMin: 8, repMax: 12 }) as const

  const profile = {
    leadInSeconds: 480,
    setCycleCompoundSeconds: 180,
    setCycleIsolationSeconds: 120,
    transitionSeconds: 240,
  }

  it('is unchanged when no profile is passed', () => {
    // The static path is the contract for structureLint and peakWeekFit — it must not move.
    expect(estimateSessionMinutes([ex('compound', 3)]))
      .toBe(estimateSessionMinutes([ex('compound', 3)], undefined))
  })

  it('sums lead-in, per-exercise set cycles and transitions', () => {
    // 480 + (3-1)*180 + (2-1)*120 + 1*240 = 1200s = 20 perc
    expect(estimateSessionMinutes([ex('compound', 3), ex('isolation', 2)], profile)).toBe(20)
  })

  it('counts warm-up sets as ordinary set cycles', () => {
    // 480 + (2+2-1)*180 = 1020s = 17 perc
    expect(estimateSessionMinutes(
      [{ type: 'compound', workingSets: 2, warmupSets: 2, repMin: 8, repMax: 12 }], profile)).toBe(17)
  })

  it('returns 0 for an empty list, profile or not', () => {
    expect(estimateSessionMinutes([], profile)).toBe(0)
  })
})
