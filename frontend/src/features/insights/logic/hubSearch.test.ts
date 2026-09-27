import { describe, expect, it } from 'vitest'
import { byNameHu, fold, highlight, matches } from '@/features/insights/logic/hubSearch'

describe('hubSearch', () => {
  it('is accent- and case-insensitive', () => {
    expect(matches('Laktózérzékeny vagy', 'LAKTOZ')).toBe(true)
    expect(matches('Kávé 14 előtt', 'kave')).toBe(true)
    expect(matches('Kávé', '')).toBe(true)
    expect(matches('Kávé', 'tea')).toBe(false)
  })

  it('fold keeps the character count, so highlight indices line up', () => {
    const s = 'Őszi ülés'
    expect(Array.from(fold(s))).toHaveLength(Array.from(s).length)
  })

  it('highlight returns the ORIGINAL characters with hit flags', () => {
    expect(highlight('A kávé után', 'kave')).toEqual([
      { text: 'A ', hit: false }, { text: 'kávé', hit: true }, { text: ' után', hit: false },
    ])
    expect(highlight('semmi', '')).toEqual([{ text: 'semmi', hit: false }])
  })

  it('byNameHu sorts Hungarian names alphabetically', () => {
    expect(['Zoli', 'Ádám', 'Anya', 'Éva'].sort(byNameHu)).toEqual(['Ádám', 'Anya', 'Éva', 'Zoli'])
  })
})
