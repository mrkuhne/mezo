import { beforeEach, describe, expect, test } from 'vitest'
import type { SleepEntry } from '@/data/types'
import {
  evaluateEscalation, isSnoozed, snooze, MIN_SAMPLES, SNOOZE_KEY,
} from '@/features/me/logic/sleepEscalation'

const TODAY = '2026-07-24'
const entry = (date: string, duration: number, quality = 7): SleepEntry => ({
  date, bedtime: '23:00', wakeup: '06:30', duration, quality,
  awakenings: 1, mealToSleep: 0, notes: null,
})
/** n recent nights ending yesterday, all inside the 14-day window. */
const recent = (n: number, duration: number, quality = 7): SleepEntry[] =>
  Array.from({ length: n }, (_, i) => entry(`2026-07-${String(23 - i).padStart(2, '0')}`, duration, quality))

describe('evaluateEscalation', () => {
  test('never triggers under MIN_SAMPLES', () => {
    expect(evaluateEscalation(recent(MIN_SAMPLES - 1, 4.0, 2), TODAY)).toEqual({ triggered: false, reason: null })
  })
  test('short: avg below 6.0 triggers, exactly 6.0 does not', () => {
    expect(evaluateEscalation(recent(5, 5.9), TODAY)).toEqual({ triggered: true, reason: 'short' })
    expect(evaluateEscalation(recent(5, 6.0), TODAY).reason).not.toBe('short')
  })
  test('quality: avg exactly 4 triggers, 4.2 does not', () => {
    expect(evaluateEscalation(recent(5, 7.5, 4), TODAY)).toEqual({ triggered: true, reason: 'quality' })
    expect(evaluateEscalation(recent(5, 7.5, 4.2), TODAY)).toEqual({ triggered: false, reason: null })
  })
  test('short takes precedence over quality', () => {
    expect(evaluateEscalation(recent(5, 5.0, 3), TODAY).reason).toBe('short')
  })
  test('entries outside the trailing 14 days are ignored', () => {
    const old = Array.from({ length: 5 }, (_, i) => entry(`2026-06-${String(20 - i).padStart(2, '0')}`, 4.0, 2))
    expect(evaluateEscalation(old, TODAY)).toEqual({ triggered: false, reason: null })
  })
  test('empty log: no trigger', () => {
    expect(evaluateEscalation([], TODAY)).toEqual({ triggered: false, reason: null })
  })
})

describe('snooze', () => {
  beforeEach(() => localStorage.clear())

  test('round-trip: snooze mutes for 14 days, expires after', () => {
    expect(isSnoozed(TODAY)).toBe(false)
    snooze(TODAY)
    expect(isSnoozed(TODAY)).toBe(true)
    expect(isSnoozed('2026-08-06')).toBe(true)  // day 13
    expect(isSnoozed('2026-08-07')).toBe(false) // day 14 — expired
  })
  test('corrupt stored value reads as not snoozed', () => {
    localStorage.setItem(SNOOZE_KEY, 'garbage')
    expect(isSnoozed(TODAY)).toBe(false)
  })
})
