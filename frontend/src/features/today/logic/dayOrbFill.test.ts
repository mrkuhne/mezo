import { dayOrbFill, NEUTRAL_INTENSITY, type DayOrbSignals, type DayOrbPlan } from '@/features/today/logic/dayOrbFill'

const none: DayOrbSignals = {
  sleep: false, weight: false, fuel: false,
  gym: false, sport: false, checkin: false, journal: false,
}
const restDay: DayOrbPlan = { gymPlanned: false, sportPlanned: false }
const gymDay: DayOrbPlan = { gymPlanned: true, sportPlanned: false }
const fullDay: DayOrbPlan = { gymPlanned: true, sportPlanned: true }

test('pihenőnapon öt jel a nevező — az edzés és a sport nem tartozik a naphoz', () => {
  expect(dayOrbFill(none, restDay, null).denominator).toBe(5)
})

test('edzésnapon hat, edzés+sport napon hét a nevező', () => {
  expect(dayOrbFill(none, gymDay, null).denominator).toBe(6)
  expect(dayOrbFill(none, fullDay, null).denominator).toBe(7)
})

test('egy nem tervezett, de LOGOLT sport belép a nevezőbe ÉS a számlálóba — sosem ronthat', () => {
  const withSport = dayOrbFill({ ...none, sport: true }, restDay, null)
  expect(withSport.denominator).toBe(6)
  expect(withSport.present).toBe(1)
  // 1/6 > 0/5 — a spontán mozgás nem húzhatja lejjebb a töltöttséget
  expect(withSport.pct).toBeGreaterThan(dayOrbFill(none, restDay, null).pct)
})

test('egy nem tervezett, de logolt edzés ugyanígy viselkedik', () => {
  const withGym = dayOrbFill({ ...none, gym: true }, restDay, null)
  expect(withGym.denominator).toBe(6)
  expect(withGym.present).toBe(1)
})

test('egy tervezett, de nem logolt edzés a nevezőben van, a számlálóban nincs', () => {
  const r = dayOrbFill({ ...none, sleep: true }, gymDay, null)
  expect(r.denominator).toBe(6)
  expect(r.present).toBe(1)
})

test('minden jel egyet ér — nincs súlyozás', () => {
  const onlyJournal = dayOrbFill({ ...none, journal: true }, restDay, null)
  const onlyWeight = dayOrbFill({ ...none, weight: true }, restDay, null)
  expect(onlyJournal.pct).toBe(onlyWeight.pct)
})

test('a teljes pihenőnap 100%', () => {
  const all: DayOrbSignals = {
    sleep: true, weight: true, fuel: true, checkin: true, journal: true,
    gym: false, sport: false,
  }
  expect(dayOrbFill(all, restDay, null)).toMatchObject({ present: 5, denominator: 5, pct: 100 })
})

test('a pct kerekített egész', () => {
  const r = dayOrbFill({ ...none, sleep: true }, fullDay, null)
  expect(r.pct).toBe(14) // 1/7 = 14.28…
  expect(Number.isInteger(r.pct)).toBe(true)
})

test('45 pont alatt az intenzitás 0, 92 fölött 1', () => {
  expect(dayOrbFill(none, restDay, 30).intensity).toBe(0)
  expect(dayOrbFill(none, restDay, 45).intensity).toBe(0)
  expect(dayOrbFill(none, restDay, 92).intensity).toBe(1)
  expect(dayOrbFill(none, restDay, 100).intensity).toBe(1)
})

test('a 45 és 92 közti pont lineárisan interpolál', () => {
  // 68.5 a felezőpont: (68.5 − 45) / 47 = 0.5
  expect(dayOrbFill(none, restDay, 68.5).intensity).toBeCloseTo(0.5, 5)
})

test('null pont (COMPANION_SWITCH ki, vagy „tanulom") → semleges intenzitás', () => {
  expect(dayOrbFill(none, restDay, null).intensity).toBe(NEUTRAL_INTENSITY)
})
