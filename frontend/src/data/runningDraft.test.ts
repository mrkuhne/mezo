import { describe, expect, test } from 'vitest'
import {
  newDraft, duplicateDraft, setSprintRounds, setSprintRest, setPyramidWork,
  setSessionDay, setSessionTime,
  sprintOf, pyramidOf, workSecs, restSec,
} from './runningDraft'
import { runningBlocksMock } from './running'

// Pure helper unit tests — no React, no mode stub. The draft helpers are the
// structure-edit core of the Futás builder; they must be immutable and the
// pyramid math (rest = work × 2) must hold.

describe('newDraft', () => {
  const draft = newDraft('2026-06-16', '2026-07-14')

  test('builds a 4-week interval upsert request seeded from the dates', () => {
    expect(draft.weeks).toBe(4)
    expect(draft.structure.weeks).toHaveLength(4)
    expect(draft.startDate).toBe('2026-06-16')
    expect(draft.endDate).toBe('2026-07-14')
    expect(draft.currentWeek).toBe(0)
  })

  test('is an upsert request — no server-owned status field', () => {
    expect('status' in draft).toBe(false)
  })

  test('every week has one sprint and one pyramid session', () => {
    for (const w of draft.structure.weeks) {
      expect(w.sessions).toHaveLength(2)
      expect(sprintOf(w)?.kind).toBe('sprint')
      expect(pyramidOf(w)?.kind).toBe('pyramid')
    }
  })
})

describe('setSprintRounds', () => {
  test('sets the target week sprint rounds and leaves the input untouched', () => {
    const struct = newDraft('2026-06-16', '2026-07-14').structure
    const before = sprintOf(struct.weeks.find((w) => w.weekNumber === 3)!)!.rounds

    const next = setSprintRounds(struct, 3, 7)
    const week3 = next.weeks.find((w) => w.weekNumber === 3)!
    expect(sprintOf(week3)!.rounds).toBe(7)

    // immutability: the original struct keeps its old value
    expect(sprintOf(struct.weeks.find((w) => w.weekNumber === 3)!)!.rounds).toBe(before)
    expect(before).not.toBe(7)
  })
})

describe('setSprintRest', () => {
  test('rewrites the week-1 sprint rest segment durationSec', () => {
    const struct = newDraft('2026-06-16', '2026-07-14').structure
    const next = setSprintRest(struct, 1, 30)
    const sprint = sprintOf(next.weeks.find((w) => w.weekNumber === 1)!)!
    const rest = sprint.segments.find((g) => g.type === 'rest')!
    expect(rest.durationSec).toBe(30)
    expect(restSec(sprint)).toBe(30)
  })
})

describe('setPyramidWork', () => {
  test('rebuilds the pyramid: warmup, work+rest(×2) pairs, cooldown', () => {
    const struct = newDraft('2026-06-16', '2026-07-14').structure
    const next = setPyramidWork(struct, 2, [15, 30, 45])
    const pyramid = pyramidOf(next.weeks.find((w) => w.weekNumber === 2)!)!

    expect(workSecs(pyramid)).toEqual([15, 30, 45])
    expect(pyramid.segments[0].type).toBe('warmup')
    expect(pyramid.segments[pyramid.segments.length - 1].type).toBe('cooldown')

    // each work is immediately followed by a rest of work × 2
    const works = pyramid.segments.filter((g) => g.type === 'work')
    for (const w of works) {
      const idx = pyramid.segments.indexOf(w)
      const rest = pyramid.segments[idx + 1]
      expect(rest.type).toBe('rest')
      expect(rest.durationSec).toBe(w.durationSec * 2)
    }
  })
})

describe('duplicateDraft', () => {
  test('clones a block as a fresh planned draft titled "(másolat)"', () => {
    const block = runningBlocksMock.find((b) => b.id === 'rb-active-01')!
    const dup = duplicateDraft(block)
    expect(dup.title).toBe(`${block.title} (másolat)`)
    expect(dup.title.endsWith('(másolat)')).toBe(true)
    expect(dup.currentWeek).toBe(0)
    expect(dup.structure).toBe(block.structure)
  })
})

describe('readers', () => {
  const block = runningBlocksMock.find((b) => b.id === 'rb-active-01')!
  // week 3 of the active block: sprint rounds 6, pyramid [15,30,45,45,30,15]
  const week3 = block.structure.weeks.find((w) => w.weekNumber === 3)!

  test('sprintOf / pyramidOf pick the right session by kind', () => {
    expect(sprintOf(week3)!.kind).toBe('sprint')
    expect(sprintOf(week3)!.rounds).toBe(6)
    expect(pyramidOf(week3)!.kind).toBe('pyramid')
  })

  test('workSecs reads every work segment, restSec reads the first rest', () => {
    expect(workSecs(pyramidOf(week3)!)).toEqual([15, 30, 45, 45, 30, 15])
    expect(restSec(sprintOf(week3)!)).toBe(45)
  })
})

describe('setSessionDay (plan-level)', () => {
  test('sets dayOfWeek on the same-key session in EVERY week, keeps key stable, is immutable', () => {
    const struct = newDraft('2026-06-16', '2026-07-14').structure
    const next = setSessionDay(struct, 'tue-sprint', 2) // Tue(1) -> Wed(2)

    for (const w of next.weeks) {
      const sprint = w.sessions.find((s) => s.key === 'tue-sprint')!
      expect(sprint.dayOfWeek).toBe(2)
      expect(sprint.key).toBe('tue-sprint') // key never derived from weekday
    }
    // pyramid sessions untouched
    expect(next.weeks[0].sessions.find((s) => s.key === 'fri-pyramid')!.dayOfWeek).toBe(4)
    // immutability
    expect(struct.weeks[0].sessions.find((s) => s.key === 'tue-sprint')!.dayOfWeek).toBe(1)
  })
})

describe('setSessionTime (plan-level)', () => {
  test('sets timeOfDay on the same-key session in EVERY week', () => {
    const struct = newDraft('2026-06-16', '2026-07-14').structure
    const next = setSessionTime(struct, 'fri-pyramid', '17:45')
    for (const w of next.weeks) {
      expect(w.sessions.find((s) => s.key === 'fri-pyramid')!.timeOfDay).toBe('17:45')
    }
  })
})

describe('newDraft factory defaults', () => {
  test('seeds a default weekday and time on each session', () => {
    const struct = newDraft('2026-06-16', '2026-07-14').structure
    const w1 = struct.weeks[0]
    const sprint = w1.sessions.find((s) => s.key === 'tue-sprint')!
    const pyramid = w1.sessions.find((s) => s.key === 'fri-pyramid')!
    expect(sprint.dayOfWeek).toBe(1)
    expect(sprint.timeOfDay).toBe('18:00')
    expect(pyramid.dayOfWeek).toBe(4)
    expect(pyramid.timeOfDay).toBe('17:30')
  })
})
