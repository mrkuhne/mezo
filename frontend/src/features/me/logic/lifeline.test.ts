import { buildLifeline } from './lifeline'

const W = (date: string, value: number) => ({ date, value })
const base = { sleepLog: [], perks: [], goal: null, weeklyRate4w: 0, todayIso: '2026-09-27' }

test('fewer than two measured weeks → null (no curve, no invented point)', () => {
  expect(buildLifeline({ ...base, weightLog: [] })).toBeNull()
  expect(buildLifeline({ ...base, weightLog: [W('2026-09-22', 80), W('2026-09-23', 80.2)] })).toBeNull()
})

test('weekly averages, oldest first, limited to the 12-week window', () => {
  const l = buildLifeline({ ...base, weightLog: [
    W('2026-06-01', 90),                       // outside the window
    W('2026-09-14', 80), W('2026-09-16', 81),  // week of 09-14 → 80.5
    W('2026-09-22', 79),                       // week of 09-21 → 79
  ] })!
  expect(l.points).toEqual([{ weekStart: '2026-09-14', avgKg: 80.5 }, { weekStart: '2026-09-21', avgKg: 79 }])
  expect(l.deltaKg).toBeCloseTo(-1.5)
})

test('a whole-kg crossing toward the goal is a station, once', () => {
  const l = buildLifeline({ ...base, goal: { targetWeight: 73 }, weightLog: [
    W('2026-09-01', 80.4), W('2026-09-08', 79.8), W('2026-09-15', 79.6), W('2026-09-22', 78.9),
  ] })!
  expect(l.stations.map((s) => [s.index, s.title])).toEqual([[1, '80 kg alatt'], [3, '79 kg alatt']])
  expect(l.remainingKg).toBeCloseTo(5.9)
})

test('one week dropping through several boundaries yields ONE station on the lowest', () => {
  const l = buildLifeline({ ...base, goal: { targetWeight: 73 }, weightLog: [
    W('2026-09-08', 81.2), W('2026-09-22', 78.9),
  ] })!
  expect(l.stations.map((s) => [s.index, s.title])).toEqual([[1, '79 kg alatt']])
  expect(l.stations[0].caption).toBe('Először ment a heti átlagod 79 kg alá.')
  expect(l.stations[0].dateIso).toBe('2026-09-21')
})

test('upward goal mirrors: fölött, highest boundary crossed', () => {
  const l = buildLifeline({ ...base, goal: { targetWeight: 90 }, weightLog: [
    W('2026-09-08', 80.4), W('2026-09-22', 82.1),
  ] })!
  expect(l.stations.map((s) => [s.index, s.title])).toEqual([[1, '82 kg fölött']])
  expect(l.stations[0].caption).toBe('Először ment a heti átlagod 82 kg fölé.')
})

test('no goal → no kg stations, no projection', () => {
  const l = buildLifeline({ ...base, weightLog: [W('2026-09-08', 80.4), W('2026-09-22', 78.9)] })!
  expect(l.stations).toEqual([])
  expect(l.project).toBe(false)
})

test('projection only when the 4-week rate heads toward the target', () => {
  const log = [W('2026-09-08', 80.4), W('2026-09-22', 78.9)]
  expect(buildLifeline({ ...base, goal: { targetWeight: 73 }, weeklyRate4w: -0.4, weightLog: log })!.project).toBe(true)
  expect(buildLifeline({ ...base, goal: { targetWeight: 73 }, weeklyRate4w: 0.2, weightLog: log })!.project).toBe(false)
})

test('a perk unlocked inside the window is a station on its week', () => {
  const l = buildLifeline({ ...base, weightLog: [W('2026-09-08', 80.4), W('2026-09-22', 78.9)],
    perks: [{ name: 'Páncélzat', effectCopy: '10 hét töretlen', unlockedAt: '2026-09-09T10:00:00Z' }] })!
  expect(l.stations).toEqual([expect.objectContaining({ index: 0, kind: 'perk', title: 'Új képesség: Páncélzat', caption: '10 hét töretlen' })])
})

test('sleep band: weekly mean, null where no night was logged', () => {
  const l = buildLifeline({ ...base, weightLog: [W('2026-09-08', 80.4), W('2026-09-22', 78.9)],
    sleepLog: [{ date: '2026-09-22', duration: 7 }, { date: '2026-09-23', duration: 8 }] as never })!
  expect(l.sleepHours).toEqual([null, 7.5])
})
