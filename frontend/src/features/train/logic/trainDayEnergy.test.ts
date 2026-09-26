import { describe, expect, it } from 'vitest'
import { restKcalPerHour } from '@/data/train/activityEnergy'
import { trainDayEnergy, type Block } from '@/features/train/logic/trainDayEnergy'

const block = (kind: 'gym' | 'sport' | 'run', minutes: number, done: boolean, sport?: string): Block =>
  ({ kind, minutes, done, ...(sport ? { sport } : {}) })

// Net model (mezo-32m82): (MET − 1) × restPerHour × hours; rest 80 kcal/h = BMR 1920 / 24.
const REST = 80

describe('trainDayEnergy', () => {
  it('sums a single 60-min gym block at rest 80 to (3.5−1)×80 planned kcal, unearned', () => {
    const energy = trainDayEnergy([block('gym', 60, false)], REST)
    expect(energy.plannedKcal).toBe((3.5 - 1) * REST) // 200
    expect(energy.earnedKcal).toBe(0)
    expect(energy.known).toBe(true)
  })

  it('moves a done block into earnedKcal', () => {
    const energy = trainDayEnergy([block('gym', 60, true)], REST)
    expect(energy.plannedKcal).toBe((3.5 - 1) * REST)
    expect(energy.earnedKcal).toBe((3.5 - 1) * REST)
    expect(energy.known).toBe(true)
  })

  it('sums mixed blocks, only the done ones counting toward earnedKcal', () => {
    // gym (3.5−1)×80×1 = 200 (done); run (9.3−1)×80×0.5 = 332 (not done)
    const energy = trainDayEnergy([block('gym', 60, true), block('run', 30, false)], REST)
    expect(energy.plannedKcal).toBe(Math.round((3.5 - 1) * REST + (9.3 - 1) * REST * 0.5))
    expect(energy.earnedKcal).toBe((3.5 - 1) * REST)
    expect(energy.known).toBe(true)
  })

  it('a sport block uses its own sport row (volleyball 120′ → (4−1)×80×2)', () => {
    const energy = trainDayEnergy([block('sport', 120, false, 'volleyball')], REST)
    expect(energy.plannedKcal).toBe((4 - 1) * REST * 2) // 480
  })

  it('a sport block without a sport id reads as other', () => {
    const energy = trainDayEnergy([block('sport', 60, false)], REST)
    expect(energy.plannedKcal).toBe((4 - 1) * REST)
  })

  it('derives rest from BMR/24 when BMR is known', () => {
    const energy = trainDayEnergy([block('gym', 60, false)], restKcalPerHour(1920, 95))
    expect(energy.plannedKcal).toBe((3.5 - 1) * (1920 / 24))
  })

  it('a done block with a logged kcal shows the persisted number, never the estimate', () => {
    const logged: Block = { kind: 'sport', sport: 'volleyball', minutes: 120, done: true, loggedKcal: 612 }
    const energy = trainDayEnergy([logged, block('gym', 60, false)], REST)
    expect(energy.earnedKcal).toBe(612)
    expect(energy.plannedKcal).toBe(612 + (3.5 - 1) * REST)
  })

  it('a logged kcal on a not-done block is ignored (the plan is still an estimate)', () => {
    const energy = trainDayEnergy([{ kind: 'sport', sport: 'volleyball', minutes: 60, done: false, loggedKcal: 999 }], REST)
    expect(energy.plannedKcal).toBe((4 - 1) * REST)
  })

  it('is unknown with zeros when rest energy is null', () => {
    const energy = trainDayEnergy([block('gym', 60, true)], null)
    expect(energy).toEqual({ plannedKcal: 0, earnedKcal: 0, known: false })
  })

  it('is unknown with zeros when both BMR and weight are missing/0', () => {
    const energy = trainDayEnergy([block('gym', 60, true)], restKcalPerHour(null, 0))
    expect(energy).toEqual({ plannedKcal: 0, earnedKcal: 0, known: false })
  })

  it('is unknown with zeros when there are no blocks, even with a known rest', () => {
    const energy = trainDayEnergy([], REST)
    expect(energy).toEqual({ plannedKcal: 0, earnedKcal: 0, known: false })
  })
})
