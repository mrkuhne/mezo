import { describe, expect, it } from 'vitest'
import { deriveSummaryStats, type SummaryExerciseInput } from '@/features/train/logic/summaryStats'
import type { Medal } from '@/data/train/medalTypes'

const ex = (over: Partial<SummaryExerciseInput>): SummaryExerciseInput => ({
  id: 'x', name: 'Ex', muscle: 'back-wide', plannedSets: 3,
  sets: [], skipped: false, ...over,
})
const recordMedal = (over: Partial<Medal>): Medal => ({
  type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Row', date: '2026-08-04',
  value: 70, unit: 'KG', weightKg: 70, reps: 8, previousValue: 67.5, ...over,
})
const targetMedal = (name: string, setIndex: number): Medal => ({
  type: 'TARGET_HIT', tier: 'TARGET', exerciseName: name, date: '2026-08-04',
  setIndex, value: 8, unit: 'REPS', weightKg: 60, reps: 8, previousValue: null,
})

describe('deriveSummaryStats', () => {
  const exercises: SummaryExerciseInput[] = [
    ex({ id: 'a', name: 'Row', muscle: 'back-mid', plannedSets: 4,
      sets: [{ weight: 65, reps: 10, rir: 2 }, { weight: 65, reps: 10, rir: 2 }, { weight: 70, reps: 8, rir: 1 }, { weight: 70, reps: 7, rir: 1 }] }),
    ex({ id: 'b', name: 'Lat pulldown', muscle: 'back-wide', plannedSets: 4,
      sets: [{ weight: 60, reps: 12, rir: 3 }, { weight: 60, reps: 11, rir: 2 }, { weight: 60, reps: 10, rir: 2 }] }),
    ex({ id: 'c', name: 'Face pull', muscle: 'shoulder-rear', plannedSets: 3,
      sets: [{ weight: 25, reps: 15, rir: 2 }, { weight: 25, reps: 15, rir: 2 }, { weight: 25, reps: 15, rir: 1 }] }),
    ex({ id: 'd', name: 'Cable crunch', muscle: 'core', plannedSets: 3, sets: [], skipped: true }),
  ]

  it('totals: sets, exercises, volume, avgRir', () => {
    const s = deriveSummaryStats(exercises, [])
    expect(s.doneSets).toBe(10)
    expect(s.plannedSets).toBe(14)
    expect(s.doneEx).toBe(3)
    expect(s.totalEx).toBe(4)
    // 650+650+560+490 + 720+660+600 + 375+375+375 = 5455 kg
    expect(s.volumeT).toBeCloseTo(5.455, 3)
    expect(s.avgRir).toBe(1.8) // (2+2+1+1+3+2+2+2+2+1)/10 = 1.8
  })

  it('avgRir is null with zero logged sets', () => {
    expect(deriveSummaryStats([ex({ sets: [] })], []).avgRir).toBeNull()
  })

  it('avgRir excludes null-rir sets (warmups) from the average', () => {
    const s = deriveSummaryStats([
      ex({ sets: [{ weight: 60, reps: 10, rir: null }, { weight: 80, reps: 8, rir: 2 }, { weight: 80, reps: 8, rir: 2 }] }),
    ], [])
    expect(s.avgRir).toBe(2) // the null-rir warmup is excluded, not averaged as 0
  })

  it('avgRir is null when every logged set has a null rir', () => {
    const s = deriveSummaryStats([
      ex({ sets: [{ weight: 60, reps: 10, rir: null }, { weight: 60, reps: 10, rir: null }] }),
    ], [])
    expect(s.avgRir).toBeNull()
  })

  it('regions: aggregated, sorted by done sets, off region last + unknown muscle skipped', () => {
    const s = deriveSummaryStats([...exercises, ex({ id: 'e', name: 'Mystery', muscle: 'not-a-muscle', sets: [{ weight: 1, reps: 1, rir: 0 }] })], [])
    expect(s.regions).toEqual([
      { region: 'sky', label: 'Hát', sets: 7, off: false },
      { region: 'lav', label: 'Váll', sets: 3, off: false },
      { region: 'amber', label: 'Core', sets: 0, off: true },
    ])
  })

  it('record chip: setIndex match wins', () => {
    const s = deriveSummaryStats(exercises, [recordMedal({ setIndex: 2 })])
    const row = s.exercises.find((e) => e.name === 'Row')!
    expect(row.chips.map((c) => c.record)).toEqual([false, false, true, false])
    expect(row.chips.map((c) => c.top)).toEqual([false, false, false, false]) // top === record → suppressed
  })

  it('record chip: null setIndex falls back to first weight+reps match', () => {
    const s = deriveSummaryStats(exercises, [recordMedal({ setIndex: null })])
    expect(s.exercises.find((e) => e.name === 'Row')!.chips[2].record).toBe(true)
  })

  it('record with no matching set still lands in records[] without a chip', () => {
    const s = deriveSummaryStats(exercises, [recordMedal({ setIndex: 9, weightKg: null, reps: null })])
    expect(s.records).toHaveLength(1)
    expect(s.exercises.flatMap((e) => e.chips).some((c) => c.record)).toBe(false)
  })

  it('top chip: heaviest set, tie broken by reps', () => {
    const s = deriveSummaryStats(exercises, [])
    const lat = s.exercises.find((e) => e.name === 'Lat pulldown')!
    expect(lat.chips.map((c) => c.top)).toEqual([true, false, false])
    expect(lat.partial).toBe(true)
    expect(lat.missing).toBe(1)
    const row = s.exercises.find((e) => e.name === 'Row')!
    expect(row.chips.map((c) => c.top)).toEqual([false, false, true, false]) // 70×8 beats 70×7
  })

  it('abandoned exercise: no chips, flagged', () => {
    const s = deriveSummaryStats(exercises, [])
    const dead = s.exercises.find((e) => e.name === 'Cable crunch')!
    expect(dead.abandoned).toBe(true)
    expect(dead.chips).toEqual([])
  })

  it('threads the skipped flag through to the exercise view', () => {
    const s = deriveSummaryStats([
      ex({ id: 'p', name: 'Partial', sets: [{ weight: 40, reps: 10, rir: 2 }], plannedSets: 3, skipped: true }),
      ex({ id: 'q', name: 'Full', sets: [{ weight: 40, reps: 10, rir: 2 }], plannedSets: 1, skipped: false }),
    ], [])
    expect(s.exercises.find((e) => e.id === 'p')!.skipped).toBe(true)
    expect(s.exercises.find((e) => e.id === 'q')!.skipped).toBe(false)
  })

  it('target groups: counted per exercise, count desc, targetCount totals', () => {
    const s = deriveSummaryStats(exercises, [
      targetMedal('Face pull', 0), targetMedal('Row', 0), targetMedal('Row', 1), recordMedal({ setIndex: 2 }),
    ])
    expect(s.targetGroups).toEqual([
      { exerciseName: 'Row', count: 2 },
      { exerciseName: 'Face pull', count: 1 },
    ])
    expect(s.targetCount).toBe(3)
    expect(s.records).toHaveLength(1)
  })
})
