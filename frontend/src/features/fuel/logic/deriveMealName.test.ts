import { describe, it, expect } from 'vitest'
import { deriveMealName, MAX_DERIVED_NAME_LEN } from '@/features/fuel/logic/deriveMealName'

describe('deriveMealName', () => {
  it('returns empty string for no names', () => {
    expect(deriveMealName([])).toBe('')
  })

  it('returns a single name unchanged', () => {
    expect(deriveMealName(['Zabpehely'])).toBe('Zabpehely')
  })

  it('returns a single recipe name unchanged (recipe log case)', () => {
    expect(deriveMealName(['PB Banana Toast Pre-workout'])).toBe('PB Banana Toast Pre-workout')
  })

  it('joins several short names with a comma', () => {
    expect(deriveMealName(['Alma', 'Banán'])).toBe('Alma, Banán')
  })

  it('filters out empty/whitespace names', () => {
    expect(deriveMealName(['', '  ', 'Alma'])).toBe('Alma')
  })

  it('truncates with an ellipsis when names overflow the cap', () => {
    const out = deriveMealName([
      'Mili Laktózmentes natúr joghurt',
      'Cocoa Granola Hesters Life',
      'Pudding High Protein Chocolate',
      'Őszibarack',
    ])
    expect(out.startsWith('Mili Laktózmentes natúr joghurt')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(MAX_DERIVED_NAME_LEN + 1)
  })
})
