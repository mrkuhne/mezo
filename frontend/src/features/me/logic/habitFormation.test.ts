import { describe, expect, it } from 'vitest'
import {
  curveY, etaPhrase, FORMATION_STAGES, repsAtThreshold, stageIndexOf, weekdayBreakdown,
} from '@/features/me/logic/habitFormation'

describe('stageIndexOf', () => {
  it('maps the curve onto the four stages the user reads', () => {
    expect(FORMATION_STAGES[stageIndexOf(0)].label).toBe('még tudatos')
    expect(FORMATION_STAGES[stageIndexOf(24)].label).toBe('még tudatos')
    expect(FORMATION_STAGES[stageIndexOf(25)].label).toBe('épül')
    expect(FORMATION_STAGES[stageIndexOf(59)].label).toBe('épül')
    expect(FORMATION_STAGES[stageIndexOf(60)].label).toBe('kezd magától menni')
    expect(FORMATION_STAGES[stageIndexOf(85)].label).toBe('magától megy')
    expect(FORMATION_STAGES[stageIndexOf(100)].label).toBe('magától megy')
  })
})

describe('etaPhrase', () => {
  it('stays null when the estimate is null — no invented deadline', () => {
    expect(etaPhrase(null, null)).toBeNull()
    expect(etaPhrase(3, null)).toBeNull()
    expect(etaPhrase(null, 9)).toBeNull()
  })

  it('speaks weeks while the range is legible', () => {
    expect(etaPhrase(2.4, 6.1)?.big).toBe('2–6 hét')
  })

  it('collapses a one-week-wide range instead of printing "3–3 hét"', () => {
    expect(etaPhrase(3.1, 3.4)?.big).toBe('3 hét')
  })

  it('never promises less than a week', () => {
    expect(etaPhrase(0.1, 0.4)?.big).toBe('1 hét')
  })

  it('widens the unit to months once weeks stop being readable', () => {
    expect(etaPhrase(14, 26)?.big).toBe('3–6 hónap')
  })

  it('refuses false precision far out', () => {
    const far = etaPhrase(30, 90)
    expect(far?.big).toBe('fél éven túl')
    expect(far?.sub).toContain('sűrűbb ismétlés')
  })
})

describe('weekdayBreakdown', () => {
  it('buckets hétfő-first and leaves never-closed days null, not zero', () => {
    // 2026-09-07 is a Monday.
    const cells = weekdayBreakdown([
      { date: '2026-09-07', status: 'done' },
      { date: '2026-09-08', status: 'missed' },
      { date: '2026-09-14', status: 'done' },
      { date: '2026-09-13', status: 'done' }, // vasárnap
      { date: '2026-09-09', status: 'pending' },
    ])
    expect(cells[0].label).toBe('H')
    expect(cells[0]).toMatchObject({ done: 2, missed: 0, ratio: 1 })
    expect(cells[1]).toMatchObject({ done: 0, missed: 1, ratio: 0 })
    expect(cells[2].ratio).toBeNull() // only a pending row — never closed
    expect(cells[6]).toMatchObject({ label: 'V', done: 1 })
  })

  it('reads the date as a local calendar day, not UTC midnight', () => {
    // Naive `new Date('2026-09-07')` is UTC — west of Greenwich that lands on Sunday.
    expect(weekdayBreakdown([{ date: '2026-09-07', status: 'done' }])[0].done).toBe(1)
  })
})

describe('the curve', () => {
  it('saturates: every repetition adds less than the one before', () => {
    const k = 0.03
    const first = curveY(k, 10) - curveY(k, 0)
    const later = curveY(k, 110) - curveY(k, 100)
    expect(later).toBeLessThan(first)
    expect(curveY(k, 0)).toBe(0)
  })

  it('puts the threshold where the curve actually crosses it', () => {
    const k = 0.03
    const n = repsAtThreshold(k, 90)
    expect(curveY(k, n) * 100).toBeCloseTo(90, 6)
  })
})
