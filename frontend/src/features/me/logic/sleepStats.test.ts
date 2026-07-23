import { describe, it, expect } from 'vitest'
import { regularityScore, efficiencyPct, bedDeltaMin, REGULARITY_WINDOW_DAYS, EFFICIENCY_TARGET_PCT } from '@/features/me/logic/sleepStats'
import type { SleepEntry, SleepGoal } from '@/data/types'

const goal: SleepGoal = { targetMinutes: 450, anchor: 'WAKE', anchorTime: '06:45', wakeTime: '06:45', bedTime: '23:15', regularityBandMin: 15 }
const entry = (date: string, bedtime: string, wakeup: string, extra: Partial<SleepEntry> = {}): SleepEntry =>
  ({ date, bedtime, wakeup, duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 0, notes: null, ...extra })

describe('regularityScore', () => {
  it('counts only nights with BOTH ends inside the ±band', () => {
    const logs = [
      entry('2026-07-20', '23:15', '06:45'), // both exact — in
      entry('2026-07-21', '23:29', '06:31'), // both at +14/−14 — in
      entry('2026-07-22', '23:31', '06:45'), // bed +16 — out
      entry('2026-07-23', '23:15', '07:01'), // wake +16 — out
    ]
    expect(regularityScore(logs, goal, 14)).toBeCloseTo(0.5)
  })

  it('handles a bed target across midnight with circular distance', () => {
    const wrapGoal: SleepGoal = { ...goal, anchor: 'BED', anchorTime: '00:00', wakeTime: '07:30', bedTime: '00:00' }
    const logs = [entry('2026-07-23', '23:50', '07:20')] // bed −10 circularly, wake −10 — in
    expect(regularityScore(logs, wrapGoal, 14)).toBe(1)
  })

  it('windows to the last N days ANCHORED AT the latest log (mock-safe), skips end-less rows', () => {
    const logs = [
      entry('2026-07-01', '23:15', '06:45'),                        // outside the 14d window — ignored
      entry('2026-07-22', '23:15', '06:45'),                        // in window, in band
      { ...entry('2026-07-23', '', ''), bedtime: '', wakeup: '' },  // no ends — skipped
    ]
    expect(regularityScore(logs, goal, 14)).toBe(1)
  })

  it('is null when no scorable night exists', () => {
    expect(regularityScore([], goal, 14)).toBeNull()
  })
})

describe('efficiencyPct', () => {
  it('uses inBedMin when present: asleep ÷ in-bed', () => {
    expect(efficiencyPct(entry('2026-07-23', '00:42', '09:03', { duration: 7.48, inBedMin: 501 }))).toBeCloseTo(89.6, 1)
  })
  it('falls back to the bedtime→wakeup span (midnight wrap)', () => {
    expect(efficiencyPct(entry('2026-07-23', '23:15', '06:45', { duration: 7.0 }))).toBeCloseTo(93.3, 1)
  })
  it('caps at 100 and is null without any span', () => {
    expect(efficiencyPct(entry('2026-07-23', '23:00', '06:00', { duration: 8 }))).toBe(100)
    expect(efficiencyPct({ ...entry('2026-07-23', '', ''), bedtime: '', wakeup: '' })).toBeNull()
  })
})

describe('bedDeltaMin', () => {
  it('signs the delta vs. the target bed (late positive)', () => {
    expect(bedDeltaMin(entry('2026-07-23', '23:30', '06:45'), goal)).toBe(15)
    expect(bedDeltaMin(entry('2026-07-23', '23:00', '06:45'), goal)).toBe(-15)
  })
  it('wraps around midnight (00:05 vs 23:15 target = +50)', () => {
    expect(bedDeltaMin(entry('2026-07-23', '00:05', '06:45'), goal)).toBe(50)
  })
})

describe('constants', () => {
  it('exports the FE display config', () => {
    expect(REGULARITY_WINDOW_DAYS).toBe(14)
    expect(EFFICIENCY_TARGET_PCT).toBe(85)
  })
})
