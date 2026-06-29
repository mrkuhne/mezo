import { describe, expect, it } from 'vitest'
import { gymLevelUpMock, sportLevelUpMock, runLevelUpMock } from './progressionMock'

describe('progression mock fixtures', () => {
  it('gym fixture is the rich multi-level-up case with a perk', () => {
    expect(gymLevelUpMock.source).toBe('GYM')
    expect(gymLevelUpMock.totalXp).toBeGreaterThan(0)
    expect(gymLevelUpMock.levelUps.length).toBeGreaterThanOrEqual(2)
    expect(gymLevelUpMock.levelUps).toContain('max_strength')
    expect(gymLevelUpMock.perks.length).toBeGreaterThanOrEqual(1)
    // every levelUp skillKey has a matching gain with levelAfter > levelBefore
    for (const key of gymLevelUpMock.levelUps) {
      const g = gymLevelUpMock.gains.find((x) => x.skillKey === key)
      expect(g).toBeDefined()
      expect(g!.levelAfter).toBeGreaterThan(g!.levelBefore)
    }
  })

  it('run fixture is the no-level-up case (gains, no levelUps/perks)', () => {
    expect(runLevelUpMock.source).toBe('RUN')
    expect(runLevelUpMock.gains.length).toBeGreaterThan(0)
    expect(runLevelUpMock.levelUps).toEqual([])
    expect(runLevelUpMock.perks).toEqual([])
  })

  it('sport fixture has a single athletic level-up', () => {
    expect(sportLevelUpMock.source).toBe('SPORT')
    expect(sportLevelUpMock.levelUps.length).toBe(1)
  })
})
