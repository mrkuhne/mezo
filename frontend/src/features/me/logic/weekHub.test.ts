// The honest-state contract table (handoff §4) as executable rules — everything the Heti
// hub decides lives in `weekHub.ts`, so the contracts are pinned here without rendering.
import { describe, expect, test } from 'vitest'
import {
  analysisSnippet, dayHasAnyLog, weekHubState, DAY_STATE_COPY, discoverySummary, firstSentence,
  generationStamp, huDec, loggedDayCount, subscoreCount, resolveWeekStart, weekPhase,
  weekStatCells, weekSubline,
} from '@/features/me/logic/weekHub'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import type { MeWeekAggregates, MeWeekDay } from '@/data/me/meWeek'
import type { WeeklyReview } from '@/data/me/weeklyReviewHooks'

const BLANK: MeWeekDay = {
  date: '2026-05-18', score: null,
  subscores: { nutrition: null, quality: null, training: null, sleep: null, logging: null, rhythm: null },
  kcal: null, proteinG: null, carbsG: null, fatG: null, kcalTarget: null, proteinTargetG: null,
  weightKg: null, sleepMin: null, sleepQuality: null, checkinCount: 0, checkinEnergyAvg: null,
  workoutCount: 0, xp: null,
}
const day = (over: Partial<MeWeekDay>): MeWeekDay => ({ ...BLANK, ...over })

describe('resolveWeekStart', () => {
  test('keeps a real ISO Monday and falls back to the current week otherwise', () => {
    expect(resolveWeekStart('2026-05-18')).toBe('2026-05-18') // a Monday
    expect(resolveWeekStart('2026-05-19')).toBe(mondayIso())  // a Tuesday
    expect(resolveWeekStart('2026-02-30')).toBe(mondayIso())  // not a real date
    expect(resolveWeekStart('nope')).toBe(mondayIso())
    expect(resolveWeekStart(null)).toBe(mondayIso())
  })
})

describe('a day with fewer than 2 sub-scores is „tanulom", a day with nothing logged is „nincs adat"', () => {
  const today = '2026-05-24'

  test('nothing logged at all → empty (a DIFFERENT state, not thin) — same states the mosaic uses', () => {
    const d = day({ date: '2026-05-23' })
    expect(dayHasAnyLog(d)).toBe(false)
    expect(weekHubState(d, today)).toBe('empty')
    expect(DAY_STATE_COPY.empty).toBe('ezen a napon nem logoltál — a hét pontszámába nem számít bele')
  })

  test('something logged but only one measured area → thin („tanulom")', () => {
    const d = day({ date: '2026-05-21', subscores: { nutrition: null, quality: null, training: null, sleep: null, logging: 65, rhythm: null }, checkinCount: 2, xp: 20 })
    expect(subscoreCount(d)).toBe(1)
    expect(dayHasAnyLog(d)).toBe(true)
    expect(weekHubState(d, today)).toBe('thin')
    expect(DAY_STATE_COPY.thin)
      .toBe('Kettőnél kevesebb területről van adat, ezért a Mezo nem ad pontszámot: kitalálni nem fog.')
  })

  test('a scored day is scored, and a day after today is future', () => {
    expect(weekHubState(day({ date: '2026-05-20', score: 85, subscores: { nutrition: 82, quality: 85, training: 90, sleep: 90, logging: 80, rhythm: 88 } }), today)).toBe('scored')
    expect(weekHubState(day({ date: '2026-05-25' }), today)).toBe('future')
    expect(DAY_STATE_COPY.future).toBe('még előtted — ide majd a nap adatai jönnek')
  })

  test('a workout or an XP grant alone still counts as "logged"', () => {
    expect(dayHasAnyLog(day({ workoutCount: 1 }))).toBe(true)
    expect(dayHasAnyLog(day({ xp: 15 }))).toBe(true)
    expect(dayHasAnyLog(day({ xp: 0, checkinCount: 0 }))).toBe(false)
  })

  test('loggedDayCount counts only days that really carry a score', () => {
    expect(loggedDayCount([day({ score: 78 }), day({ score: null }), day({ score: 61 })])).toBe(2)
  })
})

describe('week phase + hero sub-line are derived, never hardcoded', () => {
  const monday = '2026-05-18'
  test('phase', () => {
    expect(weekPhase('2026-05-11', monday)).toBe('closed')
    expect(weekPhase(monday, monday)).toBe('running')
    expect(weekPhase('2026-05-25', monday)).toBe('future')
  })

  test('a closed week without a review does NOT claim „a Mezo elemzésével"', () => {
    expect(weekSubline('closed', true, 78)).toBe('lezárt hét · a Mezo elemzésével')
    expect(weekSubline('closed', false, 78)).toBe('lezárt hét · elemzés nélkül')
    expect(weekSubline('running', false, 75)).toBe('ez a hét · még fut')
  })

  test('a week with fewer than 2 measured days gets the contract sentence instead', () => {
    expect(weekSubline('closed', true, null)).toBe('még gyűjtöm az adatokat a heti értékeléshez')
    expect(weekSubline('running', false, null)).toBe('még gyűjtöm az adatokat a heti értékeléshez')
  })

  test('a future week says so', () => {
    expect(weekSubline('future', false, null)).toBe('még előtted')
  })
})

describe('the analysis tile', () => {
  const review = (over: Partial<WeeklyReview> = {}): WeeklyReview => ({
    id: 'r1', weekStart: '2026-05-18', summary: 'Erős hét volt. A második mondat.',
    dayNotes: [], highlights: [], generatedAt: '2026-05-25T06:15:00', stale: false, ...over,
  })

  test('shows only the first sentence', () => {
    expect(firstSentence('Erős hét volt. A második mondat.')).toBe('Erős hét volt.')
    expect(firstSentence('Egyetlen mondat pont nélkül')).toBe('Egyetlen mondat pont nélkül')
    expect(analysisSnippet(review(), 'closed')).toBe('Erős hét volt.')
  })

  test('a RUNNING week with no review gets the ghost', () => {
    expect(analysisSnippet(null, 'running'))
      .toContain('Hétfő reggel érkezik — a Mezo a lezárt hét adataiból írja meg.')
  })

  test('a CLOSED week with no review gets a DIFFERENT text — the old bug was reusing the ghost', () => {
    const closed = analysisSnippet(null, 'closed')
    expect(closed).toBe('Ez a hét lezárt, de nem készült elemzés — a hét adatai megvannak, bármikor pótolható.')
    expect(closed).not.toContain('Hétfő reggel érkezik')
  })

  test('the generation stamp: a real timestamp, „hétfőn jön" while running, „nincs még" when closed', () => {
    expect(generationStamp(review(), 'closed')).toEqual({ text: 'hétfő 06:15', tone: 'lav' })
    expect(generationStamp(null, 'running')).toEqual({ text: 'hétfőn jön', tone: 'warn' })
    expect(generationStamp(null, 'closed')).toEqual({ text: 'nincs még', tone: 'warn' })
  })
})

describe('discoverySummary', () => {
  test('counts every kind, memoir included, and orders the dots as the prototype does', () => {
    const s = discoverySummary({
      patterns: [{ pairKey: 'p', title: 'P', event: 'confirmed' }],
      newFacts: [{ id: 'f', text: 'F' }],
      lifeEvents: [{ id: 'l', title: 'L', occurredOn: '2026-05-23' }],
      memoir: true,
      predictions: [{ id: 'x', title: 'X', status: 'pending' }],
    })
    expect(s.count).toBe(5)
    expect(s.parts).toEqual(['1 minta', '1 új tudás', '1 életesemény', 'memoár', '1 előrejelzés'])
    expect(s.dots).toEqual(['pattern', 'fact', 'life', 'memoir', 'prediction'])
  })

  test('an empty (or absent) digest is a quiet week, not a zero', () => {
    expect(discoverySummary(null).count).toBe(0)
    expect(discoverySummary(null).parts).toEqual([])
  })
})

describe('the eight mini-cells', () => {
  const full: MeWeekAggregates = {
    score: 78, prevWeekScore: 74, avgKcal: 3004, avgProteinG: 212, avgSleepMin: 439,
    avgCheckinEnergy: 7, checkinRatio: 0.75, latestWeightKg: 83.9, weightWeeklyRateKg: -0.3, totalXp: 585,
  }

  test('render the prototype order, including the two the old UI threw away', () => {
    const cells = weekStatCells(full)
    expect(cells.map((c) => c.label)).toEqual(
      ['Kcal átlag', 'Fehérje', 'Alvás', 'Check-in', 'Energia', 'Súly', 'Súly-trend', 'XP'],
    )
    expect(cells.map((c) => c.value)).toEqual(
      ['3 004', '212', '7ó 19p', '75', '7,0', '83,9', '−0,30', '585'],
    )
    expect(cells[4].unit).toBe('/ 10')
    expect(cells[6].unit).toBe('kg/hét')
  })

  test('missing data is „—" and NEVER a 0 — for every cell', () => {
    const empty: MeWeekAggregates = {
      score: null, prevWeekScore: null, avgKcal: null, avgProteinG: null, avgSleepMin: null,
      avgCheckinEnergy: null, checkinRatio: null, latestWeightKg: null, weightWeeklyRateKg: null, totalXp: null,
    }
    const cells = weekStatCells(empty)
    expect(cells.map((c) => c.value)).toEqual(['—', '—', '—', '—', '—', '—', '—', '—'])
    expect(cells.every((c) => c.unit === null)).toBe(true)
  })

  test('a real zero is still shown as a zero (— means unknown, not empty)', () => {
    expect(weekStatCells({ ...full, totalXp: 0 })[7].value).toBe('0')
  })

  test('huDec keeps the trailing decimal and uses the Unicode minus', () => {
    expect(huDec(7)).toBe('7,0')
    expect(huDec(-0.3, 2)).toBe('−0,30')
  })
})
