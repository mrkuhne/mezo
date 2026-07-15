// workoutState.test.ts
import { describe, expect, test, it } from 'vitest'
import {
  makeSession,
  completeSet,
  nextSetIdx,
  nextUnfinishedAfter,
  effectiveSetCount,
  currentExerciseId,
  addExtraSet,
  skipExercise,
  seedFromOpen,
  mergePlan,
  type SessionExerciseInput,
} from '@/features/train/logic/workoutState'

// warmupSets:0 keeps planned == the old `sets` count; `sets` is retained only for
// the test loops below (makeSession reads warmupSets/workingSets/prescribedSets).
const EX = [
  { id: 'a', warmupSets: 0, workingSets: 2, prescribedSets: null, sets: 2 },
  { id: 'b', warmupSets: 0, workingSets: 3, prescribedSets: null, sets: 3 },
  { id: 'c', warmupSets: 0, workingSets: 2, prescribedSets: null, sets: 2 },
]

// Fixture helper for the free-navigation describe blocks below.
const ex = (id: string, warmupSets: number, workingSets: number): SessionExerciseInput => ({
  id,
  warmupSets,
  workingSets,
  prescribedSets: null,
})

describe('workoutState', () => {

test('makeSession starts at the first exercise, no logged sets', () => {
  const s = makeSession(EX)
  expect(currentExerciseId(s)).toBe('a')
  expect(effectiveSetCount(s, 'a')).toBe(2)
})

test('completeSet appends to the exercise keyed by id', () => {
  let s = makeSession(EX)
  s = completeSet(s, currentExerciseId(s), { weight: 100, reps: 8, rir: 2 })
  expect(s.logged['a']).toHaveLength(1)
})

test('addExtraSet grows the effective count for that exercise only', () => {
  let s = makeSession(EX)
  s = addExtraSet(s, 'a')
  expect(effectiveSetCount(s, 'a')).toBe(3)
  expect(effectiveSetCount(s, 'b')).toBe(3) // unchanged (planned)
})

test('skipExercise marks it skipped and the current exercise skips past it', () => {
  let s = makeSession(EX)
  s = skipExercise(s, 'a')
  expect(s.skipped).toContain('a')
  expect(currentExerciseId(s)).toBe('b')
})

test('reorder changes the session order of remaining exercises only', () => {
  let s = makeSession(EX) // current = a
  s = { ...s, order: ['a', 'c', 'b'] } // reorder b/c (both remaining)
  s = completeSet(s, currentExerciseId(s), { weight: 1, reps: 1, rir: 1 })
  s = completeSet(s, currentExerciseId(s), { weight: 1, reps: 1, rir: 1 }) // a done (2/2)
  expect(currentExerciseId(s)).toBe('c') // c now before b
})

test('seedFromOpen rebuilds logged sets + cursor by exerciseId from persisted sets', () => {
  const open = { sets: [
    { exerciseId: 'a', setIndex: 0, weightKg: 100, reps: 8, rir: 2 },
    { exerciseId: 'a', setIndex: 1, weightKg: 100, reps: 8, rir: 2 },
    { exerciseId: 'b', setIndex: 0, weightKg: 50, reps: 10, rir: 1 },
  ] }
  const s = seedFromOpen(EX, open)
  expect(s.logged['a']).toHaveLength(2)
  expect(currentExerciseId(s)).toBe('b') // a full (2/2) -> resume on b
  expect(nextSetIdx(s, 'b')).toBe(1) // b has 1 logged -> next is index 1
})

test('seedFromOpen routes skip markers to skipped, not logged', () => {
  const open = { sets: [
    { exerciseId: 'a', setIndex: 0, weightKg: 100, reps: 8, rir: 2 },
    { exerciseId: 'b', setIndex: 0, skipped: true },
  ] }
  const s = seedFromOpen(EX, open)
  expect(s.skipped).toContain('b')
  expect(s.logged['b']).toBeUndefined()
  // a has 1 logged of 2 planned (1 < 2) so the cursor stays on 'a'.
  expect(currentExerciseId(s)).toBe('a')
})

test('currentExerciseId returns the last exercise once all are done (complete sentinel)', () => {
  let s = makeSession(EX)
  for (const e of EX) {
    for (let i = 0; i < e.sets; i++) s = completeSet(s, currentExerciseId(s), { weight: 1, reps: 1, rir: 1 })
  }
  expect(currentExerciseId(s)).toBe('c')
})

// Mid-workout plan growth (mezo-ohvm): the server-side closing block (mezo-z2ul) can append
// template exercises while a session is already open — a refetch grows the plan, and the
// model must fold the new exercises in instead of treating them as done (0 planned).
test('mergePlan appends plan growth to the session without touching progress', () => {
  let s = makeSession(EX)
  s = completeSet(s, currentExerciseId(s), { weight: 1, reps: 1, rir: 1 }) // a: 1/2
  const grown = [...EX,
    { id: 'dh', warmupSets: 0, workingSets: 2, prescribedSets: null },
    { id: 'be', warmupSets: 0, workingSets: 2, prescribedSets: null },
  ]
  const m = mergePlan(s, grown)
  expect(m.order).toEqual(['a', 'b', 'c', 'dh', 'be'])
  expect(effectiveSetCount(m, 'dh')).toBe(2)
  expect(m.logged['a']).toHaveLength(1) // progress untouched
  expect(currentExerciseId(m)).toBe('a') // cursor unchanged while a incomplete
})

test('mergePlan makes grown exercises visitable after the last original one (the auto-finish bug)', () => {
  let s = makeSession(EX)
  for (const e of EX) {
    for (let i = 0; i < e.sets; i++) s = completeSet(s, currentExerciseId(s), { weight: 1, reps: 1, rir: 1 })
  }
  // all originals done — WITHOUT the merge the session would read as complete
  const m = mergePlan(s, [...EX, { id: 'dh', warmupSets: 0, workingSets: 2, prescribedSets: null }])
  expect(currentExerciseId(m)).toBe('dh')
  expect(m.logged['dh']).toBeUndefined()
})

test('mergePlan returns the SAME session object when the plan has nothing new (identity-stable)', () => {
  const s = makeSession(EX)
  expect(mergePlan(s, EX)).toBe(s)
})

})

describe('nextSetIdx', () => {
  it('is the logged count for the exercise', () => {
    let s = makeSession([ex('a', 1, 2), ex('b', 0, 3)])
    expect(nextSetIdx(s, 'a')).toBe(0)
    s = completeSet(s, 'a', { weight: 50, reps: 10, rir: 2 })
    expect(nextSetIdx(s, 'a')).toBe(1)
    expect(nextSetIdx(s, 'b')).toBe(0)
  })
})

describe('completeSet (by exercise id)', () => {
  it('logs into the GIVEN exercise, not the linear cursor', () => {
    let s = makeSession([ex('a', 0, 2), ex('b', 0, 2)])
    s = completeSet(s, 'b', { weight: 40, reps: 12, rir: 1 })
    expect(s.logged['b']).toHaveLength(1)
    expect(s.logged['a']).toBeUndefined()
    expect(currentExerciseId(s)).toBe('a') // linear "first unfinished" is unaffected
  })
})

describe('nextUnfinishedAfter', () => {
  it('finds the next unfinished after the given id, wrapping around', () => {
    let s = makeSession([ex('a', 0, 1), ex('b', 0, 1), ex('c', 0, 1)])
    s = completeSet(s, 'b', { weight: 40, reps: 12, rir: 1 })
    expect(nextUnfinishedAfter(s, 'a')).toBe('c')
    expect(nextUnfinishedAfter(s, 'c')).toBe('a') // wraps
  })
  it('skips skipped exercises and returns null when everything is resolved', () => {
    let s = makeSession([ex('a', 0, 1), ex('b', 0, 1)])
    s = skipExercise(s, 'b')
    expect(nextUnfinishedAfter(s, 'b')).toBe('a')
    s = completeSet(s, 'a', { weight: 40, reps: 12, rir: 1 })
    expect(nextUnfinishedAfter(s, 'a')).toBeNull()
  })
})
