import { describe, expect, it } from 'vitest'
import type { GymExercise, LoggedWorkoutExercise, MesoDay, WorkoutPlan } from '@/data/types'
import type { SkillLevel } from '@/data/progression/progressionApi'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import {
  identityKeyOf,
  oneRmByIdentity,
  prepForecast,
  prepStats,
  pseudoDayFromPlan,
  startWeightOf,
} from '@/features/train/logic/prepBriefing'

// --- WorkoutPlan fixture: 2 exercises — one with prescribedSets (1 warmup + 3 working
// @ 26 kg — today's bumped target, deliberately ≠ anchorWeightKg 24 to prove
// pseudoDayFromPlan's anchor and startWeightOf's pill are independently sourced),
// one plyo without prescriptions (plyo/switch-off exercises carry none). ---
const anchoredExercise: LoggedWorkoutExercise = {
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
const plyoExercise: LoggedWorkoutExercise = {
  id: 'ex2', name: 'Box Jump', muscle: 'quad', type: 'plyo',
  warmupSets: 0, workingSets: 3, repMin: 4, repMax: 6, targetRIR: 3,
  anchorWeightKg: null, sets: 3,
  prescribedSets: null,
  rationale: null,
  lastWeek: null,
}
const plan: WorkoutPlan = {
  title: 'Leg Day', tag: 'Nyaki', durationEst: 45, challenges: [],
  exercises: [anchoredExercise, plyoExercise],
}

describe('prepStats', () => {
  it('sums working sets, warmup sets, reps estimate and distinct muscles', () => {
    // workSets = e.workingSets: 3+3=6; warmupSets = e.warmupSets: 1+0=1;
    // repsEst = 3×round((8+12)/2)=30 + 3×round((4+6)/2)=15 → 45; muscleCount = {quad} → 1.
    const s = prepStats(plan)
    expect(s).toEqual({ workSets: 6, warmupSets: 1, repsEst: 45, durationEst: 45, muscleCount: 1 })
  })

  it('excludes empty and "sport" muscles from muscleCount but counts other distinct ones', () => {
    const extra: WorkoutPlan = {
      ...plan,
      exercises: [
        anchoredExercise,
        { ...plyoExercise, id: 'e2', muscle: 'sport' },
        { ...plyoExercise, id: 'e3', muscle: '' },
        { ...plyoExercise, id: 'e4', muscle: 'back' },
      ],
    }
    expect(prepStats(extra).muscleCount).toBe(2) // quad + back
  })
})

describe('pseudoDayFromPlan', () => {
  it('wraps the plan as a single MesoDay, passing through warmup/working sets and the exercise anchorWeightKg', () => {
    const d = pseudoDayFromPlan(plan)
    expect(d.day).toBe('')
    expect(d.type).toBe('Leg Day')
    expect(d.muscle).toBe('')
    expect(d.exerciseCount).toBe(2)
    expect(d.exercises).toEqual<GymExercise[]>([
      {
        // anchorWeightKg 24 = e.anchorWeightKg (the established anchor), NOT the
        // prescribedSets working target of 26 (that's startWeightOf's TODAY pill).
        id: 'ex1', name: 'Leg Press', muscle: 'quad',
        warmupSets: 1, workingSets: 3, repMin: 8, repMax: 12, targetRIR: 2,
        type: 'compound', anchorWeightKg: 24,
      },
      {
        id: 'ex2', name: 'Box Jump', muscle: 'quad',
        warmupSets: 0, workingSets: 3, repMin: 4, repMax: 6, targetRIR: 3,
        type: 'plyo', anchorWeightKg: null,
      },
    ])
  })
})

// --- prepForecast: reuses growthForecast.test.ts's fixture idiom + its already-verified
// chest/3×(8-12)@100kg numbers (muscleXp.chest=300, max_strength=266, strength_endurance=24). ---
let n = 0
const gymEx = (muscle: string, workingSets: number, over: Partial<GymExercise> = {}): GymExercise => ({
  id: `ex-${n++}`, name: `${muscle}-${n}`, muscle, warmupSets: 1, workingSets,
  repMin: 8, repMax: 12, targetRIR: 2, type: 'compound', ...over,
})
const mesoDay = (exercises: GymExercise[]): MesoDay => ({
  day: '', type: 'Prep Day', muscle: '', exerciseCount: exercises.length, exercises,
})
const skillLevel = (skillKey: string, level: number, cumulativeXp: number): SkillLevel => ({
  skillKey, kind: 'ATHLETIC', level, cumulativeXp, progressPct: 50,
})

describe('prepForecast', () => {
  it('aggregates totalXp and flags willLevelUp near threshold, sorted top-3', () => {
    const day = mesoDay([gymEx('chest', 3, { anchorWeightKg: 100 })])
    // strength_endurance Lv1 @80 XP: threshold(2)=100 → +24 = 104 flips.
    // max_strength Lv10 @0 XP: threshold(11)=round(100*10^1.6)=3981 → +266 doesn't flip.
    const f = prepForecast(day, [skillLevel('strength_endurance', 1, 80), skillLevel('max_strength', 10, 0)])
    expect(f.totalXp).toBe(300 + 266 + 24) // muscleXp.chest + max_strength + strength_endurance
    expect(f.skills.length).toBeLessThanOrEqual(3)
    expect(f.skills.map((s) => s.skillKey)).toEqual(['max_strength', 'strength_endurance']) // sorted by xpEst desc
    expect(f.skills.find((s) => s.skillKey === 'strength_endurance')).toMatchObject({ willLevelUp: true })
    expect(f.skills.find((s) => s.skillKey === 'max_strength')).toMatchObject({ willLevelUp: false })
  })
})

describe('identityKeyOf', () => {
  it('prefers the catalogId key when present', () => {
    expect(identityKeyOf({ catalogId: 'cat-1', name: 'Leg Press' })).toBe('c:cat-1')
  })
  it('falls back to the name key when catalogId is absent', () => {
    expect(identityKeyOf({ name: 'Legacy Curl' })).toBe('n:Legacy Curl')
  })
  it('falls back to name for LoggedWorkoutExercise (no catalogId field on that type)', () => {
    expect(identityKeyOf(anchoredExercise)).toBe('n:Leg Press')
  })
})

describe('oneRmByIdentity', () => {
  const record = (over: Partial<ExerciseRecordResponse> & Pick<ExerciseRecordResponse, 'name' | 'muscle' | 'type'>): ExerciseRecordResponse => ({
    totalVolume: 0, totalSets: 0, totalReps: 0, sessionCount: 0, repRecords: [], recentTopSets: [],
    ...over,
  })
  it('keys catalog-linked records by catalogId, legacy rows by name, rounds the e1RM kg', () => {
    const catalogRecord = record({
      catalogId: 'cat-1', name: 'Leg Press', muscle: 'quad', type: 'compound',
      bestE1rm: { value: 30.4, set: { reps: 8, date: '2026-01-01' } },
    })
    const legacyRecord = record({
      name: 'Old Legacy Curl', muscle: 'biceps', type: 'isolation',
      bestE1rm: { value: 15.6, set: { reps: 12, date: '2026-01-02' } },
    })
    const noE1rmRecord = record({ name: 'Box Jump', muscle: 'quad', type: 'plyo' })

    const map = oneRmByIdentity([catalogRecord, legacyRecord, noE1rmRecord])
    expect(map.get('c:cat-1')).toBe(30)
    expect(map.get('n:Old Legacy Curl')).toBe(16)
    expect(map.has('n:Box Jump')).toBe(false) // unknown e1RM → omitted, never fabricated
    expect(map.size).toBe(2)
  })
})

describe('startWeightOf', () => {
  it('returns the first working prescribed target weight', () => {
    expect(startWeightOf(anchoredExercise)).toBe(26)
  })
  it('returns null for a plyo/no-prescription exercise', () => {
    expect(startWeightOf(plyoExercise)).toBeNull()
  })
})
