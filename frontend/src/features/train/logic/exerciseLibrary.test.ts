import { describe, expect, it, test } from 'vitest'
import {
  buildLibraryRows, exerciseKey, filterLibraryRows, firstSeenDate, foldAccents, libraryCounts,
  libraryRegions, medalsForExercise, nextTarget, sinceFact, whereUsed,
} from './exerciseLibrary'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import type { Medal } from '@/data/train/medalTypes'
import type { ExerciseLibraryItem } from '@/data/types'

// Fixtures — the two identity shapes the join has to tell apart: a catalog-linked row
// (catalogId on BOTH sides) and a mock/legacy row matched by name only.
const item = (p: Partial<ExerciseLibraryItem> & { id: string; name: string; muscle: string }): ExerciseLibraryItem => ({
  type: 'compound', stim: 0.8, fatigue: 0.5, ...p,
})

const record = (p: Partial<ExerciseRecordResponse> & { name: string }): ExerciseRecordResponse => ({
  muscle: 'chest-mid', type: 'compound', totalVolume: 0, totalSets: 0, totalReps: 0,
  sessionCount: 1, repRecords: [], recentTopSets: [], ...p,
})

const medal = (p: Partial<Medal> & { exerciseName: string }): Medal => ({
  type: 'E1RM', tier: 'RECORD', date: '2026-09-01', value: 100, unit: 'KG', ...p,
})

const CATALOG: ExerciseLibraryItem[] = [
  item({ id: 'l1', catalogId: 'c1', name: 'Bench Press', muscle: 'chest-mid' }),
  item({ id: 'l2', name: 'Barbell Curl', muscle: 'biceps-long', type: 'isolation' }),
  item({ id: 'l3', catalogId: 'c3', name: 'Box Jump', muscle: 'quad', type: 'plyo' }),
]

const RECORDS: ExerciseRecordResponse[] = [
  record({ catalogId: 'c1', name: 'Bench Press', muscle: 'chest-mid', bestE1rm: { value: 102.5, set: { weightKg: 90, reps: 5, date: '2026-08-20' } } }),
  record({ name: 'Barbell Curl', muscle: 'biceps-long', type: 'isolation' }),
]

const MEDALS: Medal[] = [
  medal({ catalogId: 'c1', exerciseName: 'Bench Press' }),
  medal({ catalogId: 'c1', exerciseName: 'Bench Press', type: 'WEIGHT', value: 90 }),
  medal({ exerciseName: 'Barbell Curl', type: 'WEIGHT', value: 30 }),
]

describe('buildLibraryRows', () => {
  const rows = buildLibraryRows(CATALOG, RECORDS, MEDALS)

  it('keeps the catalogue order and one row per catalogue exercise', () => {
    expect(rows.map((r) => r.name)).toEqual(['Bench Press', 'Barbell Curl', 'Box Jump'])
  })

  it('joins the record by catalogId when both sides carry one', () => {
    expect(rows[0].record?.catalogId).toBe('c1')
    expect(rows[0].bestE1rm).toBe(102.5)
  })

  it('falls back to a name match when the catalogue row has no catalogId', () => {
    expect(rows[1].record?.name).toBe('Barbell Curl')
    // logged, but no trustworthy estimate on the record → null, not 0
    expect(rows[1].bestE1rm).toBeNull()
  })

  it('leaves an unlogged exercise with no record at all', () => {
    expect(rows[2].record).toBeNull()
    expect(rows[2].bestE1rm).toBeNull()
    expect(rows[2].medalCount).toBe(0)
  })

  // The precedence rule, both directions.
  it('never substitutes a record carrying a DIFFERENT catalogId', () => {
    const rows2 = buildLibraryRows(
      [item({ id: 'l1', catalogId: 'c1', name: 'Bench Press', muscle: 'chest-mid' })],
      [record({ catalogId: 'c9', name: 'Bench Press' })],
      [medal({ catalogId: 'c9', exerciseName: 'Bench Press' })],
    )
    expect(rows2[0].record).toBeNull()
    expect(rows2[0].medalCount).toBe(0)
  })

  // A live record can be name-grouped (no catalogId) while its catalogue row has one
  // (mezo-u5gk) — dropping it would claim a logged exercise was never logged.
  it('attaches a name-grouped record (no catalogId) to a catalog-linked exercise', () => {
    const rows2 = buildLibraryRows(
      [item({ id: 'l1', catalogId: 'c1', name: 'Hip Thrust', muscle: 'glute' })],
      [record({ name: 'Hip Thrust', bestE1rm: { value: 160, set: { weightKg: 120, reps: 10, date: '2026-06-01' } } })],
      [medal({ exerciseName: 'Hip Thrust' })],
    )
    expect(rows2[0].bestE1rm).toBe(160)
    expect(rows2[0].medalCount).toBe(1)
  })

  it('counts medals on the same identity rule', () => {
    expect(rows.map((r) => r.medalCount)).toEqual([2, 1, 0])
  })

  it('labels the muscle in Hungarian and resolves its region', () => {
    expect(rows[0].muscleLabel).toBe('Mell (közép)')
    expect(rows[0].region).toBe('coral') // Mell
    expect(rows[1].region).toBe('rose') // Kar
  })
})

test('exerciseKey prefers the catalogId, else the catalogue row id', () => {
  expect(exerciseKey({ id: 'l1', catalogId: 'c1' })).toBe('c1')
  expect(exerciseKey({ id: 'l2' })).toBe('l2')
})

describe('libraryCounts', () => {
  it.each([
    ['a mixed catalogue', CATALOG, RECORDS, MEDALS, { total: 3, logged: 2, medals: 3 }],
    ['nothing logged yet', CATALOG, [], [], { total: 3, logged: 0, medals: 0 }],
    ['an empty catalogue', [], RECORDS, MEDALS, { total: 0, logged: 0, medals: 0 }],
  ] as const)('%s', (_name, catalog, records, medals, expected) => {
    expect(libraryCounts(buildLibraryRows(catalog, records, medals))).toEqual(expected)
  })
})

test('libraryRegions lists only the regions the catalogue actually has', () => {
  const regions = libraryRegions(buildLibraryRows(CATALOG, [], []))
  expect(regions.map((r) => r.key)).toEqual(['coral', 'rose', 'sage'])
  expect(regions.map((r) => r.count)).toEqual([1, 1, 1])
  expect(regions.map((r) => r.label)).toEqual(['Mell', 'Kar', 'Láb'])
  expect(libraryRegions([])).toEqual([])
})

test('foldAccents strips Hungarian accents and case', () => {
  expect(foldAccents('Bicepsz (hosszú fej)')).toBe('bicepsz (hosszu fej)')
  expect(foldAccents('Váll (oldalsó)')).toBe('vall (oldalso)')
  expect(foldAccents('Erőd íve ŰŐ')).toBe('erod ive uo')
})

describe('filterLibraryRows', () => {
  const rows = buildLibraryRows(CATALOG, RECORDS, MEDALS)
  it.each([
    ['an empty query keeps everything', '', null, ['Bench Press', 'Barbell Curl', 'Box Jump']],
    ['matches the name', 'bench', null, ['Bench Press']],
    ['matches the muscle label', 'bicepsz', null, ['Barbell Curl']],
    ['is accent-blind on the muscle label', 'hosszu', null, ['Barbell Curl']],
    ['is accent-blind on an accented query', 'kozep', null, ['Bench Press']],
    ['trims and ignores case', '  BARBELL ', null, ['Barbell Curl']],
    ['no match is an empty list', 'zzz', null, []],
    ['a region chip filters by region', '', 'coral', ['Bench Press']],
    ['region and query combine', 'b', 'sage', ['Box Jump']],
    ['a region with nothing matching is empty', 'bench', 'sage', []],
  ] as const)('%s', (_name, query, region, expected) => {
    expect(filterLibraryRows(rows, query, region).map((r) => r.name)).toEqual(expected)
  })
})

// ── the exercise STORY's derivations (Train parity P2 Task 5, mezo-lf3cv) ──────────────

describe('medalsForExercise', () => {
  it('keeps only THIS exercise’s medals, newest first', () => {
    const medals = [
      medal({ catalogId: 'c1', exerciseName: 'Bench Press', date: '2026-07-01' }),
      medal({ catalogId: 'c1', exerciseName: 'Bench Press', date: '2026-09-01', type: 'WEIGHT' }),
      medal({ exerciseName: 'Barbell Curl', date: '2026-08-01' }),
    ]
    const rows = buildLibraryRows(CATALOG, RECORDS, medals)
    const bench = rows.find((r) => r.name === 'Bench Press')!
    expect(medalsForExercise(medals, bench).map((m) => m.date)).toEqual(['2026-09-01', '2026-07-01'])
  })

  it('a name-grouped medal still reaches its catalog-linked row', () => {
    const medals = [medal({ exerciseName: 'Bench Press', date: '2026-09-02' })]
    const bench = buildLibraryRows(CATALOG, RECORDS, medals).find((r) => r.name === 'Bench Press')!
    expect(medalsForExercise(medals, bench)).toHaveLength(1)
  })

  it('an exercise with no medals answers an empty list, not a guess', () => {
    const box = buildLibraryRows(CATALOG, RECORDS, MEDALS).find((r) => r.name === 'Box Jump')!
    expect(medalsForExercise(MEDALS, box)).toEqual([])
  })
})

describe('firstSeenDate', () => {
  it('prefers the oldest e1RM point', () => {
    expect(firstSeenDate(record({
      name: 'X',
      bestSet: { weightKg: 60, reps: 8, date: '2026-08-01' },
      e1rmSeries: [{ date: '2026-03-04', e1rm: 70 }, { date: '2026-08-01', e1rm: 80 }],
    }))).toBe('2026-03-04')
  })

  it('falls back to the oldest dated set ref when there is no series', () => {
    expect(firstSeenDate(record({
      name: 'X',
      bestSet: { weightKg: 60, reps: 8, date: '2026-08-01' },
      repRecords: [{ weightKg: 55, reps: 10, date: '2026-05-09' }],
      recentTopSets: [{ weightKg: 60, reps: 8, date: '2026-08-01' }],
    }))).toBe('2026-05-09')
  })

  it('is null when the row dates nothing at all', () => {
    expect(firstSeenDate(record({ name: 'X' }))).toBeNull()
  })
})

describe('sinceFact', () => {
  // The series is capped on the wire (52 points), so an absolute „óta" is only honest when
  // the series covers the whole history — `sessionCount` is the tell.
  const series = (n: number) => Array.from({ length: n }, (_, i) => ({ date: `2026-0${1 + (i % 9)}-0${1 + (i % 9)}`, e1rm: 100 + i }))
  const cases: Array<[string, ExerciseRecordResponse, ReturnType<typeof sinceFact>]> = [
    ['series covers every session → the absolute date',
      record({ name: 'X', sessionCount: 3, e1rmSeries: [{ date: '2025-09-03', e1rm: 90 }, { date: '2026-01-02', e1rm: 95 }, { date: '2026-06-02', e1rm: 100 }] }),
      { kind: 'since', date: '2025-09-03' }],
    ['more sessions than points → the window, named by its point count',
      record({ name: 'X', sessionCount: 26, e1rmSeries: series(6) }),
      { kind: 'window', sessions: 6 }],
    ['one session more than points is already a window',
      record({ name: 'X', sessionCount: 4, e1rmSeries: series(3) }),
      { kind: 'window', sessions: 3 }],
    ['no series at all (a bodyweight row) keeps the dated-ref fallback',
      record({ name: 'X', sessionCount: 6, bestSet: { weightKg: 0, reps: 10, date: '2026-05-26' } }),
      { kind: 'since', date: '2026-05-26' }],
    ['nothing dated at all → null', record({ name: 'X', sessionCount: 0 }), null],
  ]
  it.each(cases)('%s', (_label, rec, expected) => {
    expect(sinceFact(rec)).toEqual(expected)
  })
})

describe('nextTarget', () => {
  it('is the same load with one more rep', () => {
    expect(nextTarget(record({ name: 'X', bestSet: { weightKg: 102.5, reps: 9, date: '2026-06-02' } })))
      .toEqual({ kg: 102.5, reps: 10, note: 'ugyanaz a súly, egy ismétléssel több' })
  })

  it('a bodyweight best set keeps the rep step and drops the kg', () => {
    expect(nextTarget(record({ name: 'X', bestSet: { reps: 22, date: '2026-06-02' } })))
      .toEqual({ kg: null, reps: 23, note: 'ugyanaz a mozdulat, egy ismétléssel több' })
    // A live-backend bodyweight row carries weightKg 0 rather than omitting it.
    expect(nextTarget(record({ name: 'X', bestSet: { weightKg: 0, reps: 35, date: '2026-06-02' } }))?.kg).toBeNull()
  })

  it('is null without a best set — there is nothing to step past', () => {
    expect(nextTarget(record({ name: 'X' }))).toBeNull()
  })
})

describe('whereUsed', () => {
  const planned = (name: string, catalogId?: string) => ({ name, ...(catalogId ? { catalogId } : {}) })
  const meso = {
    id: 'm1',
    templateId: 't-active',
    days: [
      { day: 'Csü', type: 'Pull Day', exercises: [planned('Bench Press', 'c1'), planned('Barbell Curl')] },
      { day: 'Vas', type: 'Rest', exercises: [] },
    ],
  }
  const templates = [
    { id: 't-active', title: 'A futó terv sablonja', days: [{ exercises: [planned('Bench Press', 'c1')] }] },
    { id: 't-shelf', title: 'Nyári tömegelés', days: [{ exercises: [planned('Bench Press', 'c1')] }] },
    { id: 't-other', title: 'Lábnap', days: [{ exercises: [planned('Box Jump', 'c3')] }] },
  ]
  const rows = buildLibraryRows(CATALOG, RECORDS, MEDALS)
  const bench = rows.find((r) => r.name === 'Bench Press')!
  const curl = rows.find((r) => r.name === 'Barbell Curl')!
  const box = rows.find((r) => r.name === 'Box Jump')!

  it('lists the running plan’s days that prescribe it', () => {
    expect(whereUsed(bench, meso, templates).days).toEqual([{ mesoId: 'm1', day: 'Csü', type: 'Pull Day' }])
  })

  it('excludes the template the running plan was started FROM (it is the same week)', () => {
    expect(whereUsed(bench, meso, templates).templates).toEqual([{ id: 't-shelf', name: 'Nyári tömegelés' }])
  })

  it('keeps that template when no run came from it', () => {
    expect(whereUsed(bench, { ...meso, templateId: null }, templates).templates.map((t) => t.id))
      .toEqual(['t-active', 't-shelf'])
  })

  it('matches a name-grouped plan row too', () => {
    expect(whereUsed(curl, meso, templates).days.map((d) => d.day)).toEqual(['Csü'])
  })

  it('a miss is an empty result, never a near match', () => {
    expect(whereUsed(box, meso, templates)).toEqual({ days: [], templates: [{ id: 't-other', name: 'Lábnap' }] })
    expect(whereUsed(bench, null, [])).toEqual({ days: [], templates: [] })
  })
})
