import { describe, expect, it } from 'vitest'
import {
  gymLevelUpMock, sportLevelUpMock, runLevelUpMock,
  progressionProfileMock, GHOST_PROGRESSION_PROFILE,
} from '@/data/progressionMock'

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

describe('progression profile fixtures', () => {
  it('seed has an athlete level, a full 6-axis radar (Erő first), and 11+13 skills', () => {
    expect(progressionProfileMock.athleteLevel).toBeGreaterThan(0)
    expect(progressionProfileMock.streakWeeks).toBeGreaterThan(0)
    expect(progressionProfileMock.radarAxes.map((a) => a.axis)).toEqual([
      'Erő', 'Robbanékonyság', 'Sebesség', 'Állóképesség', 'Mozgékonyság', 'Koordináció',
    ])
    expect(progressionProfileMock.athletic).toHaveLength(11)
    expect(progressionProfileMock.muscle).toHaveLength(13)
    expect(progressionProfileMock.highlights.bestAthletic?.skillKey).toBeTruthy()
  })

  it('ghost profile has null athleteLevel and empty arrays (real-empty)', () => {
    expect(GHOST_PROGRESSION_PROFILE.athleteLevel).toBeNull()
    expect(GHOST_PROGRESSION_PROFILE.radarAxes).toEqual([])
    expect(GHOST_PROGRESSION_PROFILE.muscle).toEqual([])
  })
})
