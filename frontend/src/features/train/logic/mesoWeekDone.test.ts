import { doneByDay } from '@/features/train/logic/mesoWeekDone'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'

const ex = (sets: number, skipped = false) => ({
  exerciseId: crypto.randomUUID(), name: 'Row', muscle: 'back-mid', type: 'compound',
  warmupSets: 2, workingSets: sets, repMin: 8, repMax: 10, targetRIR: 1, skipped,
  sets: Array.from({ length: sets }, (_, i) => ({ setIndex: i + 1, reps: 10, weightKg: 100 })),
}) as unknown as WorkoutDetailResponse['exercises'][number]

const wo = (over: Partial<WorkoutDetailResponse>): WorkoutDetailResponse => ({
  id: crypto.randomUUID(), templateSessionId: crypto.randomUUID(), date: '2026-09-21',
  status: 'completed', title: 'Pull Day', dayLabel: 'Hét', durationEst: 60, exercises: [],
  ...over,
} as WorkoutDetailResponse)

test('a completed day reports its logged sets, measured minutes and worked exercises', () => {
  const map = doneByDay([wo({
    dayLabel: 'Hét',
    startedAt: '2026-09-21T17:00:00Z', finishedAt: '2026-09-21T18:08:00Z',
    exercises: [ex(4), ex(3), ex(3)],
  })])
  expect(map.get('Hét')).toEqual({ sets: 10, minutes: 68, exercises: 3 })
})

test('an exercise with no logged set does not count as worked', () => {
  const map = doneByDay([wo({ dayLabel: 'Kedd', exercises: [ex(3), ex(0, true)] })])
  expect(map.get('Kedd')).toMatchObject({ sets: 3, exercises: 1 })
})

// The honest split (actualDuration): a session we cannot time reports null, never an estimate.
test('an untimed session reports null minutes rather than the plan estimate', () => {
  const map = doneByDay([wo({ dayLabel: 'Sze', durationEst: 70, exercises: [ex(5)] })])
  expect(map.get('Sze')).toEqual({ sets: 5, minutes: null, exercises: 1 })
})

test('only completed instances count — an open or skipped one is not a done day', () => {
  const map = doneByDay([
    wo({ dayLabel: 'Csü', status: 'active', exercises: [ex(4)] }),
    wo({ dayLabel: 'Pén', status: 'skipped', exercises: [ex(4)] }),
  ])
  expect(map.size).toBe(0)
})

// Two instances can share a weekday (the meso day plus a custom workout logged the same day).
// Summing is the honest read of "what that day actually held".
test('two instances on the same weekday are summed', () => {
  const map = doneByDay([
    wo({ dayLabel: 'Szo', exercises: [ex(4)], startedAt: '2026-09-26T08:00:00Z', finishedAt: '2026-09-26T08:40:00Z' }),
    wo({ dayLabel: 'Szo', exercises: [ex(2)], startedAt: '2026-09-26T18:00:00Z', finishedAt: '2026-09-26T18:20:00Z' }),
  ])
  expect(map.get('Szo')).toEqual({ sets: 6, minutes: 60, exercises: 2 })
})

test('an empty week yields an empty map, never a zero-filled one', () => {
  expect(doneByDay([]).size).toBe(0)
})
