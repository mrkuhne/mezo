import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'
import {
  gymSegments, prepSegments, selectGymRows, selectPrepRows, weekZoneRows,
} from '@/features/train/logic/weekZone'

const ex = (muscle: string, workingSets: number, targetRIR: number): GymExercise => ({
  id: `${muscle}-${workingSets}-${targetRIR}`, name: 'X', muscle,
  warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR, type: 'compound',
})
const day = (dayKey: string, exercises: GymExercise[]): MesoDay =>
  ({ day: dayKey, type: 'Push', muscle: 'chest', exerciseCount: exercises.length, exercises })

// Minimal completed-instance builder. `sets` are logged working sets; rir per set.
let uid = 0
const detail = (exs: { muscle: string; type?: 'compound' | 'isolation' | 'plyo'; targetRIR?: number; setRirs: (number | undefined)[]; skippedSets?: number }[]): WorkoutDetailResponse => ({
  id: `w-${uid++}`, templateSessionId: 't1', date: '2026-08-03', status: 'completed',
  title: 'Push Day', dayLabel: 'Hét',
  exercises: exs.map((e, i) => ({
    exerciseId: `e-${i}`, name: 'X', muscle: e.muscle, type: e.type ?? 'compound',
    warmupSets: 1, workingSets: e.setRirs.length, repMin: 8, repMax: 10,
    targetRIR: e.targetRIR ?? 2, skipped: false,
    sets: [
      ...e.setRirs.map((rir, j) => ({ id: `s-${i}-${j}`, exerciseId: `e-${i}`, setIndex: j, reps: 8, skipped: false, kind: 'working' as const, ...(rir === undefined ? {} : { rir }) })),
      ...Array.from({ length: e.skippedSets ?? 0 }, (_, j) => ({ id: `sk-${i}-${j}`, exerciseId: `e-${i}`, setIndex: 90 + j, skipped: true })),
    ],
  })),
}) as WorkoutDetailResponse

describe('weekZoneRows — done aggregation', () => {
  it('prices each logged set by its own RIR, falling back to the exercise targetRIR', () => {
    // 2 sets at RIR 0 (failure, 1/12 each) + 1 set at RIR 3 (volume, 1/20) + 1 set without rir → exercise targetRIR 2 → volume
    const rows = weekZoneRows({ plannedDays: [], completed: [detail([{ muscle: 'chest', targetRIR: 2, setRirs: [0, 0, 3, undefined] }])] })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ group: 'chest', doneSets: 4 })
    expect(rows[0].doneBudget).toBeCloseTo(2 / 12 + 2 / 20)
  })
  it('ignores skip-marker rows and plyo exercises', () => {
    const rows = weekZoneRows({
      plannedDays: [],
      completed: [detail([
        { muscle: 'quad', setRirs: [1, 1], skippedSets: 3 },
        { muscle: 'quad', type: 'plyo', setRirs: [0, 0, 0] },
      ])],
    })
    expect(rows[0]).toMatchObject({ group: 'quad', doneSets: 2 })
  })
  it('counts custom-workout sets toward the group like any other instance', () => {
    const rows = weekZoneRows({ plannedDays: [], completed: [detail([{ muscle: 'biceps-long', setRirs: [1] }]), detail([{ muscle: 'biceps', setRirs: [1] }])] })
    expect(rows[0]).toMatchObject({ group: 'biceps', doneSets: 2 })
  })
})

describe('weekZoneRows — status boundaries', () => {
  const planned = [day('Hét', [ex('chest-mid', 5, 2)]), day('Csü', [ex('chest-mid', 5, 2)])]
  it('entering exactly when today reaches the MEV floor (chest MEV 4)', () => {
    const todayPlan = [{ muscle: 'chest-mid', type: 'compound' as const, workingSets: 3, targetRIR: 2 }]
    const below = weekZoneRows({ plannedDays: planned, completed: [detail([{ muscle: 'chest', setRirs: [] }])], todayPlan: [{ ...todayPlan[0], workingSets: 3 }] })
    expect(below[0].status).toBe('below') // 0 done + 3 today < 4
    const entering = weekZoneRows({ plannedDays: planned, completed: [detail([{ muscle: 'chest', setRirs: [2] }])], todayPlan })
    expect(entering[0].status).toBe('entering') // 1 done + 3 today = 4
  })
  it('in once done alone reaches MEV; over past 100% budget', () => {
    const inRow = weekZoneRows({ plannedDays: planned, completed: [detail([{ muscle: 'chest', setRirs: [2, 2, 2, 2] }])] })
    expect(inRow[0].status).toBe('in')
    const overRow = weekZoneRows({
      plannedDays: planned,
      completed: [detail([{ muscle: 'chest', setRirs: Array.from({ length: 11 }, () => 0) }])], // 11/12
      todayPlan: [{ muscle: 'chest-mid', type: 'compound', workingSets: 4, targetRIR: 0 }], // +4/12 → 1.25
    })
    expect(overRow[0].status).toBe('over')
  })
  it('traps/core never report below/entering', () => {
    const rows = weekZoneRows({ plannedDays: [day('Hét', [ex('traps', 2, 2)])], completed: [], todayPlan: [{ muscle: 'traps', type: 'isolation', workingSets: 2, targetRIR: 2 }] })
    expect(rows[0]).toMatchObject({ group: 'traps', mev: null, zoneStart: null, status: 'in' })
  })
})

describe('weekZoneRows — zone projection reference', () => {
  it('uses the weekly plan mix when a plan exists (chest 10 volume sets planned, MEV 4 → 20%)', () => {
    const rows = weekZoneRows({ plannedDays: [day('Hét', [ex('chest-mid', 10, 2)])], completed: [] })
    expect(rows[0].zoneStart).toBeCloseTo((10 / 20) * 4 / 10)
  })
  it('falls back to done+today mix for plan-less (custom-only) groups', () => {
    const rows = weekZoneRows({ plannedDays: [], completed: [detail([{ muscle: 'chest', setRirs: [0, 0, 0, 0, 0] }])] })
    expect(rows[0].zoneStart).toBeCloseTo((5 / 12) * 4 / 5) // pure failure mix
  })
})

describe('row selection', () => {
  const planned = [day('Hét', [ex('chest-mid', 6, 2), ex('quad', 4, 2)])]
  const todayPlan = [{ muscle: 'chest-mid', type: 'compound' as const, workingSets: 6, targetRIR: 2 }]
  it('selectPrepRows keeps only groups trained today, ordered by today contribution', () => {
    const rows = selectPrepRows(weekZoneRows({ plannedDays: planned, completed: [], todayPlan }))
    expect(rows.map((r) => r.group)).toEqual(['chest'])
  })
  it('selectGymRows keeps planned OR done groups, ordered by plan budget desc', () => {
    const rows = selectGymRows(weekZoneRows({ plannedDays: planned, completed: [detail([{ muscle: 'biceps', setRirs: [1] }])] }))
    expect(rows.map((r) => r.group)).toEqual(['chest', 'quad', 'biceps'])
  })
})

describe('segments', () => {
  it('prepSegments: done solid + today dashed + plan ghost, widths in budget units', () => {
    const rows = weekZoneRows({
      plannedDays: [day('Hét', [ex('chest-mid', 5, 2)]), day('Csü', [ex('chest-mid', 5, 2)])],
      completed: [detail([{ muscle: 'chest', setRirs: [2, 2, 2, 2, 2] }])],
      todayPlan: [{ muscle: 'chest-mid', type: 'compound', workingSets: 5, targetRIR: 2 }],
    })
    expect(prepSegments(rows[0])).toEqual([
      { pct: expect.closeTo(0.25, 5), kind: 'solid' },
      { pct: expect.closeTo(0.25, 5), kind: 'today' },
    ])
  })
  it('prepSegments: the today segment turns overflow and everything caps at 100% when over', () => {
    const rows = weekZoneRows({
      plannedDays: [],
      completed: [detail([{ muscle: 'chest', setRirs: Array.from({ length: 11 }, () => 0) }])],
      todayPlan: [{ muscle: 'chest-mid', type: 'compound', workingSets: 4, targetRIR: 0 }],
    })
    const segs = prepSegments(rows[0])
    expect(segs[0]).toEqual({ pct: expect.closeTo(11 / 12, 5), kind: 'solid' })
    expect(segs[1].kind).toBe('overflow')
    expect(segs[0].pct + segs[1].pct).toBeCloseTo(1)
  })
  it('gymSegments: done solid + plan-remainder ghost, no today segment', () => {
    const rows = weekZoneRows({
      plannedDays: [day('Hét', [ex('chest-mid', 5, 2)]), day('Csü', [ex('chest-mid', 5, 2)])],
      completed: [detail([{ muscle: 'chest', setRirs: [2, 2, 2, 2, 2] }])],
    })
    expect(gymSegments(rows[0])).toEqual([
      { pct: expect.closeTo(0.25, 5), kind: 'solid' },
      { pct: expect.closeTo(0.25, 5), kind: 'ghost' },
    ])
  })
})
