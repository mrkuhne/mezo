import { describe, expect, it } from 'vitest'
import type { LoggedWorkoutExercise } from '@/data/types'
import {
  avgWorkingRir,
  exerciseTonnage,
  sessionProgressSegments,
  setStatus,
  topSetDeltaPct,
  warmupPctLabel,
} from '@/features/train/logic/workoutCardMeta'

// --- Fixtures --------------------------------------------------------------
const baseExercise: LoggedWorkoutExercise = {
  id: 'ex1', name: 'Leg Press', muscle: 'quad', type: 'compound',
  warmupSets: 1, workingSets: 3, repMin: 8, repMax: 12, targetRIR: 2,
  anchorWeightKg: 24, sets: 4,
  prescribedSets: [
    { kind: 'warmup', targetWeightKg: 20, targetReps: 12, targetRIR: null },
    { kind: 'working', targetWeightKg: 26, targetReps: 10, targetRIR: 2 },
    { kind: 'working', targetWeightKg: 26, targetReps: 10, targetRIR: 2 },
    { kind: 'working', targetWeightKg: 26, targetReps: 10, targetRIR: 2 },
  ],
  rationale: null,
  lastWeek: null,
}

describe('warmupPctLabel', () => {
  it('formats B{i+1} = {pct}% · {kg} from warmup vs first working target', () => {
    // 20/26 × 100 = 76.92 → round 77
    expect(warmupPctLabel(baseExercise, 0)).toBe('B1 = 77% · 20')
  })
  it('rounds down when the fraction lands below .5', () => {
    const ex: LoggedWorkoutExercise = {
      ...baseExercise,
      prescribedSets: [
        { kind: 'warmup', targetWeightKg: 24, targetReps: 12, targetRIR: null },
        { kind: 'working', targetWeightKg: 50, targetReps: 10, targetRIR: 2 },
      ],
    }
    // 24/50 × 100 = 48 → 48 (exact, no rounding surprise)
    expect(warmupPctLabel(ex, 0)).toBe('B1 = 48% · 24')
  })
  it('null when prescribedSets is null', () => {
    expect(warmupPctLabel({ ...baseExercise, prescribedSets: null }, 0)).toBeNull()
  })
  it('null when warmupIdx is out of range', () => {
    expect(warmupPctLabel(baseExercise, 9)).toBeNull()
  })
  it('null when the row at warmupIdx is not a warmup', () => {
    expect(warmupPctLabel(baseExercise, 1)).toBeNull() // index 1 is a 'working' row
  })
  it('null when the warmup target weight is missing', () => {
    const ex: LoggedWorkoutExercise = {
      ...baseExercise,
      prescribedSets: [
        { kind: 'warmup', targetWeightKg: null, targetReps: 12, targetRIR: null },
        { kind: 'working', targetWeightKg: 26, targetReps: 10, targetRIR: 2 },
      ],
    }
    expect(warmupPctLabel(ex, 0)).toBeNull()
  })
  it('null when no working row has a target weight', () => {
    const ex: LoggedWorkoutExercise = {
      ...baseExercise,
      prescribedSets: [
        { kind: 'warmup', targetWeightKg: 20, targetReps: 12, targetRIR: null },
        { kind: 'working', targetWeightKg: null, targetReps: 10, targetRIR: 2 },
      ],
    }
    expect(warmupPctLabel(ex, 0)).toBeNull()
  })
  it('skips a leading working row without a target to find the first with one', () => {
    const ex: LoggedWorkoutExercise = {
      ...baseExercise,
      prescribedSets: [
        { kind: 'warmup', targetWeightKg: 25, targetReps: 12, targetRIR: null },
        { kind: 'working', targetWeightKg: null, targetReps: 10, targetRIR: 2 },
        { kind: 'working', targetWeightKg: 50, targetReps: 10, targetRIR: 2 },
      ],
    }
    expect(warmupPctLabel(ex, 0)).toBe('B1 = 50% · 25')
  })
})

describe('setStatus', () => {
  const ex = { repMin: 8, repMax: 12 }
  it('is ok exactly at repMin and repMax boundaries', () => {
    expect(setStatus(ex, { reps: 8, kind: 'working' })).toBe('ok')
    expect(setStatus(ex, { reps: 12, kind: 'working' })).toBe('ok')
  })
  it('is ok strictly inside the range', () => {
    expect(setStatus(ex, { reps: 10, kind: 'working' })).toBe('ok')
  })
  it('is below under repMin', () => {
    expect(setStatus(ex, { reps: 7, kind: 'working' })).toBe('below')
  })
  it('is above over repMax', () => {
    expect(setStatus(ex, { reps: 13, kind: 'working' })).toBe('above')
  })
  it('warmups are always ok regardless of reps', () => {
    expect(setStatus(ex, { reps: 20, kind: 'warmup' })).toBe('ok')
    expect(setStatus(ex, { reps: 1, kind: 'warmup' })).toBe('ok')
  })
})

describe('exerciseTonnage', () => {
  it('sums weight × reps across all logged sets', () => {
    const sets = [
      { weightKg: 20, reps: 10 },
      { weightKg: 26, reps: 8 },
    ]
    expect(exerciseTonnage(sets)).toBe(20 * 10 + 26 * 8)
  })
  it('skips rows marked skipped', () => {
    const sets = [
      { weightKg: 20, reps: 10 },
      { weightKg: 26, reps: 8, skipped: true },
    ]
    expect(exerciseTonnage(sets)).toBe(20 * 10)
  })
  it('skips rows with a null weight', () => {
    const sets = [
      { weightKg: 20, reps: 10 },
      { weightKg: null, reps: 8 },
    ]
    expect(exerciseTonnage(sets)).toBe(20 * 10)
  })
  it('is 0 for an empty set list', () => {
    expect(exerciseTonnage([])).toBe(0)
  })
})

describe('topSetDeltaPct', () => {
  it('computes rounded percent delta from the max logged working weight', () => {
    const sets = [
      { weightKg: 24, kind: 'working' as const },
      { weightKg: 26, kind: 'working' as const },
    ]
    // (26 - 20) / 20 × 100 = 30
    expect(topSetDeltaPct(sets, 20)).toBe(30)
  })
  it('rounds a fractional delta', () => {
    const sets = [{ weightKg: 27, kind: 'working' as const }]
    // (27 - 25) / 25 × 100 = 8
    expect(topSetDeltaPct(sets, 25)).toBe(8)
  })
  it('ignores warmup and skipped rows when finding the top working set', () => {
    const sets = [
      { weightKg: 100, kind: 'warmup' as const },
      { weightKg: 90, kind: 'working' as const, skipped: true },
      { weightKg: 22, kind: 'working' as const },
    ]
    // top real working weight is 22, not the warmup 100 or the skipped 90
    expect(topSetDeltaPct(sets, 20)).toBe(10)
  })
  it('null when lastWeekWeightKg is null', () => {
    expect(topSetDeltaPct([{ weightKg: 26, kind: 'working' as const }], null)).toBeNull()
  })
  it('null when lastWeekWeightKg is undefined', () => {
    expect(topSetDeltaPct([{ weightKg: 26, kind: 'working' as const }], undefined)).toBeNull()
  })
  it('null when there is no logged working set', () => {
    expect(topSetDeltaPct([{ weightKg: 26, kind: 'warmup' as const }], 20)).toBeNull()
  })
  it('null when the only working rows are skipped or weightless', () => {
    const sets = [
      { weightKg: 26, kind: 'working' as const, skipped: true },
      { weightKg: null, kind: 'working' as const },
    ]
    expect(topSetDeltaPct(sets, 20)).toBeNull()
  })
})

describe('avgWorkingRir', () => {
  it('averages rir across working sets to 1 decimal', () => {
    const sets = [
      { rir: 2, kind: 'working' },
      { rir: 2, kind: 'working' },
      { rir: 3, kind: 'working' },
    ]
    // (2+2+3)/3 = 2.333... → 2.3
    expect(avgWorkingRir(sets)).toBe(2.3)
  })
  it('excludes warmup rows and null rir', () => {
    const sets = [
      { rir: 5, kind: 'warmup' },
      { rir: 2, kind: 'working' },
      { rir: null, kind: 'working' },
    ]
    expect(avgWorkingRir(sets)).toBe(2)
  })
  it('null when there is no working rir', () => {
    expect(avgWorkingRir([{ rir: 5, kind: 'warmup' }])).toBeNull()
    expect(avgWorkingRir([{ rir: null, kind: 'working' }])).toBeNull()
    expect(avgWorkingRir([])).toBeNull()
  })
})

describe('sessionProgressSegments', () => {
  const exA: LoggedWorkoutExercise = { ...baseExercise, id: 'a', muscle: 'quad', warmupSets: 1, workingSets: 3 }
  const exB: LoggedWorkoutExercise = { ...baseExercise, id: 'b', muscle: 'chest-mid', warmupSets: 0, workingSets: 4 }
  const exC: LoggedWorkoutExercise = { ...baseExercise, id: 'c', muscle: 'back-wide', warmupSets: 2, workingSets: 0 }

  it('marks state done/current/upcoming and derives weight + colorMuscle', () => {
    const doneMap = (exId: string) => exId === 'a'
    const segs = sessionProgressSegments([exA, exB, exC], 1, doneMap)
    expect(segs).toEqual([
      { colorMuscle: 'quad', weight: 4, state: 'done' },
      { colorMuscle: 'chest-mid', weight: 4, state: 'current' },
      { colorMuscle: 'back-wide', weight: 2, state: 'upcoming' },
    ])
  })
  it('done takes priority over currentIdx match', () => {
    const doneMap = (exId: string) => exId === 'b'
    const segs = sessionProgressSegments([exA, exB], 1, doneMap)
    expect(segs[1].state).toBe('done')
  })
  it('floors weight at 1 when warmup + working sets are both 0', () => {
    const zero: LoggedWorkoutExercise = { ...baseExercise, id: 'z', warmupSets: 0, workingSets: 0 }
    const segs = sessionProgressSegments([zero], 0, () => false)
    expect(segs[0].weight).toBe(1)
  })
  it('empty exercises yields empty segments', () => {
    expect(sessionProgressSegments([], 0, () => false)).toEqual([])
  })
})
