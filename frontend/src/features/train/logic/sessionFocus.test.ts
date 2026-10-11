import { describe, expect, it } from 'vitest'
import { completeSet, makeSession, skipExercise, swapExercise, type Session, type SessionExerciseInput } from '@/features/train/logic/workoutState'
import { dockNumbers, finishState, heroExerciseId, nextFocus, nowExerciseId, progressVessels, rowTag } from '@/features/train/logic/sessionFocus'

const ex = (id: string, sets: number): SessionExerciseInput => ({ id, warmupSets: 0, workingSets: sets, prescribedSets: null })
const SET = { weight: 50, reps: 8, rir: 2 }
const log = (s: Session, id: string, n: number) => Array.from({ length: n }).reduce<Session>((acc) => completeSet(acc, id, SET), s)
const fresh = () => makeSession([ex('a', 2), ex('b', 3), ex('c', 1)])

describe('sessionFocus · which exercise is „Most"', () => {
  it('is the first exercise in order with an open set', () => {
    expect(nowExerciseId(fresh())).toBe('a')
    expect(nowExerciseId(log(fresh(), 'a', 2))).toBe('b')
  })
  it('steps over a skipped exercise', () => {
    expect(nowExerciseId(skipExercise(fresh(), 'a'))).toBe('b')
  })
  it('is null once every non-skipped exercise is fully logged', () => {
    const s = log(log(skipExercise(fresh(), 'b'), 'a', 2), 'c', 1)
    expect(nowExerciseId(s)).toBeNull()
  })
})

describe('sessionFocus · which exercise the hero shows', () => {
  it('follows „Most" while nothing is focused', () => {
    expect(heroExerciseId(fresh(), null)).toBe('a')
    expect(heroExerciseId(log(fresh(), 'a', 2), null)).toBe('b')
  })
  it('shows the focused exercise, also a later or a skipped one', () => {
    expect(heroExerciseId(fresh(), 'c')).toBe('c')
    expect(heroExerciseId(skipExercise(fresh(), 'b'), 'b')).toBe('b')
  })
  it('falls back to „Most" when the focused id left the session (swapped before any set)', () => {
    const s = swapExercise(fresh(), 'a', ex('x', 2))
    expect(s.order).not.toContain('a')
    expect(heroExerciseId(s, 'a')).toBe('x')
  })
  it('shows the last exercise when everything is done and nothing is focused', () => {
    const s = log(log(log(fresh(), 'a', 2), 'b', 3), 'c', 1)
    expect(heroExerciseId(s, null)).toBe('c')
  })
})

describe('sessionFocus · how the focus moves', () => {
  it('a tap on a row focuses it', () => {
    expect(nextFocus(null, { type: 'tap', id: 'c' })).toBe('c')
  })
  it('logging pins the focus to that exercise, so its debrief stays on screen', () => {
    expect(nextFocus(null, { type: 'logged', id: 'a' })).toBe('a')
    expect(nextFocus('c', { type: 'logged', id: 'a' })).toBe('a')
  })
  it('closing the debrief of the focused exercise clears the focus (the hero moves on to „Most")', () => {
    expect(nextFocus('a', { type: 'debriefClosed', id: 'a' })).toBeNull()
    expect(nextFocus('c', { type: 'debriefClosed', id: 'a' })).toBe('c')
  })
  it('skipping the focused exercise clears the focus; skipping another leaves it', () => {
    expect(nextFocus('b', { type: 'skipped', id: 'b' })).toBeNull()
    expect(nextFocus('a', { type: 'skipped', id: 'b' })).toBe('a')
  })
  it('taking an exercise back, swapping in or adding one focuses it', () => {
    expect(nextFocus(null, { type: 'unskipped', id: 'b' })).toBe('b')
    expect(nextFocus('a', { type: 'changed', id: 'x' })).toBe('x')
  })
})

describe('sessionFocus · row tags, the finish button, the dock, the top vessels', () => {
  it('tags: skipped, now, done, nothing; a swapped-out exercise carries no tag', () => {
    const s = log(skipExercise(fresh(), 'c'), 'a', 2)
    expect(rowTag(s, 'a')).toBe('done')
    expect(rowTag(s, 'b')).toBe('now')
    expect(rowTag(s, 'c')).toBe('skipped')
    expect(rowTag(fresh(), 'b')).toBeNull()
    expect(rowTag(s, 'a', { swappedOut: true })).toBeNull()
  })
  it('finish: skip with nothing logged, partial while sets are open, full when none is', () => {
    expect(finishState(fresh())).toBe('skip')
    expect(finishState(log(fresh(), 'a', 1))).toBe('partial')
    expect(finishState(log(log(skipExercise(fresh(), 'b'), 'a', 2), 'c', 1))).toBe('full')
  })
  it('dock numbers count the non-skipped exercises only', () => {
    expect(dockNumbers(fresh())).toEqual({ done: 0, planned: 6 })
    expect(dockNumbers(log(skipExercise(log(fresh(), 'b', 1), 'b'), 'a', 2))).toEqual({ done: 2, planned: 3 })
  })
  it('one vessel per exercise in order: done, planned, and whether it is out of today', () => {
    const s = log(skipExercise(fresh(), 'c'), 'a', 1)
    expect(progressVessels(s)).toEqual([
      { id: 'a', done: 1, planned: 2, off: false },
      { id: 'b', done: 0, planned: 3, off: false },
      { id: 'c', done: 0, planned: 1, off: true },
    ])
  })
})
