// ============================================================
// Mezo · usualMeals tests (Fuel Titanium S1c, mezo-33k6; fagyasztott manifeszt A7).
// A rangsor szerződése: napszak ELŐSZÖR, azon belül gyakoriság, végül frissesség — és
// őszinte-null: előzmény nélkül NINCS javaslat, ismeretlen kalóriából nem találunk ki számot.
// Tiszta logika (fuelSwimlane.test.ts mintája): nincs router, nincs QueryClient.
// ============================================================
import { expect, test } from 'vitest'
import { rankUsualMeals } from '@/features/fuel/logic/usualMeals'
import type { FuelMeal } from '@/data/types'

const meal = (over: Partial<FuelMeal> = {}): FuelMeal => ({
  id: 'm1', slot: 'breakfast', title: 'Skyr-bowl zabbal', score: 0.88,
  kcal: 420, p: 36, c: 48, f: 9,
  mealItems: [], items: [], tags: [],
  loggedAt: '2026-09-10T08:05:00+02:00', mealDate: '2026-09-10',
  ...over,
} as FuelMeal)

/** Előzmény ismeretlen kalóriával. A wire LEGÁLISAN hozhat érték nélküli kcal-t — a
 *  keretHero.ts `meal?.kcal ?? s.kcal ?? null` ága pontosan ezt az esetet őrzi —, ezért a
 *  típus-hazugság itt szándékos: a produkciós kódnak ezt is el kell bírnia. */
const mealWithoutKcal = (): FuelMeal =>
  meal({ id: 'nok', title: 'Ismeretlen fogás', kcal: undefined as unknown as number })

// Két reggeli (az egyik kétszer), egy ebéd és egy vacsora — a napszak-rendezés és a
// gyakoriság-rendezés így külön is megfigyelhető.
const MEALS: FuelMeal[] = [
  meal({ id: 'b1', slot: 'breakfast', title: 'Zabkása gyümölccsel', loggedAt: '2026-09-08T08:10:00+02:00' }),
  meal({ id: 'b2', slot: 'breakfast', title: 'Zabkása gyümölccsel', loggedAt: '2026-09-09T08:05:00+02:00' }),
  meal({ id: 'b3', slot: 'breakfast', title: 'Görög joghurt', kcal: 240, loggedAt: '2026-09-10T08:30:00+02:00' }),
  meal({ id: 'l1', slot: 'lunch', title: 'Csirkés rizstál', kcal: 760, loggedAt: '2026-09-10T12:40:00+02:00' }),
  meal({ id: 'd1', slot: 'dinner', title: 'Tojásos tortilla', kcal: 750, loggedAt: '2026-09-10T20:35:00+02:00' }),
]

// A7 (mezo-33k6): FoodNoms-minta — napszak ELŐSZÖR, azon belül gyakoriság, végül frissesség.
test('a napszakhoz illő étkezések állnak elöl', () => {
  const rows = rankUsualMeals(MEALS, '08:00')
  expect(rows[0].slot).toBe('breakfast')
  expect(rows[1].slot).toBe('breakfast')
})

test('más napszakban más étkezés vezet — a rangsor nem beégetett sorrend', () => {
  expect(rankUsualMeals(MEALS, '13:00')[0].slot).toBe('lunch')
  expect(rankUsualMeals(MEALS, '19:30')[0].slot).toBe('dinner')
})

test('azonos napszakon belül a gyakoribb előzi meg a ritkábbat', () => {
  const rows = rankUsualMeals(MEALS, '08:00').filter(r => r.slot === 'breakfast')
  expect(rows.map(r => r.count)).toEqual([...rows.map(r => r.count)].sort((a, b) => b - a))
  expect(rows[0].title).toBe('Zabkása gyümölccsel')
  expect(rows[0].count).toBe(2)
})

test('azonos gyakoriságnál a frissebb nyer', () => {
  const rows = rankUsualMeals([
    meal({ id: 'o1', slot: 'breakfast', title: 'Régebbi reggeli', loggedAt: '2026-09-01T08:00:00+02:00' }),
    meal({ id: 'o2', slot: 'breakfast', title: 'Frissebb reggeli', loggedAt: '2026-09-10T08:00:00+02:00' }),
  ], '08:00')
  expect(rows.map(r => r.title)).toEqual(['Frissebb reggeli', 'Régebbi reggeli'])
  expect(rows[0].lastLoggedIso).toBe('2026-09-10T08:00:00+02:00')
})

// Az azonos étkezés nem szerepel kétszer.
test('az ismételt étkezés egy sorrá vonódik össze, a darabszámával', () => {
  const rows = rankUsualMeals(MEALS, '08:00')
  expect(new Set(rows.map(r => r.key)).size).toBe(rows.length)
  expect(rows.find(r => r.title === 'Zabkása gyümölccsel')!.count).toBe(2)
  // Az összevont sor a LEGUTÓBBI előfordulás idejét viszi.
  expect(rows.find(r => r.title === 'Zabkása gyümölccsel')!.lastLoggedIso).toBe('2026-09-09T08:05:00+02:00')
})

// Őszinte-null: kcal nélküli előzményből nem találunk ki számot.
test('ismeretlen kalóriájú előzmény kcal nélkül jön vissza', () => {
  expect(rankUsualMeals([mealWithoutKcal()], '08:00')[0].kcal).toBeNull()
})

test('előzmény nélkül üres lista, nem kitalált javaslat', () => {
  expect(rankUsualMeals([], '08:00')).toEqual([])
})

test('névtelen, tételek nélküli előzmény nem lesz szokásos — nem adunk neki kitalált nevet', () => {
  expect(rankUsualMeals([meal({ id: 'x', title: '', mealItems: [] })], '08:00')).toEqual([])
})

test('ismeretlen napszakú előzmény kimarad — sosem fabrikálunk neki ablakot', () => {
  expect(rankUsualMeals([meal({ id: 'u', slot: 'valami más', title: 'Rejtélyes fogás' })], '08:00')).toEqual([])
})

test('a lista hossza korlátos, alapból hat sor', () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    meal({ id: `m${i}`, slot: 'breakfast', title: `Reggeli ${i}`, loggedAt: `2026-09-${String(i + 1).padStart(2, '0')}T08:00:00+02:00` }))
  expect(rankUsualMeals(many, '08:00')).toHaveLength(6)
  expect(rankUsualMeals(many, '08:00', 3)).toHaveLength(3)
})
