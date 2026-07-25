import { describe, expect, it } from 'vitest'
import { harvestStages } from '@/features/ritual/logic/harvestStages'

describe('harvestStages', () => {
  it('stages a 4-source/2-coin day with a skill highlight', () => {
    expect(harvestStages({ sources: 4, coins: 2, hasSkillHighlight: true })).toEqual([
      { kind: 'xp-total', delayMs: 400 },
      { kind: 'source', delayMs: 650 },
      { kind: 'source', delayMs: 900 },
      { kind: 'source', delayMs: 1150 },
      { kind: 'source', delayMs: 1400 },
      { kind: 'coin', delayMs: 1700 },
      { kind: 'coin', delayMs: 1950 },
      { kind: 'skill', delayMs: 2350 },
      { kind: 'streak', delayMs: 2750 },
    ])
  })

  it('stages the same 4-source/2-coin day WITHOUT a skill highlight — streak follows the coins directly', () => {
    expect(harvestStages({ sources: 4, coins: 2, hasSkillHighlight: false })).toEqual([
      { kind: 'xp-total', delayMs: 400 },
      { kind: 'source', delayMs: 650 },
      { kind: 'source', delayMs: 900 },
      { kind: 'source', delayMs: 1150 },
      { kind: 'source', delayMs: 1400 },
      { kind: 'coin', delayMs: 1700 },
      { kind: 'coin', delayMs: 1950 },
      { kind: 'streak', delayMs: 2350 },
    ])
  })

  it('a thin day (0 sources, 0 coins, no skill) still stages xp-total then streak', () => {
    expect(harvestStages({ sources: 0, coins: 0, hasSkillHighlight: false })).toEqual([
      { kind: 'xp-total', delayMs: 400 },
      { kind: 'streak', delayMs: 800 },
    ])
  })

  it('coins with zero sources start 300ms after the xp-total beat', () => {
    expect(harvestStages({ sources: 0, coins: 1, hasSkillHighlight: false })).toEqual([
      { kind: 'xp-total', delayMs: 400 },
      { kind: 'coin', delayMs: 700 },
      { kind: 'streak', delayMs: 1100 },
    ])
  })
})
