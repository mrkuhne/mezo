import { describe, expect, it } from 'vitest'
import { FACT_KIND_ICON, FACT_KIND_LABEL } from '@/features/me/logic/personFactCopy'

describe('personFactCopy', () => {
  it('labels every person-fact kind exactly as the person page always did', () => {
    expect(FACT_KIND_LABEL).toEqual({
      preference: 'kedveli / nem szereti',
      relationship_state: 'kapcsolat most',
      shared_activity: 'közös',
      important_date: 'fontos dátum',
      sensitivity: 'érzékeny',
    })
  })

  it('gives every kind its own 3D icon', () => {
    expect(FACT_KIND_ICON).toEqual({
      preference: 't-thumb-up', relationship_state: 't-person', shared_activity: 't-link',
      important_date: 't-calendar', sensitivity: 't-shield',
    })
  })
})
