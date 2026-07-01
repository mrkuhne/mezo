// workoutState.test.ts
import { describe, expect, test } from 'vitest'
import { makeSession, completeSet, effectiveSetCount, currentExerciseId, advance, addExtraSet, skipExercise, seedFromOpen } from '@/features/train/logic/workoutState'

const EX = [
  { id: 'a', sets: 2 }, { id: 'b', sets: 3 }, { id: 'c', sets: 2 },
] as { id: string; sets: number }[]

describe('workoutState', () => {

test('makeSession starts at the first exercise, no logged sets', () => {
  const s = makeSession(EX)
  expect(currentExerciseId(s)).toBe('a')
  expect(s.setIdx).toBe(0)
  expect(effectiveSetCount(s, 'a')).toBe(2)
})

test('completeSet appends to the exercise keyed by id and advances setIdx', () => {
  let s = makeSession(EX)
  s = completeSet(s, { weight: 100, reps: 8, rir: 2 })
  expect(s.logged['a']).toHaveLength(1)
  expect(s.setIdx).toBe(1)
})

test('advance moves to the next exercise in session order, skipping completed', () => {
  let s = makeSession(EX)
  s = completeSet(s, { weight: 1, reps: 1, rir: 1 })
  s = completeSet(s, { weight: 1, reps: 1, rir: 1 }) // a done (2/2)
  s = advance(s)
  expect(currentExerciseId(s)).toBe('b')
  expect(s.setIdx).toBe(0)
})

test('addExtraSet grows the effective count for that exercise only', () => {
  let s = makeSession(EX)
  s = addExtraSet(s, 'a')
  expect(effectiveSetCount(s, 'a')).toBe(3)
  expect(effectiveSetCount(s, 'b')).toBe(3) // unchanged (planned)
})

test('skipExercise marks it skipped and advance lands on the next non-skipped', () => {
  let s = makeSession(EX)
  s = skipExercise(s, 'a')
  expect(s.skipped).toContain('a')
  s = advance(s)
  expect(currentExerciseId(s)).toBe('b')
})

test('reorder changes the session order of remaining exercises only', () => {
  let s = makeSession(EX) // current = a
  s = { ...s, order: ['a', 'c', 'b'] } // reorder b/c (both remaining)
  s = completeSet(s, { weight: 1, reps: 1, rir: 1 })
  s = completeSet(s, { weight: 1, reps: 1, rir: 1 })
  s = advance(s)
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
  expect(s.setIdx).toBe(1) // b has 1 logged -> next is index 1
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
    for (let i = 0; i < e.sets; i++) s = completeSet(s, { weight: 1, reps: 1, rir: 1 })
    s = advance(s)
  }
  expect(currentExerciseId(s)).toBe('c')
})

})
