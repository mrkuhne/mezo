import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { prevMondayIso, weekEndIso, isoWeekNumber, inWeek, deriveWeekMetrics, deriveItems, deriveScore, trendOf, weightTrendOf, useWeekly } from '@/data/insights/weeklyHooks'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { weekly as mockWeekly, weeklySuggestion as mockSuggestion } from '@/data/insights/insights'
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

describe('useWeekly (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the seed verbatim with the demo delta label', () => {
    const { result } = renderHook(() => useWeekly(), { wrapper: makeHookWrapper() })
    expect(result.current.weekly).toEqual(mockWeekly)
    expect(result.current.deltaLabel).toBe('vs hét 20')
    expect(result.current.weeklySuggestion).toBe(mockSuggestion)
    expect(result.current.mode).toBe('mock')
  })
})

describe('useWeekly (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('composes the current week vs the previous week from the real reads', async () => {
    const start = mondayIso()
    const iso = (offset: number) => {
      const [y, m, d] = start.split('-').map(Number)
      const dd = new Date(y, m - 1, d + offset)
      return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
    }
    server.use(
      http.get(`${API_BASE}/api/biometrics/sleep`, () =>
        HttpResponse.json([
          { date: iso(0), bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 100, notes: null },
          { date: iso(1), bedtime: '23:00', wakeup: '06:30', duration: 6.9, quality: 6, awakenings: 1, mealToSleep: 100, notes: null },
          { date: iso(-7), bedtime: '23:00', wakeup: '06:30', duration: 8.0, quality: 9, awakenings: 0, mealToSleep: 100, notes: null },
        ])),
      http.get(`${API_BASE}/api/train/workouts`, ({ request }) => {
        const from = new URL(request.url).searchParams.get('from')
        return HttpResponse.json(from === start
          ? [{ id: '11111111-0000-4000-8000-000000000001', date: iso(0), status: 'completed' }]
          : [])
      }),
      http.get(`${API_BASE}/api/train/sport-sessions`, () =>
        HttpResponse.json([
          { id: '22222222-0000-4000-8000-000000000001', sport: 'volleyball', date: iso(1), time: '19:00', duration: 90, rpe: 7 },
          { id: '22222222-0000-4000-8000-000000000002', sport: 'volleyball', date: iso(-6), time: '19:00', duration: 90, rpe: 7 },
        ])),
      http.get(`${API_BASE}/api/biometrics/weight/trend`, () =>
        HttpResponse.json({ latestTrendKg: 96.4, weeklyRateKgPerWeek: -0.32, last4wRateKgPerWeek: -0.4 })),
    )
    const { result } = renderHook(() => useWeekly(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.weekly.score).not.toBeNull())

    expect(result.current.mode).toBe('live')
    expect(result.current.deltaLabel).toBe('vs előző hét')
    expect(result.current.weeklySuggestion).toBeNull()
    const byLabel = Object.fromEntries(result.current.weekly.items.map((i) => [i.label, i]))
    // default fuel-week MSW handler: 2 logged days, factor 2717.5/3100 → 88%, 1 protein hit
    expect(byLabel['Kcal pacing'].value).toBe('88% target')
    expect(byLabel['Fehérje-napok'].value).toBe('1/7')
    expect(byLabel['Alvás átlag'].value).toBe('7.2h · minőség 7.0')
    expect(byLabel['Súly trend']).toEqual({ label: 'Súly trend', value: '-0.32 kg/hét', trend: 'up' })
    // done: 1 gym + 1 volleyball this week; planned from the default schedule handlers
    expect(byLabel['Edzés'].value).toMatch(/^2\//)
    expect(result.current.weekly.title).toMatch(/^Hét \d+ áttekintés · /)
  })

  test('returns the tanulom null-state (score null, em-dash rows) when nothing is logged', async () => {
    server.use(
      http.get(`${API_BASE}/api/fuel/week/:start`, ({ params }) =>
        HttpResponse.json({ start: String(params.start), days: [] })),
      http.get(`${API_BASE}/api/biometrics/sleep`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/workouts`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/biometrics/weight/trend`, () =>
        HttpResponse.json({ latestTrendKg: 0, weeklyRateKgPerWeek: 0, last4wRateKgPerWeek: 0 })),
    )
    const { result } = renderHook(() => useWeekly(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.weekly.items.length).toBe(5))
    expect(result.current.weekly.score).toBeNull()
    expect(result.current.weekly.delta).toBeNull()
  })
})
