import { describe, expect, it } from 'vitest'
import { trainDayEnergy } from '@/features/train/logic/trainDayEnergy'

const block = (kind: 'gym' | 'sport' | 'run', minutes: number, done: boolean) => ({ kind, minutes, done })

describe('trainDayEnergy', () => {
  it('sums a single 60-min gym block at 80 kg to 480 planned kcal, unearned', () => {
    const energy = trainDayEnergy([block('gym', 60, false)], 80)
    expect(energy.plannedKcal).toBe(480)
    expect(energy.earnedKcal).toBe(0)
    expect(energy.known).toBe(true)
  })

  it('moves a done block into earnedKcal', () => {
    const energy = trainDayEnergy([block('gym', 60, true)], 80)
    expect(energy.plannedKcal).toBe(480)
    expect(energy.earnedKcal).toBe(480)
    expect(energy.known).toBe(true)
  })

  it('sums mixed blocks, only the done ones counting toward earnedKcal', () => {
    // gym 6.0 * 80 * 60/60 = 480 (done); run 9.5 * 80 * 30/60 = 380 (not done)
    const energy = trainDayEnergy([block('gym', 60, true), block('run', 30, false)], 80)
    expect(energy.plannedKcal).toBe(860)
    expect(energy.earnedKcal).toBe(480)
    expect(energy.known).toBe(true)
  })

  it('is unknown with zeros when weightKg is null', () => {
    const energy = trainDayEnergy([block('gym', 60, true)], null)
    expect(energy).toEqual({ plannedKcal: 0, earnedKcal: 0, known: false })
  })

  it('is unknown with zeros when weightKg is 0', () => {
    const energy = trainDayEnergy([block('gym', 60, true)], 0)
    expect(energy).toEqual({ plannedKcal: 0, earnedKcal: 0, known: false })
  })

  it('is unknown with zeros when there are no blocks, even with a known weight', () => {
    const energy = trainDayEnergy([], 80)
    expect(energy).toEqual({ plannedKcal: 0, earnedKcal: 0, known: false })
  })
})
