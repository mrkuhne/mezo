import { describe, expect, it } from 'vitest'
import { dayLabel, notificationStamp } from '@/features/notification/logic/stamp'

// Minden időbélyeg dél körüli UTC (a groupByDay.test.ts konvenciója): a futtató gép időzónája
// (±12 h) így nem tolhatja át az elemet egy szomszédos naptári napra, és a teszt CI-ben (UTC)
// ugyanazt jelenti, mint itthon.
describe('dayLabel', () => {
  it('names today and yesterday relatively', () => {
    expect(dayLabel('2026-08-18T12:00:00.000Z', '2026-08-18')).toBe('Ma')
    expect(dayLabel('2026-08-17T12:00:00.000Z', '2026-08-18')).toBe('Tegnap')
  })

  it('dates every older day', () => {
    expect(dayLabel('2026-08-15T12:00:00.000Z', '2026-08-18')).toBe('aug. 15.')
  })

  // Egy pontosan egy évvel korábbi nap nem „Ma": a relatív ág a NAPTÁRI napra kapuz, nem a
  // megjelenített címkére (ugyanaz a csapda, amit a groupByDay kulcsolása kerül ki).
  it('does not call a same-date different-year day today', () => {
    expect(dayLabel('2025-08-18T12:00:00.000Z', '2026-08-18')).toBe('aug. 18.')
  })
})

describe('notificationStamp', () => {
  it('joins the day label and the wall-clock time', () => {
    const at = new Date(2026, 7, 18, 6, 12)
    expect(notificationStamp(at.toISOString(), '2026-08-18')).toBe('Ma · 06:12')
  })

  it('carries the date for older rows', () => {
    const at = new Date(2026, 7, 15, 19, 5)
    expect(notificationStamp(at.toISOString(), '2026-08-18')).toBe('aug. 15. · 19:05')
  })
})
