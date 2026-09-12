// A heti kép view-modelljének tesztjei (Fuel Titanium S3, mezo-83g0 — C1 · C5 · C6).
// Tiszta logika: se router, se QueryClient.
import { describe, expect, test } from 'vitest'
import { buildWeekView, loggedKcalAvg, weekDeltas, type WeekViewVM } from '@/features/fuel/logic/fuelWeekView'
import type { FuelWeekData, FuelWeekDay } from '@/data/fuel/mealApi'

const TARGET = { kcal: 2400, p: 160, c: 250, f: 75, water: 3000 }
const WEEKEND_TARGET = { kcal: 2200, p: 150, c: 230, f: 70, water: 3000 }
const ZERO = { kcal: 0, p: 0, c: 0, f: 0, water: 0 }

// 2026-09-07 hétfő → 09-12 szombat, 09-13 vasárnap.
const DATES = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']
const KCALS = [2115, 2260, 1180, 2210, 2050, 2740, 2520]

const day = (i: number, kcal: number | null): FuelWeekDay => ({
  date: DATES[i],
  targets: i >= 5 ? WEEKEND_TARGET : TARGET,
  consumed: kcal == null ? ZERO : { ...ZERO, kcal },
})

const week = (kcals: readonly (number | null)[]): FuelWeekData => ({
  start: DATES[0],
  days: kcals.map((k, i) => day(i, k)),
  mealScoreAvg: 0.78,
  weightAvgKg: 81.3,
})

const WEEK = week(KCALS)
const SCORES: Record<string, number | null> = Object.fromEntries(DATES.map((d, i) => [d, 70 + i]))

const weekWithOneUnlogged = () => week([...KCALS.slice(0, 3), null, ...KCALS.slice(4)])
const emptyWeek = (): FuelWeekData => ({ ...week(DATES.map(() => null)), mealScoreAvg: null, weightAvgKg: null })

/** A hétköznapi naplózott napok kerethez mért átlaga, kézzel — a szombat/vasárnap kimarad. */
const avgOfLoggedWeekdaysOnly = () => {
  const pcts = [0, 1, 2, 4].map(i => (KCALS[i] / TARGET.kcal) * 100)
  return pcts.reduce((a, b) => a + b, 0) / pcts.length
}

// C1 (mezo-83g0): hétköznap/hétvége kontraszt — ez a heti kép fő üzenete.
test('a hétköznapok és a hétvége átlaga külön áll', () => {
  const vm = buildWeekView(WEEK, SCORES, [])
  expect(vm.weekdayAvgPct).not.toBe(vm.weekendAvgPct)
  expect(vm.weekdayAvgPct).not.toBeNull()
  expect(vm.weekendAvgPct).not.toBeNull()
})

// Őszinte-null: a nem naplózott nap NEM nulla, és nem rontja az átlagot.
test('a nem naplózott nap kimarad az átlagból', () => {
  const vm = buildWeekView(weekWithOneUnlogged(), SCORES, [])
  expect(vm.loggedCount).toBe(6)
  const gap = vm.days.find(d => !d.logged)!
  expect(gap.pct).toBeNull()
  expect(gap.kcal).toBeNull()
  expect(vm.weekdayAvgPct).toBeCloseTo(avgOfLoggedWeekdaysOnly(), 6)
})

test('egyetlen naplózott nap nélkül minden átlag null', () => {
  const vm = buildWeekView(emptyWeek(), {}, [])
  expect(vm.weekdayAvgPct).toBeNull()
  expect(vm.weekendAvgPct).toBeNull()
  expect(vm.loggedCount).toBe(0)
  expect(vm.mealScoreAvg).toBeNull()
  expect(vm.weightAvgKg).toBeNull()
})

// Az owner kérése: a nap AI pontszáma legyen a beszédes szám.
test('a nap az AI napi pontszámát viszi', () => {
  expect(buildWeekView(WEEK, { '2026-09-07': 78 }, []).days[0].dayScore).toBe(78)
})

test('értékelés nélküli nap pontszám nélkül jön vissza', () => {
  expect(buildWeekView(WEEK, {}, []).days[0].dayScore).toBeNull()
  // Egy explicit null értékelés is null — nem nulla pontszám.
  expect(buildWeekView(WEEK, { '2026-09-07': null }, []).days[0].dayScore).toBeNull()
})

// C6: az edzésnapok a heti képben is látszanak.
test('az edzésnap meg van jelölve', () => {
  const vm = buildWeekView(WEEK, SCORES, ['2026-09-08'])
  expect(vm.days[1].training).toBe(true)
  expect(vm.days[0].training).toBe(false)
})

test('a hétvégét a valódi dátum mondja meg, nem a tömb pozíciója', () => {
  const vm = buildWeekView(WEEK, SCORES, [])
  expect(vm.days.map(d => d.weekend)).toEqual([false, false, false, false, false, true, true])
})

// A ház `huDow`-ja a hitelforrás (Sze ≠ Szo — nem rövidítünk egy betűre, az ütközne).
test('a nap felirata a ház rövid magyar napneve', () => {
  expect(buildWeekView(WEEK, SCORES, []).days.map(d => d.label))
    .toEqual(['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'])
})

describe('szégyenmentesség', () => {
  // A keret felett járó nap ÁLLAPOT, nem hiba: a VM nem hordoz „error"/„bad" jelzőt, csak
  // a tényt, hogy a keret felett van.
  test('a kereten túli nap csak „keret felett", nincs hiba-jelző', () => {
    const vm = buildWeekView(week([3200, null, null, null, null, null, null]), SCORES, [])
    expect(vm.days[0].over).toBe(true)
    expect(JSON.stringify(vm)).not.toMatch(/error|fail|bad|rossz/i)
  })

  test('a keret nélküli nap százalék nélkül áll (nullával nem osztunk)', () => {
    const noTarget: FuelWeekData = {
      ...WEEK,
      days: [{ date: DATES[0], targets: ZERO, consumed: { ...ZERO, kcal: 2100 } }],
    }
    const vm = buildWeekView(noTarget, SCORES, [])
    expect(vm.days[0].logged).toBe(true)
    expect(vm.days[0].pct).toBeNull()
    expect(vm.days[0].over).toBe(false)
    expect(vm.weekdayAvgPct).toBeNull()
  })
})

test('a két heti átlag változatlanul jut át a nézetre', () => {
  const vm = buildWeekView(WEEK, SCORES, [])
  expect(vm.mealScoreAvg).toBe(0.78)
  expect(vm.weightAvgKg).toBe(81.3)
})

describe('loggedKcalAvg', () => {
  test('csak a naplózott napokat átlagolja', () => {
    const vm = buildWeekView(weekWithOneUnlogged(), SCORES, [])
    const kcals = KCALS.filter((_, i) => i !== 3)
    expect(loggedKcalAvg(vm.days)).toBeCloseTo(kcals.reduce((a, b) => a + b, 0) / kcals.length, 6)
  })

  test('naplózott nap nélkül null, nem nulla', () => {
    expect(loggedKcalAvg(buildWeekView(emptyWeek(), {}, []).days)).toBeNull()
  })
})

// --- C2 (mezo-83g0): hét-a-héthez delták. A delta IRÁNY, nem ítélet — és csak akkor létezik, ha
// MINDKÉT hét tudja az értéket. -----------------------------------------------------------------

describe('weekDeltas', () => {
  /** Egy heti VM a kért átlagokkal — a delták csak ezt a három értéket olvassák. */
  const vm = (over: Partial<{ kcals: readonly (number | null)[]; mealScoreAvg: number | null; weightAvgKg: number | null }> = {}): WeekViewVM =>
    buildWeekView(
      {
        ...week(over.kcals ?? KCALS),
        mealScoreAvg: over.mealScoreAvg === undefined ? 0.78 : over.mealScoreAvg,
        weightAvgKg: over.weightAvgKg === undefined ? 81.3 : over.weightAvgKg,
      },
      {},
      [],
    )

  test('a delta a két hét különbsége, irányával', () => {
    const d = weekDeltas(vm({ mealScoreAvg: 0.8 }), vm({ mealScoreAvg: 0.7 }))
    expect(d.quality).toEqual({ key: 'quality', direction: 'up', amount: 1 })
  })

  test('a lefelé mutató irány is csak irány, nem minősítés', () => {
    const d = weekDeltas(vm({ weightAvgKg: 81.3 }), vm({ weightAvgKg: 81.9 }))
    expect(d.weight).toEqual({ key: 'weight', direction: 'down', amount: 0.6 })
  })

  test('a napi átlag deltája a NAPLÓZOTT napok átlagából jön', () => {
    const d = weekDeltas(vm({ kcals: [2000, 2000, null, null, null, null, null] }), vm({ kcals: [1900, 1900, null, null, null, null, null] }))
    expect(d.avg).toEqual({ key: 'avg', direction: 'up', amount: 100 })
  })

  test('hiányzó korábbi hétnél nincs egyetlen delta sem', () => {
    expect(weekDeltas(vm(), null)).toEqual({})
  })

  test('ha bármelyik oldal ismeretlen, az a delta kimarad', () => {
    expect(weekDeltas(vm({ weightAvgKg: 82 }), vm({ weightAvgKg: null })).weight).toBeUndefined()
    expect(weekDeltas(vm({ weightAvgKg: null }), vm({ weightAvgKg: 82 })).weight).toBeUndefined()
    // …a többi delta viszont megmarad: egy hiányzó érték nem viszi el az egész sort.
    expect(weekDeltas(vm({ weightAvgKg: null }), vm({ mealScoreAvg: 0.7 })).quality).toBeDefined()
  })

  test('naplózott nap nélküli hétnél nincs napi-átlag delta', () => {
    const empty = buildWeekView(emptyWeek(), {}, [])
    expect(weekDeltas(empty, vm()).avg).toBeUndefined()
    expect(weekDeltas(vm(), empty).avg).toBeUndefined()
  })

  test('azonos értéknél nincs delta, nem nulla nyíl', () => {
    expect(weekDeltas(vm({ mealScoreAvg: 0.8 }), vm({ mealScoreAvg: 0.8 })).quality).toBeUndefined()
    expect(weekDeltas(vm(), vm())).toEqual({})
  })

  test('a megjelenítési pontosság alatti eltérés sem lesz nulla nyíl', () => {
    // 7,80 vs 7,83 a 0–10-es skálán — egy tizedesre ugyanaz, tehát NINCS nyíl.
    expect(weekDeltas(vm({ mealScoreAvg: 0.78 }), vm({ mealScoreAvg: 0.783 })).quality).toBeUndefined()
  })
})
