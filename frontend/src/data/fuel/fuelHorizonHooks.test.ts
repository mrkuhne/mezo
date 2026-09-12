// A hosszabb táv adat-összeállításának tesztjei (Fuel Titanium S3, mezo-83g0 — C3).
import { expect, test } from 'vitest'
import { HORIZON_WEEKS, horizonMondays, weeklyWeightAverages } from '@/data/fuel/fuelHorizonHooks'

test('a horizont hétfői legöregebbtől a legfrissebbig futnak, a megnyitott hetet beleértve', () => {
  const mondays = horizonMondays('2026-09-07')
  expect(mondays).toHaveLength(HORIZON_WEEKS)
  expect(mondays[mondays.length - 1]).toBe('2026-09-07')
  expect(mondays[0]).toBe('2026-07-27')
})

test('a súlynapló heti átlagai ISO hétfő szerint állnak össze', () => {
  const avgs = weeklyWeightAverages([
    { date: '2026-09-07', value: 81.0 },
    { date: '2026-09-09', value: 81.6 },
    { date: '2026-09-14', value: 80.8 },
  ])
  expect(avgs['2026-09-07']).toBeCloseTo(81.3, 6)
  expect(avgs['2026-09-14']).toBeCloseTo(80.8, 6)
})

// Őszinte-null: a mérés nélküli hét nem nulla súly — egyáltalán nincs kulcsa.
test('a mérés nélküli hétnek nincs kulcsa, nem nulla értéke', () => {
  const avgs = weeklyWeightAverages([{ date: '2026-09-07', value: 81.0 }])
  expect('2026-08-31' in avgs).toBe(false)
  expect(avgs['2026-08-31']).toBeUndefined()
})

test('üres napló üres térkép, nem nullákkal kitöltött hetek', () => {
  expect(weeklyWeightAverages([])).toEqual({})
})

// A vasárnapi mérés az ELŐZŐ hétfőhöz tartozik (a ház `mondayOf`-ja).
test('a vasárnapi mérés az őt tartalmazó hét hétfőjéhez esik', () => {
  expect(Object.keys(weeklyWeightAverages([{ date: '2026-09-13', value: 81.0 }]))).toEqual(['2026-09-07'])
})
