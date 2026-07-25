import { describe, expect, it } from 'vitest'
import {
  TOP_FILTERS, TOP_FILTER_LABELS, subMuscles, matchesMuscleFilter, isRegionFilter,
} from '@/features/train/logic/muscleFilters'

describe('two-level muscle filter (mezo-wu1s)', () => {
  it('top filters are all + plyo + the six regions, with labels', () => {
    expect(TOP_FILTERS).toEqual(['all', 'plyo', 'coral', 'sky', 'lav', 'rose', 'sage', 'amber'])
    expect(TOP_FILTER_LABELS.all).toBe('Összes')
    expect(TOP_FILTER_LABELS.plyo).toBe('Plyo')
    expect(TOP_FILTER_LABELS.sage).toBe('Láb')
  })

  it('isRegionFilter recognises region keys only', () => {
    expect(isRegionFilter('sage')).toBe(true)
    expect(isRegionFilter('all')).toBe(false)
    expect(isRegionFilter('plyo')).toBe(false)
  })

  it('subMuscles lists a multi-muscle region and hides single-muscle/non-region tops', () => {
    expect(subMuscles('sage')).toEqual(['quad', 'ham', 'glute', 'calf'])
    expect(subMuscles('amber')).toEqual([]) // core is the only amber muscle
    expect(subMuscles('all')).toEqual([])
    expect(subMuscles('plyo')).toEqual([])
  })

  it('matches all / plyo regardless of muscle', () => {
    expect(matchesMuscleFilter('quad', 'compound', 'all', null)).toBe(true)
    expect(matchesMuscleFilter('quad', 'plyo', 'plyo', null)).toBe(true)
    expect(matchesMuscleFilter('quad', 'compound', 'plyo', null)).toBe(false)
  })

  it('a region top (no sub) matches every muscle in that region', () => {
    expect(matchesMuscleFilter('calf', 'isolation', 'sage', null)).toBe(true)
    expect(matchesMuscleFilter('quad', 'compound', 'sage', null)).toBe(true)
    expect(matchesMuscleFilter('chest-mid', 'compound', 'sage', null)).toBe(false)
  })

  it('a sub selection narrows to a single muscle within the region', () => {
    expect(matchesMuscleFilter('calf', 'isolation', 'sage', 'calf')).toBe(true)
    expect(matchesMuscleFilter('quad', 'compound', 'sage', 'calf')).toBe(false)
  })
})
