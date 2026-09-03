import { describe, expect, test } from 'vitest'
import { DAY_STATE_COPY, DAY_STATE_LABEL, dayScoreState, isDayUnlogged } from '@/features/me/logic/dayScoreState'
import type { MeWeekDay } from '@/data/me/meWeek'

const EMPTY: MeWeekDay = {
  date: '2026-05-20', score: null,
  subscores: { sleep: null, fuel: null, checkin: null, activity: null },
  kcal: null, proteinG: null, carbsG: null, fatG: null, kcalTarget: 3000, proteinTargetG: 200,
  weightKg: null, sleepMin: null, sleepQuality: null,
  checkinCount: 0, checkinEnergyAvg: null, workoutCount: 0, xp: null,
}

const day = (over: Partial<MeWeekDay>): MeWeekDay => ({ ...EMPTY, ...over })

describe('dayScoreState — the honest-state split (handoff §4)', () => {
  test('a scored day is "scored"', () => {
    expect(dayScoreState(day({ score: 78 }), '2026-05-25')).toBe('scored')
  })

  test('a day with SOME logs but no score is "learning" (tanulom), not "nincs adat"', () => {
    // Csütörtök in the seed week: two check-ins, one sub-score, no score.
    const sparse = day({ subscores: { sleep: null, fuel: null, checkin: 65, activity: null }, checkinCount: 2, xp: 20 })
    expect(dayScoreState(sparse, '2026-05-25')).toBe('learning')
  })

  test('a day with NOTHING logged is "nodata" — a different state, not tanulom', () => {
    expect(dayScoreState(EMPTY, '2026-05-25')).toBe('nodata')
    expect(isDayUnlogged(EMPTY)).toBe(true)
  })

  test('a single workout with no other log still counts as logged', () => {
    expect(dayScoreState(day({ workoutCount: 1 }), '2026-05-25')).toBe('learning')
  })

  test('a day after today is "future" regardless of what it carries', () => {
    expect(dayScoreState(day({ date: '2026-05-30' }), '2026-05-25')).toBe('future')
  })

  test('today itself is never "future"', () => {
    expect(dayScoreState(day({ date: '2026-05-25' }), '2026-05-25')).toBe('nodata')
  })

  test('the four states carry their contract copy verbatim', () => {
    expect(DAY_STATE_LABEL.learning).toBe('tanulom')
    expect(DAY_STATE_LABEL.nodata).toBe('nincs adat')
    expect(DAY_STATE_COPY.learning)
      .toBe('Kettőnél kevesebb területről van adat, ezért a Mezo nem ad pontszámot: kitalálni nem fog.')
    expect(DAY_STATE_COPY.nodata).toBe('ezen a napon nem logoltál — a hét pontszámába nem számít bele')
    expect(DAY_STATE_COPY.future).toBe('még előtted — ide majd a nap adatai jönnek')
  })
})
