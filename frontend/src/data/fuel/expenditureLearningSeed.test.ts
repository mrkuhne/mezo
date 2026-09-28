// ============================================================
// Learned-expenditure part 2 mock seed consistency (mezo-3n2so, Task 10). The mock tells ONE
// story across every surface: the weekly card's excluded days are real suspicious days of the
// 14-day list (so „Teljes volt” shows the −40 story on both), the history's latest row IS the
// card's week, and the Fuel day's learned base (the equation box's Alap) is that row's number.
// ============================================================
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyMockDayMark, expenditureHistorySeed, expenditureWeeklyCardSeed, intakeDaysSeed,
  resetMockLearningState, todayIso,
} from '@/data/fuel/expenditureLearningSeed'
import { fuelDayEnergy } from '@/data/fuel/fuel'
import { addDays } from '@/shared/lib/dates'

afterEach(() => resetMockLearningState())

describe('learned-expenditure mock seed', () => {
  it('history: 12 calendar weeks, ascending, one gap, no duplicate week, ending on the card week', () => {
    const { weeks } = expenditureHistorySeed()
    const starts = weeks.map(w => w.weekStart)
    expect(new Set(starts).size).toBe(starts.length)
    expect([...starts].sort()).toEqual(starts)
    expect(weeks).toHaveLength(11)
    expect(addDays(starts[0], 7 * 11)).toBe(starts[starts.length - 1])
    expect(starts[starts.length - 1]).toBe(expenditureWeeklyCardSeed()!.weekStart)
  })

  it("the card's excluded days are suspicious days of the 14-day list with the same kcal", () => {
    const card = expenditureWeeklyCardSeed()!
    const days = intakeDaysSeed()
    for (const x of card.excludedDays) {
      const day = days.find(d => d.date === x.date)
      expect(day, x.date).toBeDefined()
      expect(day!.status).toBe('suspicious')
      expect(day!.kcal).toBe(x.kcal)
    }
  })

  it('„Teljes volt” on a card day moves the frame −40 kcal from the card base', () => {
    const card = expenditureWeeklyCardSeed()!
    const r = applyMockDayMark(card.excludedDays[0].date, { kind: 'set', status: 'complete' })
    expect(r.appliedBaseBeforeKcal).toBe(card.appliedBaseKcal)
    expect(r.appliedBaseAfterKcal).toBe(card.appliedBaseKcal - 40)
    // the history's latest row follows the re-chain
    expect(expenditureHistorySeed().weeks.at(-1)!.appliedBaseKcal).toBe(card.appliedBaseKcal - 40)
  })

  it('the last 14 days before today carry every status', () => {
    const today = todayIso()
    const statuses = new Set(intakeDaysSeed(addDays(today, -14), addDays(today, -1)).map(d => d.status))
    expect([...statuses].sort()).toEqual(['confirmed_complete', 'marked_incomplete', 'suspicious', 'unlogged', 'usable'])
    expect(intakeDaysSeed(addDays(today, -14), addDays(today, -1))).toHaveLength(14)
  })

  it("the Fuel day's learned base is the history's latest applied base (2480 ± 150, medium; formula 2400)", () => {
    const last = expenditureHistorySeed().weeks.at(-1)!
    expect(last).toMatchObject({ appliedBaseKcal: 2480, posteriorSdKcal: 150, confidence: 'medium', formulaBaseKcal: 2400 })
    expect(fuelDayEnergy.baseKcal).toBe(last.appliedBaseKcal)
    expect(fuelDayEnergy.baseSdKcal).toBe(last.posteriorSdKcal)
    expect(fuelDayEnergy.baseConfidence).toBe(last.confidence)
    expect(fuelDayEnergy.formulaBaseKcal).toBe(last.formulaBaseKcal)
  })
})
