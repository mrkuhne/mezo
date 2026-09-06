import { describe, expect, test, vi, beforeEach } from 'vitest'
import { toFormation, habitApi } from '@/data/habit/habitApi'
import { MOCK_FORMATION_KEYS, mockHabitFormation } from '@/data/habit/habitMock'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/data/_client/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a), ApiError: class extends Error {} }))

beforeEach(() => apiFetch.mockReset())

const WIRE_MINIMAL = {
  key: 'morning_sunlight',
  reps: 0,
  missed: 0,
  thresholdPct: 90,
  minReps: 10,
  days: [],
}

describe('toFormation — null-normalisation', () => {
  test('every absent estimate field becomes an EXPLICIT null, never undefined', () => {
    const f = toFormation(WIRE_MINIMAL)
    // A „nincs még becslés" ág egyetlen értékkel írható le a hívó oldalon; egy `undefined`
    // mező átcsúszna egy `?? default`-on és kitalált számot rajzolna a görbére.
    for (const field of [
      'firstDate', 'automaticityPct', 'curveK', 'repsToThresholdLo', 'repsToThresholdHi',
      'weeksToThresholdLo', 'weeksToThresholdHi', 'repsPerWeek', 'consistencyPct',
      'timeConstancyPct', 'anchorConstancyPct',
    ] as const) {
      expect(f[field], field).toBeNull()
      expect(Object.hasOwn(f, field), `${field} jelen van`).toBe(true)
    }
    expect(f.thresholdPct).toBe(90)
    expect(f.minReps).toBe(10)
    expect(f.days).toEqual([])
  })

  test('an explicit wire null stays null and real values pass through', () => {
    const f = toFormation({
      ...WIRE_MINIMAL,
      firstDate: '2026-01-04',
      reps: 48, missed: 12,
      automaticityPct: 63, curveK: 0.020714,
      repsToThresholdLo: 86, repsToThresholdHi: 159,
      weeksToThresholdLo: 6.9, weeksToThresholdHi: 20.2,
      repsPerWeek: 5.5, consistencyPct: 71,
      timeConstancyPct: null, anchorConstancyPct: 74,
      days: [{ date: '2026-01-04', status: 'done' as const }, { date: '2026-01-05', status: 'missed' as const }],
    })
    expect(f.firstDate).toBe('2026-01-04')
    expect(f.automaticityPct).toBe(63)
    expect(f.timeConstancyPct).toBeNull()
    expect(f.anchorConstancyPct).toBe(74)
    expect(f.days).toHaveLength(2)
    expect(f.days[1].status).toBe('missed')
  })
})

describe('habitApi.formation', () => {
  test('hits the contract path with the key encoded', async () => {
    apiFetch.mockResolvedValue(WIRE_MINIMAL)
    await habitApi.formation('morning sunlight/1')
    expect(apiFetch.mock.calls[0][0]).toBe('/api/habit/formation/morning%20sunlight%2F1')
  })
})

describe('mockHabitFormation — a fixtúra belülről konzisztens', () => {
  const KEYS = [...MOCK_FORMATION_KEYS, 'morning_pushups', 'kitchen_close', 'protein_breakfast']

  test.each(KEYS)('%s: days[] számai megegyeznek reps/missed-del', (key) => {
    const f = mockHabitFormation(key)
    expect(f.days.filter((d) => d.status === 'done')).toHaveLength(f.reps)
    expect(f.days.filter((d) => d.status === 'missed')).toHaveLength(f.missed)
    expect(f.firstDate).toBe(f.days[0].date)
    // szigorúan növekvő dátumok, hézagokkal (a soha ki nem nyitott napoknak nincs soruk)
    const dates = f.days.map((d) => d.date)
    expect([...dates].sort()).toEqual(dates)
    expect(new Set(dates).size).toBe(dates.length)
  })

  test.each(KEYS)('%s: automaticityPct = round(100*(1-e^(-k*reps))) vagy mind null', (key) => {
    const f = mockHabitFormation(key)
    if (f.reps < f.minReps) {
      // Az őszinteség-szabály: nem kis szám, hanem SEMMI.
      expect([
        f.automaticityPct, f.curveK, f.repsToThresholdLo, f.repsToThresholdHi,
        f.weeksToThresholdLo, f.weeksToThresholdHi, f.repsPerWeek, f.consistencyPct,
      ]).toEqual([null, null, null, null, null, null, null, null])
      return
    }
    expect(f.curveK).not.toBeNull()
    expect(f.automaticityPct).toBe(Math.round(100 * (1 - Math.exp(-(f.curveK as number) * f.reps))))
    // a sáv rendezett, és a küszöb-ismétlésszám tényleg a küszöbre visz
    expect(f.repsToThresholdLo as number).toBeLessThanOrEqual(f.repsToThresholdHi as number)
    expect(f.weeksToThresholdLo as number).toBeLessThanOrEqual(f.weeksToThresholdHi as number)
    expect(100 * (1 - Math.exp(-(f.curveK as number) * (f.repsToThresholdHi as number))))
      .toBeGreaterThanOrEqual(f.thresholdPct)
  })

  test('van a görbén jól előrehaladott szokás ÉS őszinte null-állapotú is — mindkét ág demózható', () => {
    const along = mockHabitFormation('morning_sunlight')
    expect(along.reps).toBeGreaterThanOrEqual(along.minReps)
    // A konkrét szám a modellből ESIK KI (k = kBase·(0,6+0,4·konzisztencia)·(0,7+0,5·kontextus)),
    // nem seed-konstans — ezért a viszonyt rögzítjük, nem egy varázsszámot.
    expect(along.automaticityPct).toBe(
      Math.round(100 * (1 - Math.exp(-(along.curveK as number) * along.reps))),
    )
    expect(along.automaticityPct as number).toBeGreaterThan(50)
    expect(along.automaticityPct as number).toBeLessThan(along.thresholdPct)
    expect(along.weeksToThresholdHi as number).toBeGreaterThan(along.weeksToThresholdLo as number)

    const early = mockHabitFormation('wind_down')
    expect(early.reps).toBeLessThan(early.minReps)
    expect(early.automaticityPct).toBeNull()
    expect(early.minReps).toBe(5) // mezo.habit.formation.min-reps — ebből mondja meg a FE, hány kell még
    expect(early.days.length).toBeGreaterThan(0)
  })

  test('determinisztikus — ugyanaz a kulcs kétszer ugyanazt adja (vizuális baseline)', () => {
    expect(mockHabitFormation('wake_on_time')).toEqual(mockHabitFormation('wake_on_time'))
  })

  test('jelzés nélküli kontextus null marad — sosem kitalált szám', () => {
    expect(mockHabitFormation('wake_on_time').anchorConstancyPct).toBeNull()
  })
})
