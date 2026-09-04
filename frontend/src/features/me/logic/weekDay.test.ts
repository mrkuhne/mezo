import { describe, expect, test } from 'vitest'
import {
  DAY_DIMENSIONS, dayNoteFor, dayState, dayVerdict, doneDimensionCount, fmtSleep, hu1, huDowFull,
  huDowShort, huInt, isEmptyDay, isInWeek, isValidIsoDate, mondayOf, ringLearningLabels,
  subscoreCount, summariseDays, tileScoreLabel,
} from '@/features/me/logic/weekDay'
import type { MeWeekDay } from '@/data/me/meWeek'

// Heti nap-állapotok (mezo-d20.6.10) — handoff §4's honest-state contracts as unit tests.
// The point of this module is that `tanulom` and `nincs adat` are DIFFERENT states; today's
// WeekDayCard renders a single `—` for both.

function day(over: Partial<MeWeekDay> = {}): MeWeekDay {
  return {
    date: '2026-05-20', score: null,
    subscores: { nutrition: null, quality: null, training: null, sleep: null, logging: null, rhythm: null },
    kcal: null, proteinG: null, carbsG: null, fatG: null, kcalTarget: 3000, proteinTargetG: 200,
    weightKg: null, sleepMin: null, sleepQuality: null,
    checkinCount: 0, checkinEnergyAvg: null, workoutCount: 0, xp: null,
    ...over,
  }
}

const TODAY = '2026-05-22'

describe('dayState — the four honest states (handoff §4)', () => {
  test('a scored day is `scored`', () => {
    expect(dayState(day({ score: 78, subscores: { nutrition: 70, quality: null, training: null, sleep: 80, logging: null, rhythm: null } }), TODAY))
      .toBe('scored')
  })

  test('a day with ONE sub-score and no score is `thin`, not `empty`', () => {
    const d = day({ subscores: { nutrition: null, quality: null, training: null, sleep: null, logging: 65, rhythm: null }, checkinCount: 2, xp: 20 })
    expect(subscoreCount(d)).toBe(1)
    expect(dayState(d, TODAY)).toBe('thin')
    expect(isEmptyDay(d)).toBe(false)
    expect(tileScoreLabel('thin')).toBe('tanulom')
  })

  test('a day with NOTHING logged is `empty`, a different state from `thin`', () => {
    const d = day()
    expect(dayState(d, TODAY)).toBe('empty')
    expect(isEmptyDay(d)).toBe(true)
    expect(tileScoreLabel('empty')).toBe('nincs adat')
  })

  test('a logged weight alone still counts as a log (not `empty`)', () => {
    expect(dayState(day({ weightKg: 84.1 }), TODAY)).toBe('thin')
  })

  test('a date after today is `future`, whatever it carries', () => {
    expect(dayState(day({ date: '2026-05-23' }), TODAY)).toBe('future')
    expect(dayState(day({ date: '2026-05-23', score: 90 }), TODAY)).toBe('future')
  })

  test('the ring words separate `nincs / adat` from `tanulom / még gyűlik`', () => {
    expect(ringLearningLabels('empty')).toEqual({ label: 'nincs', caption: 'adat' })
    expect(ringLearningLabels('thin')).toEqual({ label: 'tanulom', caption: 'még gyűlik' })
  })
})

describe('summariseDays', () => {
  const days = [
    day({ date: '2026-05-18', score: 78, subscores: { nutrition: 75, quality: 79, training: 88, sleep: 82, logging: 74, rhythm: 80 } }),
    day({ date: '2026-05-19', score: 85, subscores: { nutrition: 82, quality: 85, training: 90, sleep: 90, logging: 80, rhythm: 88 } }),
    day({ date: '2026-05-20', subscores: { nutrition: null, quality: null, training: null, sleep: null, logging: 65, rhythm: null }, checkinCount: 2 }),
    day({ date: '2026-05-21' }),
    day({ date: '2026-05-24' }), // future
  ]

  test('counts only MEASURED days and never lets a future day into the tally', () => {
    const s = summariseDays(days, '2026-05-22')
    expect(s.measured).toBe(2)
    expect(s.learning).toBe(2)
    expect(s.best?.date).toBe('2026-05-19')
    expect(s.worst?.date).toBe('2026-05-18')
  })

  test('an all-unscored week yields no best/worst rather than a fabricated 0', () => {
    const s = summariseDays([day({ date: '2026-05-18' })], '2026-05-22')
    expect(s.measured).toBe(0)
    expect(s.best).toBeNull()
    expect(s.worst).toBeNull()
  })
})

describe('dayVerdict', () => {
  const days = [
    day({ date: '2026-05-18', score: 78, subscores: { nutrition: 75, quality: 79, training: 88, sleep: 82, logging: 74, rhythm: 80 } }),
    day({ date: '2026-05-19', score: 85, subscores: { nutrition: 82, quality: 85, training: 90, sleep: 90, logging: 80, rhythm: 88 } }),
  ]
  test('names the best day, and hedges for the rest', () => {
    expect(dayVerdict(days[1], days, '2026-05-22')).toBe('a hét legjobb napja')
    expect(dayVerdict(days[0], days, '2026-05-22')).toBe('a hét egyik napja')
  })
  test('unscored and future days get their own line, never a score sentence', () => {
    expect(dayVerdict(day({ date: '2026-05-20', checkinCount: 1 }), days, '2026-05-22')).toBe('kevés adat a pontszámhoz')
    expect(dayVerdict(day({ date: '2026-05-20' }), days, '2026-05-22')).toBe('ezen a napon nem logoltál')
    expect(dayVerdict(day({ date: '2026-05-30' }), days, '2026-05-22')).toBe('még előtted')
  })
})

describe('dayNoteFor', () => {
  const review = {
    id: 'r', weekStart: '2026-05-18', summary: 's', highlights: [], generatedAt: '', stale: false,
    dayNotes: [{ date: '2026-05-20', note: 'Szerdai jegyzet.' }],
  } as never

  test('returns the note only for the exact day', () => {
    expect(dayNoteFor(review, '2026-05-20')).toBe('Szerdai jegyzet.')
    expect(dayNoteFor(review, '2026-05-21')).toBeNull()
    expect(dayNoteFor(null, '2026-05-20')).toBeNull()
  })
})

describe(':date route param', () => {
  test('rejects malformed and impossible dates', () => {
    expect(isValidIsoDate('2026-05-20')).toBe(true)
    expect(isValidIsoDate('2026-02-31')).toBe(false)
    expect(isValidIsoDate('nem-datum')).toBe(false)
    expect(isValidIsoDate('20260520')).toBe(false)
    expect(isValidIsoDate(undefined)).toBe(false)
  })

  test('mondayOf derives the week from the day alone (Monday maps to itself)', () => {
    expect(mondayOf('2026-05-20')).toBe('2026-05-18') // Wednesday
    expect(mondayOf('2026-05-24')).toBe('2026-05-18') // Sunday
    expect(mondayOf('2026-05-18')).toBe('2026-05-18')
  })

  test('isInWeek rejects a `?start=` from another week', () => {
    expect(isInWeek('2026-05-20', '2026-05-18')).toBe(true)
    expect(isInWeek('2026-05-24', '2026-05-18')).toBe(true)
    expect(isInWeek('2026-05-25', '2026-05-18')).toBe(false)
    expect(isInWeek('2026-05-17', '2026-05-18')).toBe(false)
  })
})

describe('a heti mozaik hat sub-jelet rajzol (mezo-jcpt.5)', () => {
  test('a hat dimenzió a config-súly sorrendjében, csoportokkal', () => {
    expect(DAY_DIMENSIONS.map((s) => s.key))
      .toEqual(['nutrition', 'quality', 'training', 'sleep', 'logging', 'rhythm'])
    expect(DAY_DIMENSIONS.map((s) => s.group))
      .toEqual(['do', 'do', 'do', 'be', 'be', 'be'])
  })

  test('a barClass az is-<key> minta, hogy a nap-oldal és a heti csempe EGY szemantikát osszon', () => {
    expect(DAY_DIMENSIONS.map((s) => s.barClass))
      .toEqual(['is-nutrition', 'is-quality', 'is-training', 'is-sleep', 'is-logging', 'is-rhythm'])
  })

  test('doneDimensionCount counts only DONE dimensions, never NO_DATA/IN_PROGRESS', () => {
    const dims = [
      { status: 'DONE' }, { status: 'DONE' }, { status: 'IN_PROGRESS' }, { status: 'NO_DATA' },
    ]
    expect(doneDimensionCount(dims)).toBe(2)
    expect(doneDimensionCount([])).toBe(0)
  })
})

describe('formatting', () => {
  test('HU numerals', () => {
    expect(fmtSleep(445)).toBe('7ó 25p')
    expect(huInt(3004)).toBe('3 004')
    expect(hu1(83.9)).toBe('83,9')
    expect(hu1(-0.3)).toBe('−0,3')
  })
  test('weekday names come from the DATE, so Sze and Szo never collide', () => {
    expect(huDowShort('2026-05-20')).toBe('Sze')
    expect(huDowShort('2026-05-23')).toBe('Szo')
    expect(huDowFull('2026-05-20')).toBe('Szerda')
  })
})
