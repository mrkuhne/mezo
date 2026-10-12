// The date and number styles the Fuel slice added to format.ts (Folyadék F5, mezo-n4wf5.5) — the approved prototype's
// own formats (`vilagos/fuel.js`: dS · dL · dW · dF · dR · whenT · fmt): Hungarian dotted lower-case months with the
// closing dot, English day first without dots. Each style in both languages, and safe in every time zone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { fmtClock, fmtDate, fmtDateTime, fmtFixed, fmtRange } from './format'

const hu = () => setLang('hu', { persist: false })
const en = () => setLang('en', { persist: false })
afterEach(hu)

describe('Hungarian', () => {
  it('short and long day, with and without the weekday', () => {
    expect(fmtDate('2026-10-06', 'short')).toBe('okt. 6.')
    expect(fmtDate('2026-05-20', 'short')).toBe('máj. 20.')
    expect(fmtDate('2026-10-06', 'long')).toBe('október 6.')
    expect(fmtDate('2026-10-06', 'shortWeekday')).toBe('K, okt. 6.')
    expect(fmtDate('2026-09-23', 'shortWeekday')).toBe('Sze, szept. 23.')
    expect(fmtDate('2026-10-06', 'longWeekday')).toBe('kedd, október 6.')
    expect(fmtDate('2026-10-06', 'monthYear')).toBe('2026. október')
  })

  it('every month has its dotted lower-case short form', () => {
    expect(Array.from({ length: 12 }, (_, i) => fmtDate(new Date(2026, i, 1, 12), 'short'))).toEqual([
      'jan. 1.', 'febr. 1.', 'márc. 1.', 'ápr. 1.', 'máj. 1.', 'jún. 1.', 'júl. 1.', 'aug. 1.', 'szept. 1.', 'okt. 1.', 'nov. 1.', 'dec. 1.'])
  })

  it('the weekday alone: lower-case word, the compact set, one letter', () => {
    const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
    expect(week.map(d => fmtDate(d, 'weekdayLower'))).toEqual(['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat', 'vasárnap'])
    expect(week.map(d => fmtDate(d, 'weekdayCompact'))).toEqual(['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'])
    expect(week.map(d => fmtDate(d, 'weekdayLetter'))).toEqual(['H', 'K', 'S', 'C', 'P', 'S', 'V'])
  })

  it('a range names the month once inside a month, twice across two', () => {
    expect(fmtRange('2026-10-05', '2026-10-11')).toBe('okt. 5–11.')
    expect(fmtRange('2026-09-21', '2026-09-27')).toBe('szept. 21–27.')
    expect(fmtRange('2026-09-28', '2026-10-04')).toBe('szept. 28. – okt. 4.')
    expect(fmtRange('2026-12-28', '2027-01-03')).toBe('dec. 28. – jan. 3.')
  })

  it('fixed fraction digits keep the zero, with the decimal comma and a real minus', () => {
    expect(fmtFixed(5, 1)).toBe('5,0')
    expect(fmtFixed(8.44, 1)).toBe('8,4')
    expect(fmtFixed(4, 2)).toBe('4,00')
    expect(fmtFixed(-0.25, 1)).toBe('−0,3')
    expect(fmtFixed(-0.04, 1)).toBe('0,0')
    expect(fmtFixed(1234.5, 1)).toBe('1234,5')
  })

  it('the clock, and a day with its clock', () => {
    expect(fmtClock(new Date(2026, 4, 20, 9, 4))).toBe('09:04')
    expect(fmtClock('2026-05-20T09:14:00')).toBe('09:14')
    expect(fmtClock('2026-05-20 23:05')).toBe('23:05')
    expect(fmtDateTime('2026-05-20T09:14:00')).toBe('máj. 20. · 09:14')
  })
})

describe('English', () => {
  beforeEach(en)

  it('day first, no dots, no ordinal', () => {
    expect(fmtDate('2026-10-06', 'short')).toBe('6 Oct')
    expect(fmtDate('2026-10-06', 'long')).toBe('6 October')
    expect(fmtDate('2026-10-06', 'shortWeekday')).toBe('Tue, 6 Oct')
    expect(fmtDate('2026-10-06', 'longWeekday')).toBe('Tuesday, 6 October')
    expect(fmtDate('2026-10-06', 'monthYear')).toBe('October 2026')
  })

  it('weekdays', () => {
    const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
    expect(week.map(d => fmtDate(d, 'weekdayLower'))).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    expect(week.map(d => fmtDate(d, 'weekdayCompact'))).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(week.map(d => fmtDate(d, 'weekdayLetter'))).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('ranges', () => {
    expect(fmtRange('2026-10-05', '2026-10-11')).toBe('5–11 Oct')
    expect(fmtRange('2026-09-28', '2026-10-04')).toBe('28 Sep – 4 Oct')
  })

  it('fixed digits with the point; the clock is the same 24-hour clock', () => {
    expect(fmtFixed(5, 1)).toBe('5.0')
    expect(fmtFixed(-0.25, 1)).toBe('−0.3')
    expect(fmtClock('2026-05-20T09:14:00')).toBe('09:14')
    expect(fmtDateTime('2026-05-20T09:14:00')).toBe('20 May · 09:14')
  })
})

// Bible N1.9 / N1.17: a zone guard is trusted only after it was seen RED. These were run against (a) `new Date(iso)` for the
// date-only strings (UTC midnight → the day before, west of Greenwich) and (b) a clock built from a cached `Intl` formatter
// (it keeps the zone of its first use) — both failed here before the implementation read the date's own parts / fields.
describe('the new styles in every time zone', () => {
  describe.each(['America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati'])('under %s', (zone) => {
    const original = process.env.TZ
    beforeEach(() => { process.env.TZ = zone; vi.resetModules() })
    afterEach(() => {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
      vi.resetModules()
    })

    it('a date-only string is that day, and a zone-less wall clock keeps its digits', async () => {
      expect(new Date(2026, 9, 7, 12).getDate()).toBe(7) // the zone really switched
      const i18n = await import('@/shared/i18n')
      const fmt = await import('./format')
      i18n.setLang('hu', { persist: false })
      expect(fmt.fmtDate('2026-10-07', 'short')).toBe('okt. 7.')
      expect(fmt.fmtDate('2026-10-07', 'longWeekday')).toBe('szerda, október 7.')
      expect(fmt.fmtDate('2026-10-07', 'weekdayCompact')).toBe('Sze')
      expect(fmt.fmtRange('2026-09-28', '2026-10-04')).toBe('szept. 28. – okt. 4.')
      expect(fmt.fmtRange('2026-10-05', '2026-10-11')).toBe('okt. 5–11.')
      expect(fmt.fmtDateTime('2026-05-20T09:14:00')).toBe('máj. 20. · 09:14')
      i18n.setLang('en', { persist: false })
      expect(fmt.fmtDate('2026-10-07', 'shortWeekday')).toBe('Wed, 7 Oct')
      expect(fmt.fmtRange('2026-10-05', '2026-10-11')).toBe('5–11 Oct')
      i18n.setLang('hu', { persist: false })
    })
  })

  // NO module reset on purpose (N1.17): a live app that crosses a time zone keeps its modules.
  it('the clock and the day of an INSTANT follow the zone the device is in now', () => {
    const original = process.env.TZ
    const instant = '2026-10-07T23:30:00Z'
    try {
      process.env.TZ = 'America/Los_Angeles'
      expect(new Date(instant).getHours()).toBe(16) // the zone really switched
      expect(fmtClock(instant)).toBe('16:30')
      expect(fmtDateTime(instant)).toBe('okt. 7. · 16:30')
      expect(fmtDate(new Date(instant), 'shortWeekday')).toBe('Sze, okt. 7.')
      process.env.TZ = 'Pacific/Kiritimati'
      expect(fmtClock(instant)).toBe('13:30')
      expect(fmtDateTime(instant)).toBe('okt. 8. · 13:30')
      en()
      expect(fmtDate(new Date(instant), 'shortWeekday')).toBe('Thu, 8 Oct')
      expect(fmtDate(new Date(instant), 'longWeekday')).toBe('Thursday, 8 October')
      process.env.TZ = 'America/Los_Angeles'
      expect(fmtDate(new Date(instant), 'longWeekday')).toBe('Wednesday, 7 October')
    } finally {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    }
  })
})
