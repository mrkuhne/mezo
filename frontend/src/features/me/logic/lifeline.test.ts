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

test('re-crossing a boundary does not repeat the station', () => {
  const log = (vals: number[]) => vals.map((v, i) => W(`2026-09-${String(1 + i * 7).padStart(2, '0')}`, v))
  const down = buildLifeline({ ...base, goal: { targetWeight: 73 }, weightLog: log([80.4, 79.8, 80.3, 79.7]) })!
  expect(down.stations.map((s) => [s.index, s.title])).toEqual([[1, '80 kg alatt']])
  const up = buildLifeline({ ...base, goal: { targetWeight: 90 }, weightLog: log([79.6, 80.2, 79.7, 80.3]) })!
  expect(up.stations.map((s) => [s.index, s.title])).toEqual([[1, '80 kg fölött']])
})

test('an exact integer average still counts: 80.4 → 79.0 is "80 kg alatt" only', () => {
  const l = buildLifeline({ ...base, goal: { targetWeight: 73 }, weightLog: [W('2026-09-08', 80.4), W('2026-09-22', 79)] })!
  expect(l.stations.map((s) => s.title)).toEqual(['80 kg alatt'])
})

test('a perk outside the window is not a station', () => {
  const l = buildLifeline({ ...base, weightLog: [W('2026-09-08', 80.4), W('2026-09-22', 78.9)],
    perks: [{ name: 'Régi', effectCopy: 'x', unlockedAt: '2026-03-01T10:00:00Z' }] })!
  expect(l.stations).toEqual([])
})

test('two perks in one week give two stations on the same index', () => {
  const l = buildLifeline({ ...base, weightLog: [W('2026-09-08', 80.4), W('2026-09-22', 78.9)],
    perks: [
      { name: 'A', effectCopy: 'a', unlockedAt: '2026-09-09T10:00:00Z' },
      { name: 'B', effectCopy: 'b', unlockedAt: '2026-09-11T10:00:00Z' },
    ] })!
  expect(l.stations.map((s) => [s.index, s.title])).toEqual([[0, 'Új képesség: A'], [0, 'Új képesség: B']])
})

test('a measurement in a week after today is ignored', () => {
  const l = buildLifeline({ ...base, weightLog: [W('2026-09-08', 80.4), W('2026-09-22', 78.9), W('2026-09-30', 70)] })!
  expect(l.points.map((p) => p.weekStart)).toEqual(['2026-09-07', '2026-09-21'])
})

// final review — „first crossing" is judged against the whole log, not the 12-week window
test('a pre-window low below the boundary: re-crossing it inside the window is not a station', () => {
  const l = buildLifeline({ ...base, goal: { targetWeight: 73 }, weightLog: [
    W('2026-03-02', 82), W('2026-03-09', 79.5),          // long before the window: already under 80
    W('2026-09-08', 80.4), W('2026-09-15', 79.8), W('2026-09-22', 79.6),
  ] })!
  expect(l.points.map((p) => p.weekStart)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21']) // the window is unchanged
  expect(l.stations).toEqual([])
})

test('a pre-window low still lets a DEEPER boundary fire', () => {
  const l = buildLifeline({ ...base, goal: { targetWeight: 73 }, weightLog: [
    W('2026-03-02', 82), W('2026-03-09', 79.5),
    W('2026-09-08', 80.4), W('2026-09-15', 79.8), W('2026-09-22', 78.9),
  ] })!
  expect(l.stations.map((s) => [s.index, s.title])).toEqual([[2, '79 kg alatt']])
})

test('a pre-window history that never crossed: the station still fires', () => {
  const l = buildLifeline({ ...base, goal: { targetWeight: 73 }, weightLog: [
    W('2026-03-02', 82), W('2026-03-09', 80.9),
    W('2026-09-08', 80.4), W('2026-09-15', 79.8), W('2026-09-22', 79.6),
  ] })!
  expect(l.stations.map((s) => [s.index, s.title])).toEqual([[1, '80 kg alatt']])
  expect(l.stations[0].caption).toBe('Először ment a heti átlagod 80 kg alá.')
})

test('with earlier history the window\'s FIRST week can itself be a first crossing', () => {
  const l = buildLifeline({ ...base, goal: { targetWeight: 73 }, weightLog: [
    W('2026-03-02', 82), W('2026-03-09', 81.2),          // never under 81 before the window
    W('2026-09-08', 80.4), W('2026-09-22', 80.2),
  ] })!
  expect(l.stations.map((s) => [s.index, s.title, s.dateIso])).toEqual([[0, '81 kg alatt', '2026-09-07']])
})

test('upward goal: a pre-window high suppresses the re-crossing, a lower history does not', () => {
  const win = [W('2026-09-08', 79.6), W('2026-09-15', 80.2), W('2026-09-22', 80.4)]
  const seen = buildLifeline({ ...base, goal: { targetWeight: 90 }, weightLog: [W('2026-03-02', 78), W('2026-03-09', 80.6), ...win] })!
  expect(seen.stations).toEqual([])
  const fresh = buildLifeline({ ...base, goal: { targetWeight: 90 }, weightLog: [W('2026-03-02', 78), W('2026-03-09', 79.1), ...win] })!
  expect(fresh.stations.map((s) => [s.index, s.title])).toEqual([[1, '80 kg fölött']])
})

// final review — a reached target is not „még 0,4 kg"
test('reached: the latest average at or beyond the target in the goal\'s direction', () => {
  const down = (vals: [number, number]) => buildLifeline({ ...base, goal: { targetWeight: 73 },
    weightLog: [W('2026-09-08', vals[0]), W('2026-09-22', vals[1])] })!
  expect(down([74.2, 73.4]).reached).toBe(false)
  expect(down([74.2, 73]).reached).toBe(true)      // exactly on the target
  const over = down([74.2, 72.6])
  expect(over.reached).toBe(true)                  // overshot
  expect(over.remainingKg).toBeCloseTo(0.4)        // the absolute distance alone would read „még 0,4 kg"
  const up = (last: number) => buildLifeline({ ...base, goal: { targetWeight: 82 },
    weightLog: [W('2026-09-08', 80.4), W('2026-09-22', last)] })!
  expect(up(81.6).reached).toBe(false)
  expect(up(82.3).reached).toBe(true)
})

test('reached keeps its direction when the target was passed before the window', () => {
  const l = buildLifeline({ ...base, goal: { targetWeight: 73 }, weightLog: [
    W('2026-03-02', 80), W('2026-09-08', 72.8), W('2026-09-22', 72.4),
  ] })!
  expect(l.reached).toBe(true)
})

test('reached is false without a goal', () => {
  expect(buildLifeline({ ...base, weightLog: [W('2026-09-08', 80.4), W('2026-09-22', 78.9)] })!.reached).toBe(false)
})
