import { describe, expect, test } from 'vitest'
import { dayReading, nextBestAction, isNapzarasCardWindow, isMorningMode, markSeen, seenKey } from '@/features/today/logic/napom'
import { mockDayEvaluation, normalizeDayEvaluation, type NormalizedDayEvaluation } from '@/data/me/dayEvaluation'
import type { MeWeekDay } from '@/data/me/meWeek'

/** Returns a copy of `ev` with one dimension's fields patched (matched by `id`). */
function withDim(
  ev: NormalizedDayEvaluation,
  id: string,
  patch: Partial<NormalizedDayEvaluation['dimensions'][number]>,
): NormalizedDayEvaluation {
  return { ...ev, dimensions: ev.dimensions.map((d) => (d.id === id ? { ...d, ...patch } : d)) }
}

const baseDay: MeWeekDay = {
  date: '2026-05-21',
  score: null,
  subscores: { nutrition: null, quality: null, training: null, sleep: null, logging: null, rhythm: null },
  kcal: null, proteinG: null, carbsG: null, fatG: null,
  kcalTarget: 3100, proteinTargetG: 166,
  weightKg: null,
  sleepMin: null, sleepQuality: null,
  checkinCount: 0, checkinEnergyAvg: null,
  workoutCount: 0, xp: null,
}

// `mockDayEvaluation('2026-05-21')` is the in_progress fixture — training already DONE there,
// so the "training still open" cases patch the training dimension to IN_PROGRESS explicitly.
const inProgressEv = normalizeDayEvaluation(mockDayEvaluation('2026-05-21'))
const trainingOpenEv = withDim(inProgressEv, 'training', { status: 'IN_PROGRESS', score: null })

describe('dayReading', () => {
  test('protein gap + workout still open', () => {
    const ev = trainingOpenEv
    const day = { ...baseDay, proteinG: 148, proteinTargetG: 166, kcal: 2000 }
    expect(dayReading(ev, day)).toBe('Fehérjéből már csak 18 g hiányzik, az edzés még hátravan.')
  })

  test('protein met, workout open', () => {
    const ev = trainingOpenEv
    const day = { ...baseDay, proteinG: 170, proteinTargetG: 166, kcal: 2000 }
    expect(dayReading(ev, day)).toBe('A tányér rendben van, már csak az edzés maradt a mai napból.')
  })

  test('workout done, check-ins missing', () => {
    const evTrainingDone = withDim(inProgressEv, 'training', { status: 'DONE', score: 85 })
    const day = { ...baseDay, checkinCount: 2, kcal: 2000 }
    expect(dayReading(evTrainingDone, day)).toBe('Az edzés megvolt. Egy esti check-in, és kerek a nap.')
  })

  test('everything in place', () => {
    const evAllDone = withDim(inProgressEv, 'training', { status: 'DONE', score: 85 })
    const day = { ...baseDay, checkinCount: 4, kcal: 2000 }
    expect(dayReading(evAllDone, day)).toBe('Minden a helyén. Ma este nyugodtan zárhatod a napot.')
  })

  test('nothing logged yet', () => {
    const evEmptyToday = inProgressEv
    expect(dayReading(evEmptyToday, null)).toBe('Még üres a napod. Az első beírással elindul.')
  })
})

describe('nextBestAction', () => {
  const ev = trainingOpenEv
  const day = { ...baseDay, proteinG: 148, proteinTargetG: 166, kcal: 2000 }

  test('evening → napzárás first', () => {
    expect(nextBestAction(ev, day, new Date(2026, 8, 24, 20, 5))?.kind).toBe('napzaras')
  })

  test('afternoon with open training → workout', () => {
    expect(nextBestAction(ev, day, new Date(2026, 8, 24, 14, 0))?.kind).toBe('workout')
  })

  test('training done, check-ins missing → checkin', () => {
    const evTrainingDone = withDim(inProgressEv, 'training', { status: 'DONE', score: 85 })
    expect(nextBestAction(evTrainingDone, { ...day, checkinCount: 2 }, new Date(2026, 8, 24, 14, 0))?.kind).toBe(
      'checkin',
    )
  })

  test('nothing to suggest → null', () => {
    const evAllDone = withDim(inProgressEv, 'training', { status: 'DONE', score: 85 })
    expect(nextBestAction(evAllDone, { ...day, checkinCount: 4 }, new Date(2026, 8, 24, 14, 0))).toBeNull()
  })
})

describe('isNapzarasCardWindow', () => {
  test.each([
    [19, 59, false, false],
    [20, 0, false, true],
    [23, 30, false, true],
    [2, 0, false, true],
    [4, 59, false, true],
    [5, 0, false, false],
    [21, 0, true, false],
  ])('%i:%i closed=%s → %s', (h, m, closed, want) => {
    expect(isNapzarasCardWindow(new Date(2026, 8, 24, h, m), closed)).toBe(want)
  })
})

describe('morning mode', () => {
  const scoredYesterday: NormalizedDayEvaluation = normalizeDayEvaluation(mockDayEvaluation('2026-05-18'))

  test('scored yesterday with a review, unseen → on; after markSeen → off', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
    }
    expect(isMorningMode(scoredYesterday, storage)).toBe(true)
    markSeen(scoredYesterday.date, storage)
    expect(store.get(seenKey(scoredYesterday.date))).toBe('1')
    expect(isMorningMode(scoredYesterday, storage)).toBe(false)
  })

  test('no reviewId or not scored → off', () => {
    expect(isMorningMode({ ...scoredYesterday, reviewId: null }, null)).toBe(false)
    expect(isMorningMode({ ...scoredYesterday, state: 'thin' }, null)).toBe(false)
  })

  test('a throwing storage never breaks the page', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked')
      },
    }
    expect(isMorningMode(scoredYesterday, bad)).toBe(true)
  })
})
