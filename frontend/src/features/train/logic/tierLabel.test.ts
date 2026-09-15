import { describe, expect, it } from 'vitest'
import { TIER_LABEL, tierLabel } from './tierLabel'

describe('tierLabel', () => {
  it('renders the three Hungarian tier labels', () => {
    expect(tierLabel('maintain')).toBe('Tartás')
    expect(tierLabel('grow')).toBe('Építés')
    expect(tierLabel('emphasize')).toBe('Hangsúly')
  })

  it('falls back to the grow label for unknown or absent tiers (the wire sparse-default)', () => {
    expect(tierLabel('bogus')).toBe(TIER_LABEL.grow)
    expect(tierLabel(null)).toBe(TIER_LABEL.grow)
    expect(tierLabel(undefined)).toBe(TIER_LABEL.grow)
  })
})
