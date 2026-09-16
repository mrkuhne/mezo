// cerScore.test.ts
import { describe, expect, test } from 'vitest'
import { cerScore, starsFor, verdictFor, muscleStarRows } from '@/features/train/logic/cerScore'
import { makeSession, completeSet, skipExercise, type Session, type LoggedSet } from '@/features/train/logic/workoutState'
import type { LoggedWorkoutExercise, PrescribedSet } from '@/data/types'

// Minimal LoggedWorkoutExercise fixture — cerScore/muscleStarRows only read id/muscle.
const exercise = (id: string, muscle: string): LoggedWorkoutExercise => ({
  id,
  name: id,
  warmupSets: 0,
  workingSets: 0,
  repMin: 0,
  repMax: 0,
  targetRIR: 0,
  anchorWeightKg: null,
  type: 'compound',
  muscle,
  sets: 0,
  prescribedSets: null,
  rationale: null,
  lastWeek: null,
})

const working = (targetWeightKg: number | null, targetReps: number): PrescribedSet => ({
  kind: 'working',
  targetWeightKg,
  targetReps,
  targetRIR: 2,
})

const loggedSet = (weight: number, reps: number): LoggedSet => ({ weight, reps, rir: 2 })

describe('starsFor', () => {
  test('0 ratio -> 0 stars', () => {
    expect(starsFor(0)).toBe(0)
  })
  test('0.49 ratio -> 2.5 stars', () => {
    expect(starsFor(0.49)).toBe(2.5)
  })
  test('1 ratio -> 5 stars', () => {
    expect(starsFor(1)).toBe(5)
  })
  test('over-1 input clamps at 5', () => {
    expect(starsFor(2)).toBe(5)
  })
  test('negative input clamps at 0', () => {
    expect(starsFor(-1)).toBe(0)
  })
})

describe('cerScore', () => {
  test('over-performed volume caps its share at 1', () => {
    const s: Session = makeSession([{ id: 'a', warmupSets: 0, workingSets: 1, prescribedSets: [working(100, 10)] }])
    const withSet = completeSet(s, 'a', loggedSet(200, 10))
    const score = cerScore(withSet, [exercise('a', 'chest')])
    // done.volume (2000) vastly exceeds target.volume (1000); its share caps at 1, not 2.
    expect(score.target).toEqual({ sets: 1, reps: 10, volume: 1000 })
    expect(score.done).toEqual({ sets: 1, reps: 10, volume: 2000 })
    expect(score.ratio).toBe(1)
    expect(score.stars).toBe(5)
  })

  test('warmup and working slots both count toward the target', () => {
    const s: Session = makeSession([
      {
        id: 'a',
        warmupSets: 1,
        workingSets: 1,
        prescribedSets: [
          { kind: 'warmup', targetWeightKg: 20, targetReps: 12, targetRIR: null },
          working(100, 10),
        ],
      },
    ])
    let sess = completeSet(s, 'a', loggedSet(20, 12))
    sess = completeSet(sess, 'a', loggedSet(100, 10))
    const score = cerScore(sess, [exercise('a', 'chest')])
    expect(score.target).toEqual({ sets: 2, reps: 22, volume: 20 * 12 + 100 * 10 })
    expect(score.done).toEqual({ sets: 2, reps: 22, volume: 20 * 12 + 100 * 10 })
    expect(score.ratio).toBe(1)
  })

  test('a slot with no prescription adds its logged set to done only', () => {
    const s: Session = makeSession([{ id: 'a', warmupSets: 0, workingSets: 1, prescribedSets: null }])
    const withSet = completeSet(s, 'a', loggedSet(50, 8))
    const score = cerScore(withSet, [exercise('a', 'chest')])
    expect(score.target).toEqual({ sets: 0, reps: 0, volume: 0 })
    expect(score.done).toEqual({ sets: 1, reps: 8, volume: 400 })
    // no target at all -> every share is 0 (b === 0 -> part returns 0)
    expect(score.ratio).toBe(0)
  })

  test('a bodyweight prescription (no kg) contributes reps but zero volume, no divide-by-zero', () => {
    const s: Session = makeSession([{ id: 'a', warmupSets: 0, workingSets: 1, prescribedSets: [working(null, 10)] }])
    const withSet = completeSet(s, 'a', loggedSet(0, 10))
    const score = cerScore(withSet, [exercise('a', 'chest')])
    expect(score.target).toEqual({ sets: 1, reps: 10, volume: 0 })
    expect(score.done).toEqual({ sets: 1, reps: 10, volume: 0 })
    // volume share: target.volume is 0 -> part() returns 0 (not NaN/Infinity); sets+reps share = 1
    expect(score.ratio).toBeCloseTo((1 + 1 + 0) / 3)
    expect(Number.isFinite(score.ratio)).toBe(true)
  })

  test('a skipped exercise still inflates target, not done', () => {
    let s: Session = makeSession([{ id: 'a', warmupSets: 0, workingSets: 2, prescribedSets: [working(50, 10), working(50, 10)] }])
    s = skipExercise(s, 'a')
    const score = cerScore(s, [exercise('a', 'chest')])
    expect(score.target).toEqual({ sets: 2, reps: 20, volume: 1000 })
    expect(score.done).toEqual({ sets: 0, reps: 0, volume: 0 })
    expect(score.ratio).toBe(0)
    expect(score.stars).toBe(0)
  })

  test('an empty session (no exercises) yields a zeroed, finite result', () => {
    const s: Session = makeSession([])
    const score = cerScore(s, [])
    expect(score.target).toEqual({ sets: 0, reps: 0, volume: 0 })
    expect(score.done).toEqual({ sets: 0, reps: 0, volume: 0 })
    expect(score.ratio).toBe(0)
    expect(score.stars).toBe(0)
  })
})

describe('verdictFor', () => {
  test('5 stars -> Hibátlan nap.', () => {
    expect(verdictFor(5)).toBe('Hibátlan nap.')
  })
  test('4 stars -> Erős nap.', () => {
    expect(verdictFor(4)).toBe('Erős nap.')
  })
  test('4.5 stars -> Erős nap. (below the 5 threshold)', () => {
    expect(verdictFor(4.5)).toBe('Erős nap.')
  })
  test('3 stars -> Rendben volt.', () => {
    expect(verdictFor(3)).toBe('Rendben volt.')
  })
  test('2.9 stars -> Elindult. (below the 3 threshold)', () => {
    expect(verdictFor(2.9)).toBe('Elindult.')
  })
  test('1.5 stars -> Elindult.', () => {
    expect(verdictFor(1.5)).toBe('Elindult.')
  })
  test('0 stars -> Ma nem jött össze.', () => {
    expect(verdictFor(0)).toBe('Ma nem jött össze.')
  })
  test('1.4 stars -> Ma nem jött össze. (below the 1.5 threshold)', () => {
    expect(verdictFor(1.4)).toBe('Ma nem jött össze.')
  })
})

describe('muscleStarRows', () => {
  test('groups by muscle, computes plan/done/ratio/stars, sorts desc by done then plan', () => {
    let s: Session = makeSession([
      { id: 'a', warmupSets: 0, workingSets: 3, prescribedSets: null },
      { id: 'b', warmupSets: 0, workingSets: 2, prescribedSets: null },
      { id: 'c', warmupSets: 0, workingSets: 4, prescribedSets: null },
    ])
    // chest: exercises a (plan 3) + b (plan 2) => plan 5, done 3 (all of a's sets)
    s = completeSet(s, 'a', loggedSet(50, 10))
    s = completeSet(s, 'a', loggedSet(50, 10))
    s = completeSet(s, 'a', loggedSet(50, 10))
    // back: exercise c (plan 4), done 1
    s = completeSet(s, 'c', loggedSet(50, 10))

    const rows = muscleStarRows(s, [exercise('a', 'chest'), exercise('b', 'chest'), exercise('c', 'back')])
    expect(rows).toEqual([
      { muscle: 'chest', label: 'Mell', done: 3, plan: 5, ratio: 0.6, stars: starsFor(0.6) },
      { muscle: 'back', label: 'Hát', done: 1, plan: 4, ratio: 0.25, stars: starsFor(0.25) },
    ])
  })

  test('falls back to the raw token when MUSCLE_LABELS has no entry', () => {
    const s: Session = makeSession([{ id: 'a', warmupSets: 0, workingSets: 1, prescribedSets: null }])
    const rows = muscleStarRows(s, [exercise('a', 'made-up-token')])
    expect(rows[0].label).toBe('made-up-token')
  })

  test('sorts ties on done by plan descending', () => {
    const s: Session = makeSession([
      { id: 'a', warmupSets: 0, workingSets: 2, prescribedSets: null },
      { id: 'b', warmupSets: 0, workingSets: 5, prescribedSets: null },
    ])
    // both muscles have done: 0, differing plan
    const rows = muscleStarRows(s, [exercise('a', 'chest'), exercise('b', 'back')])
    expect(rows.map((r) => r.muscle)).toEqual(['back', 'chest'])
  })
})
