import { describe, expect, it } from 'vitest'
import { dayGap, deriveComparison, gapLabel } from '@/features/train/logic/workoutComparison'
import type { SummaryStats } from '@/features/train/logic/summaryStats'

function stats(p: Partial<SummaryStats>): SummaryStats {
  return {
    doneSets: 0, plannedSets: 0, doneEx: 0, totalEx: 0,
    volumeT: 0, avgRir: null, regions: [], records: [], targetGroups: [], targetCount: 0,
    exercises: [], ...p,
  }
}

describe('gapLabel', () => {
  it('counts the distance between the two sessions, in weeks past six days', () => {
    expect(gapLabel('2026-08-26', '2026-08-12')).toBe('2 héttel korábban')
    expect(gapLabel('2026-08-26', '2026-08-19')).toBe('1 héttel korábban')
  })

  it('drops to days under a week — "0 héttel korábban" would be nonsense', () => {
    expect(gapLabel('2026-08-26', '2026-08-23')).toBe('3 nappal korábban')
    expect(dayGap('2026-08-26', '2026-08-23')).toBe(3)
  })
})

describe('deriveComparison', () => {
  const ref = stats({ volumeT: 7.454, targetCount: 12, avgRir: 2.7 })

  it('signs every delta honestly, including the ones that went down', () => {
    const c = deriveComparison(stats({ volumeT: 6.539, targetCount: 14, avgRir: 1.6 }), ref, '2026-08-26', 'aug. 12.', '2026-08-12')
    expect(c.cells.map((x) => x.value)).toEqual(['−0,9 t', '+2', '−1,1'])
    expect(c.cells.map((x) => x.was)).toEqual(['7,5 t volt', '12 volt', '2,7 volt'])
  })

  it('never punishes: a drop is neutral, only a rise is toned (ADR 0010)', () => {
    const down = deriveComparison(stats({ volumeT: 6.5, targetCount: 9, avgRir: 2 }), ref, '2026-08-26', 'aug. 12.', '2026-08-12')
    expect(down.cells.map((x) => x.tone)).toEqual(['neutral', 'neutral', 'neutral'])

    const up = deriveComparison(stats({ volumeT: 8.5, targetCount: 15, avgRir: 2 }), ref, '2026-08-26', 'aug. 12.', '2026-08-12')
    expect(up.cells.map((x) => x.tone)).toEqual(['up', 'up', 'neutral'])
  })

  it('keeps Ø RIR neutral even when it rises — there, less is harder', () => {
    const c = deriveComparison(stats({ volumeT: 7.454, targetCount: 12, avgRir: 3.4 }), ref, '2026-08-26', 'aug. 12.', '2026-08-12')
    const rir = c.cells.find((x) => x.key === 'rir')!
    expect(rir.value).toBe('+0,7')
    expect(rir.tone).toBe('neutral')
  })

  it('keeps a fixed decimal so a whole-number delta cannot read as a typo', () => {
    const c = deriveComparison(stats({ volumeT: 7.454, targetCount: 12, avgRir: 1.7 }), ref, '2026-08-26', 'aug. 12.', '2026-08-12')
    expect(c.cells.find((x) => x.key === 'rir')!.value).toBe('−1,0')
  })

  it('says nothing about Ø RIR when either side has no rated set', () => {
    const c = deriveComparison(stats({ avgRir: null }), stats({ avgRir: null }), '2026-08-26', 'aug. 12.', '2026-08-12')
    const rir = c.cells.find((x) => x.key === 'rir')!
    expect(rir.value).toBe('–')
    expect(rir.was).toBe('')
  })

  it('marks an unchanged value with ±, not a bare zero', () => {
    const c = deriveComparison(stats({ volumeT: 7.454, targetCount: 12, avgRir: 2.7 }), ref, '2026-08-26', 'aug. 12.', '2026-08-12')
    expect(c.cells.map((x) => x.value)).toEqual(['±0,0 t', '±0', '±0,0'])
  })
})
