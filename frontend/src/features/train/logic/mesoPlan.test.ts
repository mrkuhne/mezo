import { describe, expect, it } from 'vitest'
import {
  SESSION_CAP, ceilingSets, dayFrames, frequencyOf, phaseCurve, recommendedDays, splitLine, weekOneSets, weekTotals,
} from './mesoPlan'

const LM = { mev: 10, mav: 16, mrv: 22 }

describe('mesoPlan', () => {
  it('derives the split label from the day count', () => {
    expect(splitLine(['Hét', 'Sze', 'Pén', 'Szo'])).toBe('4 nap → Upper / Lower · minden izom 2×/hét')
    // full body: every training day hits everything — the frequency IS the day count
    expect(splitLine(['Hét', 'Csü'])).toBe('2 nap → Full body · minden izom 2×/hét')
    expect(splitLine(['Hét', 'Sze', 'Pén'])).toBe('3 nap → Full body · minden izom 3×/hét')
    expect(splitLine(['Hét', 'Kedd', 'Sze', 'Pén', 'Szo', 'Vas'])).toBe('6 nap → Push / Pull / Legs ×2 · minden izom 2×/hét')
    // out-of-range picks clamp the whole sentence, label included — never a split it isn't getting
    expect(splitLine(['Hét'])).toBe('2 nap → Full body · minden izom 2×/hét')
  })

  it('recommends weekend-inclusive patterns', () => {
    expect(recommendedDays(4)).toEqual(['Hét', 'Sze', 'Pén', 'Szo'])
    expect(recommendedDays(6)).toContain('Vas')
  })

  it('maps tiers to week-1 start and ceiling', () => {
    expect(weekOneSets('emphasize', LM)).toBe(12)
    expect(weekOneSets('grow', LM)).toBe(10)
    expect(weekOneSets('maintain', LM)).toBe(10)
    expect(ceilingSets('emphasize', LM)).toBe(22)
    expect(ceilingSets('grow', LM)).toBe(16)
    expect(ceilingSets('maintain', LM)).toBe(10)
    expect(weekOneSets('emphasize', { mev: 21, mav: 21, mrv: 22 })).toBe(22)
  })

  it('frames 7 days with rest days and spreads sets with the remainder first', () => {
    const frames = dayFrames(['Hét', 'Sze', 'Pén', 'Szo'], { back: 'emphasize' })
    expect(frames).toHaveLength(7)
    expect(frames.map((f) => f.type)).toEqual(['Upper', 'Rest', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest'])
    const back = frames.filter((f) => f.type === 'Upper').map((f) => f.muscles.find((m) => m.group === 'back')?.sets ?? 0)
    expect(back).toEqual([6, 6])
    const chest7 = dayFrames(['Hét', 'Sze', 'Pén', 'Szo'], null, { chest: { mev: 7, mav: 14, mrv: 20 } })
    expect(chest7.filter((f) => f.type === 'Upper').map((f) => f.muscles.find((m) => m.group === 'chest')?.sets)).toEqual([4, 3])
  })

  it('trains every group at least twice and never above the session cap for 2–6 days', () => {
    for (let n = 2; n <= 6; n++) {
      const frames = dayFrames(recommendedDays(n), { back: 'emphasize', quad: 'emphasize' })
      for (const g of ['chest', 'back', 'shoulder', 'biceps', 'triceps', 'quad', 'ham', 'glute', 'calf']) {
        expect(frequencyOf(frames, g), `${n} days ${g}`).toBeGreaterThanOrEqual(2)
      }
      frames.forEach((f) => f.muscles.forEach((m) => expect(m.sets).toBeLessThanOrEqual(SESSION_CAP)))
    }
  })

  // Mirror of the backend MesoPlanSkeleton.phaseCurve: ramp = weeks - 1, 1-2 MEV weeks
  // (2 once the ramp is 4+), an MRV peak week, MAV in between, always a closing Deload.
  it('derives the phase curve from the block length alone', () => {
    expect(phaseCurve(4)).toEqual(['MEV', 'MAV', 'MRV', 'Deload'])
    expect(phaseCurve(6)).toEqual(['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'])
    expect(phaseCurve(8)).toEqual(['MEV', 'MEV', 'MAV', 'MAV', 'MAV', 'MAV', 'MRV', 'Deload'])
  })

  it('sums week-1 and peak totals over the nine groups', () => {
    const t = weekTotals({ back: 'emphasize' })
    expect(t.weekOne).toBeGreaterThan(50)
    expect(t.peak).toBeGreaterThan(t.weekOne)
  })
})
