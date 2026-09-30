import { expect, test } from 'vitest'
import type { RecoveryState } from '@/data/train/recoveryApi'
import type { WorkoutPlan } from '@/data/types'
import { mockOpen, mockTodayComeback, rampSets, withMockComeback } from '@/data/train/recoveryMock'

const ended = (comeback: RecoveryState['comeback']): RecoveryState => ({
  period: {
    id: 'p', category: 'ILLNESS', estimate: 'FEW_DAYS', startDate: '2026-09-26', expectedEnd: '2026-09-28',
    endedOn: '2026-09-29', dayIndex: 4, estimateExpired: true, checkedInToday: true,
    releasedDates: [], releasedUnlightened: [], return: null,
  },
  protectedDates: [],
  comeback,
})

const plan = {
  title: 'Pull Day', tag: '', durationEst: 78, challenges: [],
  exercises: [
    { id: 'a', name: 'A', muscle: 'lats', warmupSets: 1, workingSets: 4, sets: 5 },
    { id: 'b', name: 'B', muscle: 'lats', warmupSets: 0, workingSets: 3, sets: 3 },
    { id: 'c', name: 'C', muscle: 'lats', warmupSets: 0, workingSets: 1, sets: 1 },
  ],
} as unknown as WorkoutPlan

test('rampSets: a third fewer, never below one (prototype cbSets)', () => {
  expect([4, 3, 2, 1].map(rampSets)).toEqual([3, 2, 1, 1])
})

test('the ramp session index follows the done count; none once waived, used up or still open', () => {
  expect(mockTodayComeback(ended({ total: 2, done: 0, waived: false }))).toEqual({ index: 1, total: 2, mode: 'RAMP' })
  expect(mockTodayComeback(ended({ total: 2, done: 1, waived: false }))).toEqual({ index: 2, total: 2, mode: 'RAMP' })
  expect(mockTodayComeback(ended({ total: 0, done: 0, waived: true }))).toBeNull()
  expect(mockTodayComeback(ended({ total: 1, done: 1, waived: false }))).toBeNull()
  expect(mockTodayComeback({ period: null, protectedDates: [], comeback: null })).toBeNull()
})

test('withMockComeback serves the reduced working sets and the comeback; untouched without a ramp', () => {
  const out = withMockComeback(plan, ended({ total: 2, done: 0, waived: false }))
  expect(out.comeback).toEqual({ index: 1, total: 2, mode: 'RAMP' })
  expect(out.exercises.map((e) => [e.workingSets, e.sets])).toEqual([[3, 4], [2, 2], [1, 1]])
  expect(withMockComeback(plan, ended(null))).toBe(plan)
})

test('mockOpen: a new period may not start before the one that just ended (overlap guard)', () => {
  const prev = ended(null) // ended on 2026-09-29
  expect(() => mockOpen(prev, { category: 'STOMACH', estimate: 'FEW_DAYS', startDate: '2026-09-28' }, '2026-09-29'))
    .toThrow('TRAIN_RECOVERY_START_OUT_OF_WINDOW')
  expect(() => mockOpen(prev, { category: 'STOMACH', estimate: 'FEW_DAYS', startDate: '2026-09-29' }, '2026-09-29'))
    .not.toThrow()
})
