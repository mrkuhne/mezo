// Pins what every Hungarian formatting helper returned BEFORE the formatting module took over
// (mezo-n4wf5.11, Task 4). Hungarian output must stay byte-identical for these inputs.
import { describe, expect, it } from 'vitest'
import {
  addDays, currentWeekOf, huDow, huFullDate, huMonthDay, huMonthDayAged, huMonthDayDow, huWeekdayFull,
  huWeekdayFullIso, localDateString, mondayOf,
} from './dates'
import { hu1, huArticle, huFrom, huInt, usd } from './huNum'
import { article, azA, outOf, sentenceCase } from './huText'
import { frameDate } from '@/app/navModel'

describe('Hungarian date helpers (characterization)', () => {
  it('weekday names for all seven days (2026-10-04 is a Sunday)', () => {
    const days = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']
    expect(days.map(huDow)).toEqual(['Vas', 'Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo'])
    expect(days.map(huWeekdayFullIso)).toEqual(['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'])
    expect(days.map((iso) => huWeekdayFull(new Date(`${iso}T12:00:00`)))).toEqual(
      ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'])
  })

  it('month-day for every month', () => {
    const out = Array.from({ length: 12 }, (_, i) => huMonthDay(`2026-${String(i + 1).padStart(2, '0')}-05`))
    expect(out).toEqual(['Jan 5', 'Feb 5', 'Már 5', 'Ápr 5', 'Máj 5', 'Jún 5', 'Júl 5', 'Aug 5', 'Szep 5', 'Okt 5', 'Nov 5', 'Dec 5'])
    expect(huMonthDay('2026-11-02')).toBe('Nov 2')
    expect(huMonthDay('2026-10-31')).toBe('Okt 31')
  })

  it('month-day with weekday', () => {
    expect(huMonthDayDow('2026-05-20')).toBe('Máj 20 · Sze')
    expect(huMonthDayDow('2026-10-04')).toBe('Okt 4 · Vas')
    expect(huMonthDayDow('2026-12-31')).toBe('Dec 31 · Csü')
  })

  it('full date', () => {
    expect(huFullDate('2026-09-09')).toBe('Szeptember 9., szerda')
    expect(huFullDate('2026-01-01')).toBe('Január 1., csütörtök')
    expect(huFullDate('2026-12-31')).toBe('December 31., csütörtök')
  })

  it('aged month-day relative to a fixed today (2026-10-11)', () => {
    const today = new Date(2026, 9, 11)
    expect(huMonthDayAged('2026-05-01', today)).toBe('Máj 1')
    expect(huMonthDayAged('2026-10-11', today)).toBe('Okt 11')
    expect(huMonthDayAged('2025-12-11', today)).toBe('Dec 11') // exactly at the cutoff
    expect(huMonthDayAged('2025-12-10', today)).toBe('2025. Dec 10')
    expect(huMonthDayAged('2025-09-03', today)).toBe('2025. Szep 3')
    expect(huMonthDayAged('2027-01-01', today)).toBe('2027. Jan 1') // future year
    expect(huMonthDayAged('2026-12-31', today)).toBe('Dec 31') // later this year
  })

  it('date arithmetic stays machine-format', () => {
    expect(localDateString(new Date(2026, 9, 7))).toBe('2026-10-07')
    expect(localDateString(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(mondayOf('2026-10-07')).toBe('2026-10-05')
    expect(mondayOf('2026-10-11')).toBe('2026-10-05') // Sunday belongs to the previous week
    expect(currentWeekOf('2999-01-01', 6)).toBe(1)
  })

  it('frame date', () => {
    expect(frameDate(new Date(2026, 9, 7))).toBe('Szerda, október 7.')
    expect(frameDate(new Date(2026, 0, 1))).toBe('Csütörtök, január 1.')
    expect(frameDate(new Date(2026, 11, 31))).toBe('Csütörtök, december 31.')
    expect(frameDate(new Date(2026, 9, 5))).toBe('Hétfő, október 5.')
  })
})

describe('Hungarian number helpers (characterization)', () => {
  it('hu1', () => {
    expect([0, 5, 78.4, 80.0, 1200, 12345.6, -3.5, 73, 78.64].map(hu1))
      .toEqual(['0', '5', '78,4', '80', '1200', '12345,6', '-3,5', '73', '78,6'])
  })

  it('huInt', () => {
    expect([0, 5, 78.4, 80, 999, 1200, 12345.6, 1234567, -1200, -5].map(huInt))
      .toEqual(['0', '5', '78', '80', '999', '1 200', '12 346', '1 234 567', '−1 200', '−5'])
  })

  it('usd', () => {
    expect(usd(3.5)).toBe('$3.50')
    expect(usd(0)).toBe('$0.00')
  })

  it('huFrom / huArticle', () => {
    expect([0, 5, 10, 30, 32, 100, 1000, 1_000_000].map(huFrom))
      .toEqual(['0-ból', '5-ből', '10-ből', '30-ból', '32-ből', '100-ból', '1000-ből', '1000000-ból'])
    expect([0, 1, 5, 10, 32, 50, 500, 1000, 2000, 1_000_000].map(huArticle))
      .toEqual(['a', 'az', 'az', 'a', 'a', 'az', 'az', 'az', 'a', 'az'])
  })
})

describe('Hungarian text helpers (characterization)', () => {
  it('article', () => {
    expect(article('alma')).toBe('az')
    expect(article('körte')).toBe('a')
    expect(article('Ágnes', true)).toBe('Az')
    expect(article('kenyér', true)).toBe('A')
  })

  it('azA', () => {
    expect([1, 5, 10, 52, 100, 1000, 100000, 1_000_000].map((n) => azA(n))).toEqual(['az', 'az', 'a', 'az', 'a', 'az', 'a', 'az'])
    expect(azA(1, true)).toBe('Az')
    expect(azA(7, true)).toBe('A')
  })

  it('outOf', () => {
    expect([0, 2, 3, 5, 12, 20, 40, 100, 1000, 1_000_000].map(outOf))
      .toEqual(['0-ból', '2-ből', '3-ból', '5-ből', '12-ből', '20-ból', '40-ből', '100-ból', '1000-ből', '1000000-ból'])
  })

  it('sentenceCase', () => {
    expect(sentenceCase('FUTÁS')).toBe('Futás')
    expect(sentenceCase('Most')).toBe('Most')
    expect(sentenceCase('TRX')).toBe('TRX')
  })
})
