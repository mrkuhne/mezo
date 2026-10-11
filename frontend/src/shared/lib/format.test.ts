import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { frameDate } from '@/app/navModel'
import { fmtDate, fmtGrouped, fmtInt, fmtNum, isoDay, locale } from './format'
import { huDow, huFullDate, huMonthDay, huMonthDayAged, huMonthDayDow, huWeekdayFull, huWeekdayFullIso } from './dates'
import { hu1, huArticle, huFrom, huInt } from './huNum'
import { article, azA, outOf } from './huText'

const en = () => setLang('en', { persist: false })
const wed = new Date(2026, 9, 7) // Wednesday 7 October 2026

describe('Hungarian (the default)', () => {
  it('locale and frame date', () => {
    expect(locale()).toBe('hu-HU')
    expect(fmtDate(wed, 'frame')).toBe('Szerda, október 7.')
  })

  it('numbers keep the Hungarian shape', () => {
    expect([0, 5, 78.4, 80, 1200, 12345.6, -3.5].map((v) => fmtNum(v))).toEqual(['0', '5', '78,4', '80', '1200', '12345,6', '-3,5'])
    expect(fmtNum(78.456, 2)).toBe('78,46')
    expect(fmtNum(78.4, 0)).toBe('78')
    expect([0, 1200, 12345.6, -1200].map(fmtGrouped)).toEqual(['0', '1 200', '12 346', '−1 200'])
    // the browser's own rule: grouping from 5 digits up, regular spaces
    expect([0, 999, 1200, 12345.6, 1234567].map(fmtInt)).toEqual(['0', '999', '1200', '12 346', '1 234 567'])
  })
})

describe('English', () => {
  it('locale and date styles', () => {
    en()
    expect(locale()).toBe('en-GB')
    expect(fmtDate(wed, 'frame')).toBe('Wednesday, 7 October')
    expect(fmtDate(wed, 'full')).toBe('Wednesday, 7 October')
    expect(fmtDate(wed, 'weekdayLong')).toBe('Wednesday')
    expect(fmtDate(wed, 'weekdayShort')).toBe('Wed')
    expect(fmtDate(wed, 'monthDay')).toBe('7 Oct')
    expect(fmtDate(wed, 'monthDayWeekday')).toBe('7 Oct · Wed')
    expect(frameDate(wed)).toBe('Wednesday, 7 October')
  })

  it('month-day, weekday helpers', () => {
    en()
    expect(huMonthDay('2026-11-02')).toBe('2 Nov')
    expect(huMonthDay('2026-09-05')).toBe('5 Sep') // never „Sept"
    expect(huDow('2026-10-08')).toBe('Thu')
    expect(huWeekdayFullIso('2026-10-10')).toBe('Saturday')
    expect(huWeekdayFull(wed)).toBe('Wednesday')
    expect(huMonthDayDow('2026-05-20')).toBe('20 May · Wed')
    expect(huFullDate('2026-09-09')).toBe('Wednesday, 9 September')
  })

  it('aged month-day puts the year last', () => {
    en()
    const today = new Date(2026, 9, 11)
    expect(huMonthDayAged('2026-05-01', today)).toBe('1 May')
    expect(huMonthDayAged('2025-09-03', today)).toBe('3 Sep 2025')
  })

  it('every month and weekday has a stable three-letter form', () => {
    en()
    const months = Array.from({ length: 12 }, (_, i) => huMonthDay(`2026-${String(i + 1).padStart(2, '0')}-01`))
    expect(months).toEqual(['1 Jan', '1 Feb', '1 Mar', '1 Apr', '1 May', '1 Jun', '1 Jul', '1 Aug', '1 Sep', '1 Oct', '1 Nov', '1 Dec'])
    const dows = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map(huDow)
    expect(dows).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  })

  it('numbers use the decimal point and commas', () => {
    en()
    expect(hu1(78.4)).toBe('78.4')
    expect(hu1(80)).toBe('80')
    expect(fmtNum(12345.6)).toBe('12345.6')
    expect(huInt(1200)).toBe('1,200')
    expect(huInt(-1200)).toBe('−1,200')
    expect(fmtInt(1200)).toBe('1,200')
    expect(fmtInt(12345.6)).toBe('12,346')
  })

  it('grammar helpers return the plain form', () => {
    en()
    expect(huFrom(5)).toBe('5')
    expect(huArticle(5)).toBe('the')
    expect(article('apple')).toBe('the')
    expect(article('apple', true)).toBe('The')
    expect(azA(5)).toBe('the')
    expect(outOf(5)).toBe('of 5')
  })
})

describe('a date-only string is not shifted by the time zone', () => {
  it('is read by its parts (the 7th, whatever the zone)', () => {
    // a string never goes through `new Date('YYYY-MM-DD')` (UTC midnight), whose local day is the 6th west of UTC.
    expect(fmtDate('2026-10-07', 'monthDay')).toBe('Okt 7')
    expect(fmtDate('2026-10-07', 'weekdayLong')).toBe('Szerda')
    en()
    expect(fmtDate('2026-10-07', 'frame')).toBe('Wednesday, 7 October')
    expect(fmtDate('2026-01-01', 'monthDay')).toBe('1 Jan')
    expect(fmtDate('2026-12-31', 'monthDay')).toBe('31 Dec')
  })

  // Real zones: assigning process.env.TZ switches Node's zone at runtime. The module caches Intl formatters
  // (they keep the zone they were built in), so each zone gets a FRESH module graph (resetModules + dynamic import).
  describe.each(['America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati'])('under %s', (zone) => {
    const original = process.env.TZ
    beforeEach(() => { process.env.TZ = zone; vi.resetModules() })
    afterEach(() => {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
      vi.resetModules()
    })

    it('2026-10-07 is the 7th in both languages', async () => {
      expect(new Date(2026, 9, 7, 12).getDate()).toBe(7) // the zone really switched
      const i18n = await import('@/shared/i18n')
      const fmt = await import('./format')
      const dates = await import('./dates')
      i18n.setLang('hu', { persist: false })
      expect(fmt.fmtDate('2026-10-07', 'monthDay')).toBe('Okt 7')
      expect(dates.huMonthDay('2026-10-07')).toBe('Okt 7')
      i18n.setLang('en', { persist: false })
      expect(fmt.fmtDate('2026-10-07', 'monthDay')).toBe('7 Oct')
      expect(fmt.fmtDate('2026-10-07', 'frame')).toBe('Wednesday, 7 October')
      expect(dates.huMonthDay('2026-10-07')).toBe('7 Oct')
      i18n.setLang('hu', { persist: false })
    })
  })

  it('isoDay stays the machine format in every language', () => {
    en()
    expect(isoDay(wed)).toBe('2026-10-07')
  })
})
