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
  canRemoveSet,
  removeSet,
  updateLoggedSet,
  attachSetId,
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

describe('set edit + slot removal (mezo-l3on)', () => {
  const ex = [{ id: 'a', warmupSets: 1, workingSets: 3, prescribedSets: null }]

  test('removeSet on a pending slot shrinks the effective count without touching logs', () => {
    const s = completeSet(makeSession(ex), 'a', { weight: 80, reps: 10, rir: 2 })
    const after = removeSet(s, 'a', 3)
    expect(effectiveSetCount(after, 'a')).toBe(3)
    expect(after.logged.a).toHaveLength(1)
  })

  test('removeSet on a logged set drops the entry AND the slot, shifting later sets down', () => {
    let s = makeSession(ex)
    s = completeSet(s, 'a', { weight: 80, reps: 10, rir: 2 })
    s = completeSet(s, 'a', { weight: 82.5, reps: 9, rir: 2 })
    s = completeSet(s, 'a', { weight: 85, reps: 8, rir: 1 })
    const after = removeSet(s, 'a', 1)
    expect(effectiveSetCount(after, 'a')).toBe(3)
    expect(after.logged.a.map((x) => x.weight)).toEqual([80, 85])
    expect(nextSetIdx(after, 'a')).toBe(2)
  })

  test('removeSet refuses to drop the last remaining slot', () => {
    const one = [{ id: 'a', warmupSets: 0, workingSets: 1, prescribedSets: null }]
    const s = makeSession(one)
    expect(canRemoveSet(s, 'a')).toBe(false)
    expect(removeSet(s, 'a', 0)).toBe(s)
    expect(effectiveSetCount(s, 'a')).toBe(1)
  })

  test('removeSet refuses an index that is not an existing slot (past effectiveSetCount)', () => {
    const three = [{ id: 'a', warmupSets: 0, workingSets: 3, prescribedSets: null }]
    let s = makeSession(three)
    s = completeSet(s, 'a', { weight: 80, reps: 10, rir: 2 })
    s = completeSet(s, 'a', { weight: 82.5, reps: 9, rir: 2 })
    s = completeSet(s, 'a', { weight: 85, reps: 8, rir: 1 })
    expect(removeSet(s, 'a', 3)).toBe(s)
    expect(effectiveSetCount(s, 'a')).toBe(3)
  })

  test('canRemoveSet is true while more than one slot remains', () => {
    expect(canRemoveSet(makeSession(ex), 'a')).toBe(true)
  })

  test('updateLoggedSet overwrites only the addressed set', () => {
    let s = makeSession(ex)
    s = completeSet(s, 'a', { weight: 80, reps: 10, rir: 2 })
    s = completeSet(s, 'a', { weight: 82.5, reps: 9, rir: 2 })
    const after = updateLoggedSet(s, 'a', 0, { weight: 77.5, reps: 12, rir: 3, note: 'javítva' })
    expect(after.logged.a[0]).toMatchObject({ weight: 77.5, reps: 12, rir: 3, note: 'javítva' })
    expect(after.logged.a[1]).toMatchObject({ weight: 82.5, reps: 9 })
  })

  test('attachSetId binds the server id to the logged entry addressed by localId', () => {
    const s = completeSet(makeSession(ex), 'a', { weight: 80, reps: 10, rir: 2, localId: 'local-1' })
    expect(attachSetId(s, 'a', 'local-1', 'st-9').logged.a[0].id).toBe('st-9')
  })

  // N1 (fix round 2): index-addressed binding was the actual bug — an entry must be
  // addressed by its client-assigned `localId`, which survives a concurrent delete/edit,
  // never by array index (which shifts under one).

  test('attachSetId with an unknown localId is a no-op (e.g. the set was deleted before the response landed)', () => {
    const s = completeSet(makeSession(ex), 'a', { weight: 80, reps: 10, rir: 2, localId: 'local-1' })
    expect(attachSetId(s, 'a', 'unknown-local-id', 'st-9')).toBe(s)
  })

  test('attachSetId still lands on the right entry after an EARLIER logged set was removed (index-independent)', () => {
    let s = makeSession(ex)
    s = completeSet(s, 'a', { weight: 80, reps: 10, rir: 2, localId: 'local-1' })
    s = completeSet(s, 'a', { weight: 82.5, reps: 9, rir: 2, localId: 'local-2' })
    // Remove the FIRST logged entry — local-2's array index shifts from 1 down to 0.
    s = removeSet(s, 'a', 0)
    const after = attachSetId(s, 'a', 'local-2', 'st-2')
    expect(after.logged.a[0]).toMatchObject({ localId: 'local-2', id: 'st-2' })
  })

  test('seedFromOpen carries the server id, side and note into the session', () => {
    const s = seedFromOpen(ex, {
      sets: [{ id: 'st-1', exerciseId: 'a', setIndex: 0, weightKg: 80, reps: 10, rir: 2, side: 'L', note: 'bal' }],
    })
    expect(s.logged.a[0]).toMatchObject({ id: 'st-1', weight: 80, reps: 10, rir: 2, side: 'L', note: 'bal' })
  })

  test('updateLoggedSet preserves id/side/note untouched by a weight-only patch', () => {
    const seeded = seedFromOpen(ex, {
      sets: [{ id: 'st-1', exerciseId: 'a', setIndex: 0, weightKg: 80, reps: 10, rir: 2, side: 'L', note: 'bal' }],
    })
    const after = updateLoggedSet(seeded, 'a', 0, { weight: 90 })
    expect(after.logged.a[0]).toMatchObject({ id: 'st-1', weight: 90, reps: 10, rir: 2, side: 'L', note: 'bal' })
  })

  // C1 (fix round 1): the prescription must shift with the removed slot, or row `i`
  // re-pairs against the wrong (unshifted) prescribed target after a delete.
  const withPrescription = [{
    id: 'a', warmupSets: 2, workingSets: 3,
    prescribedSets: [
      { kind: 'warmup' as const, targetWeightKg: 40, targetReps: 12, targetRIR: null },
      { kind: 'warmup' as const, targetWeightKg: 60, targetReps: 10, targetRIR: null },
      { kind: 'working' as const, targetWeightKg: 100, targetReps: 8, targetRIR: 2 },
      { kind: 'working' as const, targetWeightKg: 100, targetReps: 8, targetRIR: 2 },
      { kind: 'working' as const, targetWeightKg: 100, targetReps: 8, targetRIR: 2 },
    ],
  }]

  test('C1(a): removeSet on a PENDING warmup slot drops that warmup from the prescription, not a working slot', () => {
    const s = makeSession(withPrescription)
    const after = removeSet(s, 'a', 0)
    expect(after.prescribed.a.map((p) => p.kind)).toEqual(['warmup', 'working', 'working', 'working'])
    expect(effectiveSetCount(after, 'a')).toBe(4)
  })

  test('C1(b): removeSet on an already-LOGGED warmup slot re-pairs the later logged working set with a working prescription', () => {
    let s = makeSession(withPrescription)
    s = completeSet(s, 'a', { weight: 40, reps: 12, rir: 0 }) // B1 (logged idx 0)
    s = completeSet(s, 'a', { weight: 60, reps: 10, rir: 0 }) // B2 (logged idx 1)
    s = completeSet(s, 'a', { weight: 100, reps: 8, rir: 0 }) // W1 (logged idx 2)
    const after = removeSet(s, 'a', 0) // delete B1 — W1 shifts down to logged idx 1
    expect(after.prescribed.a[1].kind).toBe('working')
    expect(after.logged.a[1]).toMatchObject({ weight: 100, reps: 8, rir: 0 })
  })
})
