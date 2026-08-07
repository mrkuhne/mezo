import { describe, expect, it } from 'vitest'
import type { FuelSlot, SleepEntry, SleepGoal } from '@/data/types'
import {
  bedCountdown,
  dayBalance,
  fallbackHero,
  hrvFact,
  kcalFact,
  morningHero,
  proteinFact,
  sleepOutlook,
  weightFact,
} from '@/features/today/logic/islandFacts'

const goal: SleepGoal = {
  targetMinutes: 450,
  anchor: 'WAKE',
  anchorTime: '06:45',
  wakeTime: '06:45',
  bedTime: '23:15',
  regularityBandMin: 30,
}

const night = (date: string, duration: number): SleepEntry => ({
  date,
  bedtime: '23:15',
  wakeup: '06:45',
  duration,
  quality: 3,
  awakenings: 1,
  mealToSleep: 120,
  notes: null,
})

describe('morningHero', () => {
  it('returns null without a last night', () => {
    expect(morningHero(undefined, [], goal)).toBeNull()
  })

  it('formats hours with comma and reports below-goal diff', () => {
    const h = morningHero(night('2026-08-07', 7.2), [night('2026-08-07', 7.2)], goal)!
    expect(h.value).toBe('7,2')
    expect(h.unit).toBe('óra alvás')
    expect(h.sub).toContain('a célod alatt')
  })

  it('adds the weekly debt once the log has 3+ nights', () => {
    const log = [night('2026-08-05', 7.0), night('2026-08-06', 7.0), night('2026-08-07', 7.2)]
    expect(morningHero(log[2], log, goal)!.sub).toContain('heti adósság')
  })
})

describe('weightFact', () => {
  it('null on empty log', () => {
    expect(weightFact([], 76)).toBeNull()
  })

  it('7-day delta, good tone toward target, target in text', () => {
    const f = weightFact(
      [
        { date: '2026-07-31', value: 79.0 },
        { date: '2026-08-07', value: 78.6 },
      ],
      76,
    )!
    expect(f.value).toBe('78,6')
    expect(f.delta!.text).toContain('−0,4')
    expect(f.delta!.tone).toBe('good')
    expect(f.delta!.text).toContain('cél 76,0')
  })

  it('warn tone when moving away from target', () => {
    const f = weightFact(
      [
        { date: '2026-07-31', value: 78.0 },
        { date: '2026-08-07', value: 78.6 },
      ],
      76,
    )!
    expect(f.delta!.tone).toBe('warn')
  })

  it('single entry → no delta', () => {
    expect(weightFact([{ date: '2026-08-07', value: 78.6 }], 76)!.delta).toBeUndefined()
  })
})

describe('hrvFact', () => {
  it('picks the HRV cell', () => {
    expect(hrvFact([{ label: 'HRV', value: '64', unit: 'ms' }])!.value).toBe('64')
  })

  it('null when real mode has no HRV cell', () => {
    expect(hrvFact([{ label: 'Alvás', value: '7,2', unit: 'h' }])).toBeNull()
  })
})

describe('proteinFact', () => {
  const slot = (state: FuelSlot['state'], p?: number): FuelSlot =>
    ({ time: '08:00', kind: 'meal', label: 'x', state, p }) as FuelSlot

  it('sums done vs total protein', () => {
    const f = proteinFact([slot('done', 40), slot('done', 22), slot('pending', 60), slot('pending', 38)])!
    expect(f.value).toBe('62')
    expect(f.delta!.text).toBe('cél 160 g')
  })

  it('null when no slot carries protein', () => {
    expect(proteinFact([slot('done')])).toBeNull()
  })
})

describe('bedCountdown', () => {
  it('formats H:MM before bed', () => {
    expect(bedCountdown(new Date('2026-08-07T21:30:00'), goal).value).toBe('1:45')
  })

  it('flips to elmúlt after bed', () => {
    const h = bedCountdown(new Date('2026-08-07T23:40:00'), goal)
    expect(h.value).toBe('23:15')
    expect(h.unit).toBe('elmúlt')
  })
})

describe('the rest', () => {
  it('fallbackHero / dayBalance / sleepOutlook / kcalFact shapes', () => {
    expect(fallbackHero(3)).toEqual({ value: '3', unit: 'tétel ma', sub: null })
    expect(dayBalance({ done: 9, total: 11, xp: 60 }, 85)).toMatchObject({ value: '+85', unit: 'XP' })
    expect(sleepOutlook(goal)).toMatchObject({ value: '7,5', delta: { text: 'ha 23:15-kor lefekszel' } })
    expect(kcalFact({ balance: 120, target: 2450 })!.delta!.text).toBe('egyenleg +120')
    expect(kcalFact(null)).toBeNull()
  })
})
