import { describe, expect, it, test } from 'vitest'
import {
  buildLibraryRows, exerciseKey, filterLibraryRows, foldAccents, libraryCounts, libraryRegions,
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
