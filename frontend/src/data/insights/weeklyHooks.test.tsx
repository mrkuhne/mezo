import { prevMondayIso, weekEndIso, isoWeekNumber, inWeek, deriveWeekMetrics, deriveItems, deriveScore, trendOf, weightTrendOf } from '@/data/insights/weeklyHooks'
import type { FuelWeekDay } from '@/data/fuel/mealApi'
import type { SleepEntry } from '@/data/types'

const targets = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
const day = (date: string, kcal: number, p: number): FuelWeekDay =>
  ({ date, targets, consumed: { kcal, p, c: 0, f: 0, water: 0 } })
const sleep = (date: string, duration: number, quality: number): SleepEntry =>
  ({ date, bedtime: '23:00', wakeup: '06:30', duration, quality, awakenings: 1, mealToSleep: 100, notes: null })

test('week helpers: prev Monday, week end, ISO week number, membership', () => {
  expect(prevMondayIso('2026-06-29')).toBe('2026-06-22')
  expect(weekEndIso('2026-06-29')).toBe('2026-07-05')
  expect(isoWeekNumber('2026-06-29')).toBe(27)
  expect(inWeek('2026-06-29', '2026-06-29')).toBe(true)
  expect(inWeek('2026-07-05', '2026-06-29')).toBe(true)
  expect(inWeek('2026-07-06', '2026-06-29')).toBe(false)
  expect(inWeek('2026-06-28', '2026-06-29')).toBe(false)
})

test('deriveWeekMetrics: averages logged fuel days, protein hits, sleep avgs; null when unlogged', () => {
  const m = deriveWeekMetrics({
    fuelDays: [day('2026-06-29', 2800, 225), day('2026-06-30', 2635, 180)],
    sleepEntries: [sleep('2026-06-29', 7.5, 8), sleep('2026-06-30', 6.9, 6)],
    trainDone: 3, trainPlanned: 5,
  })
  expect(m.kcalFactor).toBeCloseTo(2717.5 / 3100, 4)
  expect(m.proteinHitDays).toBe(1)
  expect(m.sleepAvgH).toBeCloseTo(7.2, 4)
  expect(m.sleepQualityAvg).toBeCloseTo(7, 4)

  const empty = deriveWeekMetrics({ fuelDays: [day('2026-06-29', 0, 0)], sleepEntries: [], trainDone: null, trainPlanned: null })
  expect(empty.kcalFactor).toBeNull()
  expect(empty.proteinHitDays).toBeNull()
  expect(empty.sleepAvgH).toBeNull()
})

test('trendOf and weightTrendOf map deltas to arrows', () => {
  expect(trendOf(3, 2)).toBe('up')
  expect(trendOf(2, 3)).toBe('down')
  expect(trendOf(2, 2)).toBe('flat')
  expect(trendOf(7.25, 7.2, 0.1)).toBe('flat')
  expect(trendOf(null, 2)).toBe('flat')
  expect(weightTrendOf(-0.32)).toBe('up')     // goal-ward (cut): losing = good
  expect(weightTrendOf(0.05)).toBe('flat')
  expect(weightTrendOf(0.4)).toBe('down')
  expect(weightTrendOf(null)).toBe('flat')
})

test('deriveItems renders the five rows with honest em-dash for missing sources', () => {
  const cur = { kcalFactor: 0.94, proteinHitDays: 4, sleepAvgH: 7.2, sleepQualityAvg: 7.5, trainDone: 3, trainPlanned: 5 }
  const prev = { kcalFactor: 0.9, proteinHitDays: 5, sleepAvgH: 7.2, sleepQualityAvg: 7, trainDone: 2, trainPlanned: 5 }
  const items = deriveItems(cur, prev, -0.32)
  expect(items).toEqual([
    { label: 'Edzés', value: '3/5', trend: 'up' },
    { label: 'Alvás átlag', value: '7.2h · minőség 7.5', trend: 'flat' },
    { label: 'Kcal pacing', value: '94% target', trend: 'up' },
    { label: 'Fehérje-napok', value: '4/7', trend: 'down' },
    { label: 'Súly trend', value: '-0.32 kg/hét', trend: 'up' },
  ])

  const ghost = deriveItems(
    { kcalFactor: null, proteinHitDays: null, sleepAvgH: null, sleepQualityAvg: null, trainDone: null, trainPlanned: null },
    { kcalFactor: null, proteinHitDays: null, sleepAvgH: null, sleepQualityAvg: null, trainDone: null, trainPlanned: null },
    null,
  )
  expect(ghost.every((it) => it.value === '—' && it.trend === 'flat')).toBe(true)
})

test('deriveScore: mean of available sub-scores ×100; null when nothing is available', () => {
  expect(deriveScore({ kcalFactor: 1, proteinHitDays: 7, sleepAvgH: 8, sleepQualityAvg: 8, trainDone: 5, trainPlanned: 5 })).toBe(100)
  // kcal 1-0.06/0.25=0.76 · protein 4/7 · sleep 7.2/8=0.9 · train 3/5=0.6 → mean 0.7079 → 71
  expect(deriveScore({ kcalFactor: 0.94, proteinHitDays: 4, sleepAvgH: 7.2, sleepQualityAvg: 7.5, trainDone: 3, trainPlanned: 5 })).toBe(71)
  expect(deriveScore({ kcalFactor: 0.6, proteinHitDays: null, sleepAvgH: null, sleepQualityAvg: null, trainDone: null, trainPlanned: null })).toBe(0)
  expect(deriveScore({ kcalFactor: null, proteinHitDays: null, sleepAvgH: null, sleepQualityAvg: null, trainDone: 2, trainPlanned: 0 })).toBeNull()
})
