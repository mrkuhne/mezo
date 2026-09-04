import {
  fitLine,
  firstLastSnapshotN,
  journalEntries,
  latestAlignedDay,
  strengthSeries,
  strengthTickLabels,
  strengthTrendCaption,
} from '@/features/insights/logic/patternHistory'
import type { AlignedDay, PatternEvent, PatternMonitorPair } from '@/data/types'

const pair: PatternMonitorPair = {
  key: 'sleep-quality~next-day-training-rpe',
  title: 'Alvásminőség ↔ másnapi edzés-RPE',
  category: 'physiology',
  categoryLabel: 'Fiziológia',
  lagDays: 1,
  metricAKey: 'sleep-quality',
  metricALabel: 'alvásminőség',
  metricAValueKind: 'number',
  metricBKey: 'training-rpe',
  metricBLabel: 'edzés-RPE',
  metricBValueKind: 'number',
  mechanismHu: 'A rosszabb alvás másnap nehezebbnek érződő edzést hozhat.',
  questionHu: 'Nehezebb edzés után rosszabbul alszol?',
  expectedDirection: 'negative',
  whenPositiveHu: 'a jobb alvás után {erősség} könnyebbnek érződött az edzés',
  whenNegativeHu: 'a jobb alvás után {erősség} nehezebbnek érződött az edzés',
  metricADomain: 'sleep',
  metricBDomain: 'train',
  verdict: 'frozen',
  alignedDays: 32,
  missingDays: null,
  bottleneckMetricKey: null,
  groupZeroDays: null,
  groupOneDays: null,
  requiredPerGroup: null,
  r: -0.58,
  n: 32,
  p: 0.001,
  status: 'confirmed',
}

// --- journalEntries ---------------------------------------------------------

test('the first snapshot logs the birth line with its strength band', () => {
  const events: PatternEvent[] = [
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14, p: 0.52 },
  ]
  expect(journalEntries(events, pair)).toEqual([
    { date: 'jún 3.', tone: 'neutral', text: 'Életre kelt — 14 közös nap gyűlt össze, gyenge jel.' },
  ])
})

test('a snapshot whose strengthWord band differs from the previous one logs the crossing (strengthening)', () => {
  const events: PatternEvent[] = [
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14, p: 0.52 },
    { kind: 'snapshot', occurredAt: '2026-06-24T02:40:00Z', r: -0.31, n: 18, p: 0.19 },
  ]
  const entries = journalEntries(events, pair)
  expect(entries).toHaveLength(2)
  expect(entries[1]).toEqual({
    date: 'jún 24.',
    tone: 'neutral',
    text: 'A jel erősödött, átlépte az „érezhető" sávot.',
  })
})

test('a weakening crossing reads "gyengült" and names the lower band', () => {
  const events: PatternEvent[] = [
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: 0.5, n: 14, p: 0.2 },
    { kind: 'snapshot', occurredAt: '2026-06-24T02:40:00Z', r: 0.2, n: 18, p: 0.4 },
  ]
  expect(journalEntries(events, pair)[1]).toEqual({
    date: 'jún 24.',
    tone: 'neutral',
    text: 'A jel gyengült, átlépte a „gyenge" sávot.',
  })
})

test('a same-band snapshot logs nothing beyond the first entry', () => {
  const events: PatternEvent[] = [
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14, p: 0.52 },
    { kind: 'snapshot', occurredAt: '2026-06-10T02:40:00Z', r: -0.2, n: 15, p: 0.5 },
  ]
  expect(journalEntries(events, pair)).toHaveLength(1)
})

test('confirmed folds a later promotion into its factLink', () => {
  const events: PatternEvent[] = [
    { kind: 'snapshot', occurredAt: '2026-07-12T02:40:00Z', r: -0.42, n: 21, p: 0.058 },
    { kind: 'confirmed', occurredAt: '2026-07-12T09:15:00Z' },
    { kind: 'promoted', occurredAt: '2026-07-12T09:15:05Z', factId: 'fact-1' },
  ]
  const entries = journalEntries(events, pair)
  // birth line + confirm line only — the promoted event renders no line of its own
  expect(entries).toHaveLength(2)
  expect(entries[1]).toEqual({
    date: 'júl 12.',
    tone: 'success',
    text: '**Megerősítetted.**',
    factLink: true,
  })
})

test('confirmed without a later promotion has no factLink', () => {
  const events: PatternEvent[] = [
    { kind: 'snapshot', occurredAt: '2026-07-12T02:40:00Z', r: -0.42, n: 21, p: 0.058 },
    { kind: 'confirmed', occurredAt: '2026-07-12T09:15:00Z' },
  ]
  expect(journalEntries(events, pair)[1].factLink).toBeUndefined()
})

test('a promoted event alone renders no line', () => {
  const events: PatternEvent[] = [{ kind: 'promoted', occurredAt: '2026-07-12T09:15:05Z', factId: 'fact-1' }]
  expect(journalEntries(events, pair)).toEqual([])
})

test('monitoring logs the watch-list line', () => {
  const events: PatternEvent[] = [{ kind: 'monitoring', occurredAt: '2026-06-05T00:00:00Z' }]
  expect(journalEntries(events, pair)).toEqual([
    { date: 'jún 5.', tone: 'accent', text: 'Megfigyelésre tetted.' },
  ])
})

test('rejected logs the frozen line', () => {
  const events: PatternEvent[] = [{ kind: 'rejected', occurredAt: '2026-07-02T00:00:00Z' }]
  expect(journalEntries(events, pair)).toEqual([
    { date: 'júl 2.', tone: 'neutral', text: 'Elvetetted — befagyasztva.' },
  ])
})

test('reinforced logs the recurrence line with its count', () => {
  const events: PatternEvent[] = [
    { kind: 'reinforced', occurredAt: '2026-07-30T02:40:01Z', reinforcementCount: 2 },
  ]
  expect(journalEntries(events, pair)).toEqual([
    {
      date: 'júl 30.',
      tone: 'accent',
      text: 'Újra előjött ugyanabban az irányban — a tudás megerősödött (×2).',
    },
  ])
})

test('journalEntries returns nothing while the pair has not loaded', () => {
  const events: PatternEvent[] = [{ kind: 'snapshot', occurredAt: '2026-06-03T00:00:00Z', r: 0.2, n: 5 }]
  expect(journalEntries(events, null)).toEqual([])
})

test('the full showcase narrative reads in chronological order', () => {
  const events: PatternEvent[] = [
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14, p: 0.52 },
    { kind: 'snapshot', occurredAt: '2026-06-24T02:40:00Z', r: -0.31, n: 18, p: 0.19 },
    { kind: 'snapshot', occurredAt: '2026-07-12T02:40:00Z', r: -0.42, n: 21, p: 0.058 },
    { kind: 'confirmed', occurredAt: '2026-07-12T09:15:00Z' },
    { kind: 'promoted', occurredAt: '2026-07-12T09:15:05Z', factId: 'fact-showcase-1' },
    { kind: 'snapshot', occurredAt: '2026-07-30T02:40:00Z', r: -0.51, n: 27, p: 0.008 },
    { kind: 'reinforced', occurredAt: '2026-07-30T02:40:01Z', reinforcementCount: 2 },
    { kind: 'snapshot', occurredAt: '2026-08-13T02:40:00Z', r: -0.58, n: 32, p: 0.001 },
    { kind: 'reinforced', occurredAt: '2026-08-13T02:40:01Z', reinforcementCount: 4 },
  ]
  expect(journalEntries(events, pair)).toEqual([
    { date: 'jún 3.', tone: 'neutral', text: 'Életre kelt — 14 közös nap gyűlt össze, gyenge jel.' },
    { date: 'jún 24.', tone: 'neutral', text: 'A jel erősödött, átlépte az „érezhető" sávot.' },
    { date: 'júl 12.', tone: 'success', text: '**Megerősítetted.**', factLink: true },
    {
      date: 'júl 30.',
      tone: 'accent',
      text: 'Újra előjött ugyanabban az irányban — a tudás megerősödött (×2).',
    },
    {
      date: 'aug 13.',
      tone: 'accent',
      text: 'Újra előjött ugyanabban az irányban — a tudás megerősödött (×4).',
    },
  ])
})

// --- strengthSeries ----------------------------------------------------------

test('strengthSeries orders snapshots chronologically by |r|', () => {
  const events: PatternEvent[] = [
    { kind: 'snapshot', occurredAt: '2026-06-24T02:40:00Z', r: -0.31, n: 18 },
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14 },
  ]
  expect(strengthSeries(events)).toEqual([
    { date: '2026-06-03', absR: 0.18, kind: 'snapshot' },
    { date: '2026-06-24', absR: 0.31, kind: 'snapshot' },
  ])
})

test('strengthSeries marks a confirmed day with its nearest snapshot |r|', () => {
  const events: PatternEvent[] = [
    { kind: 'snapshot', occurredAt: '2026-06-24T02:40:00Z', r: -0.31, n: 18 },
    { kind: 'snapshot', occurredAt: '2026-07-30T02:40:00Z', r: -0.51, n: 27 },
    { kind: 'confirmed', occurredAt: '2026-07-25T09:15:00Z' },
  ]
  const series = strengthSeries(events)
  expect(series).toHaveLength(3)
  expect(series).toContainEqual({ date: '2026-07-25', absR: 0.51, kind: 'confirmed' })
})

test('strengthSeries ignores a confirmed event when there is no snapshot to anchor it to', () => {
  const events: PatternEvent[] = [{ kind: 'confirmed', occurredAt: '2026-07-25T09:15:00Z' }]
  expect(strengthSeries(events)).toEqual([])
})

// --- strengthTickLabels -------------------------------------------------

test('strengthTickLabels labels every point plainly when no date collides', () => {
  const points = strengthSeries([
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14 },
    { kind: 'snapshot', occurredAt: '2026-06-24T02:40:00Z', r: -0.31, n: 18 },
  ])
  expect(strengthTickLabels(points)).toEqual([
    { text: 'jún 3', accent: false },
    { text: 'jún 24', accent: false },
  ])
})

test('strengthTickLabels suppresses a plain snapshot label that shares its day with the confirmed point', () => {
  // Same fixture shape as the showcase pair: a snapshot and its confirm land on the same day,
  // so strengthSeries produces two same-date points — the snapshot's own tick must not repeat
  // the confirmed point's "{date} ✓" label right next to it.
  const points = strengthSeries([
    { kind: 'snapshot', occurredAt: '2026-06-24T02:40:00Z', r: -0.31, n: 18 },
    { kind: 'snapshot', occurredAt: '2026-07-12T02:40:00Z', r: -0.42, n: 21 },
    { kind: 'confirmed', occurredAt: '2026-07-12T09:15:00Z' },
  ])
  const labels = strengthTickLabels(points)
  expect(labels).toEqual([
    { text: 'jún 24', accent: false },
    { text: '', accent: false }, // the plain júl 12 snapshot — suppressed
    { text: 'júl 12 ✓', accent: true }, // the confirmed júl 12 point carries the date alone
  ])
})

// --- strengthTrendCaption --------------------------------------------------

test('strengthTrendCaption reads "erősödik" when the last snapshot is stronger than the first', () => {
  const points = strengthSeries([
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14 },
    { kind: 'snapshot', occurredAt: '2026-08-13T02:40:00Z', r: -0.58, n: 32 },
  ])
  expect(strengthTrendCaption(points, 14, 32)).toBe(
    'A jel folyamatosan erősödik, ahogy gyűlnek a közös napok — 14 napról 32-re.',
  )
})

test('strengthTrendCaption reads "gyengült" when the last snapshot is weaker than the first', () => {
  const points = strengthSeries([
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.55, n: 14 },
    { kind: 'snapshot', occurredAt: '2026-08-13T02:40:00Z', r: -0.22, n: 32 },
  ])
  expect(strengthTrendCaption(points, 14, 32)).toBe(
    'A jel gyengült az utóbbi futások során — 14 napról 32-re nőtt a közös napok száma.',
  )
})

test('strengthTrendCaption reads "stabil" when the band is unchanged and |Δr| is under 0.05', () => {
  const points = strengthSeries([
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: 0.4, n: 14 },
    { kind: 'snapshot', occurredAt: '2026-08-13T02:40:00Z', r: 0.42, n: 32 },
  ])
  expect(strengthTrendCaption(points, 14, 32)).toBe(
    'A jel stabil, ahogy gyűlnek a közös napok — 14 napról 32-re.',
  )
})

test('strengthTrendCaption compares the first/last SNAPSHOT, ignoring a confirmed point outside that range', () => {
  // The confirmed point's own date can, in principle, land outside the snapshot span — the
  // direction must still come from the snapshots, not from whichever point sorts first/last.
  const points = strengthSeries([
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14 },
    { kind: 'snapshot', occurredAt: '2026-08-13T02:40:00Z', r: -0.58, n: 32 },
    { kind: 'confirmed', occurredAt: '2026-08-13T09:15:00Z' },
  ])
  expect(strengthTrendCaption(points, 14, 32)).toBe(
    'A jel folyamatosan erősödik, ahogy gyűlnek a közös napok — 14 napról 32-re.',
  )
})

// --- fitLine -------------------------------------------------------------

test('fitLine least-squares a known 3-point set', () => {
  const days: AlignedDay[] = [
    { date: '2026-01-01', a: 1, b: 2 },
    { date: '2026-01-02', a: 2, b: 4 },
    { date: '2026-01-03', a: 3, b: 6 },
  ]
  const fit = fitLine(days)
  expect(fit?.slope).toBeCloseTo(2)
  expect(fit?.intercept).toBeCloseTo(0)
})

test('fitLine needs at least two points', () => {
  expect(fitLine([])).toBeNull()
  expect(fitLine([{ date: '2026-01-01', a: 1, b: 2 }])).toBeNull()
})

// --- firstLastSnapshotN ----------------------------------------------------

test('firstLastSnapshotN reads the n of the first and last snapshot, chronologically', () => {
  const events: PatternEvent[] = [
    { kind: 'snapshot', occurredAt: '2026-06-24T02:40:00Z', r: -0.31, n: 18 },
    { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14 },
    { kind: 'confirmed', occurredAt: '2026-07-12T09:15:00Z' },
    { kind: 'snapshot', occurredAt: '2026-08-13T02:40:00Z', r: -0.58, n: 32 },
  ]
  expect(firstLastSnapshotN(events)).toEqual({ first: 14, last: 32 })
})

test('firstLastSnapshotN needs at least two n-bearing snapshots', () => {
  expect(firstLastSnapshotN([])).toBeNull()
  expect(firstLastSnapshotN([{ kind: 'snapshot', occurredAt: '2026-06-03T00:00:00Z', r: 0.2, n: 5 }])).toBeNull()
})

// --- latestAlignedDay --------------------------------------------------

test('latestAlignedDay picks the day with the greatest ISO date', () => {
  const days: AlignedDay[] = [
    { date: '2026-08-11', a: 8.5, b: 4.4 },
    { date: '2026-07-21', a: 4.8, b: 7.6 },
    { date: '2026-08-13', a: 8.8, b: 4.1 },
  ]
  expect(latestAlignedDay(days)).toEqual({ date: '2026-08-13', a: 8.8, b: 4.1 })
})

test('latestAlignedDay is null on an empty list', () => {
  expect(latestAlignedDay([])).toBeNull()
})
