import { expect, test } from 'vitest'
import { gymDayTarget } from '@/features/train/logic/gymDayTarget'
import type { MesoDay } from '@/data/types'
import type { WorkoutSummaryResponse } from '@/data/train/trainApi'

const day = (over: Partial<MesoDay>): MesoDay =>
  ({ day: 'Kedd', type: 'Pull Day', muscle: 'back', exerciseCount: 1, exercises: [], ...over })

const summary = (over: Partial<WorkoutSummaryResponse>): WorkoutSummaryResponse =>
  ({ id: 'w1', date: '2026-07-20', status: 'completed', origin: 'meso', ...over } as WorkoutSummaryResponse)

test('a rest day (no exercises) resolves to null regardless of weekWorkouts', () => {
  expect(gymDayTarget(day({ exerciseCount: 0, id: 'd1' }), [])).toBeNull()
})

test('a template day completed this week (by templateSessionId) routes to its review, even pulled forward to another date', () => {
  const target = day({ id: 'd2', current: false })
  const weekWorkouts = [summary({ id: 'w42', templateSessionId: 'd2', date: '2026-07-22' })]
  expect(gymDayTarget(target, weekWorkouts)).toBe('/train/review/w42')
})

test('today (current) or a day with no template id starts the plain session', () => {
  expect(gymDayTarget(day({ id: 'd3', current: true }), [])).toBe('/train/session')
  expect(gymDayTarget(day({ id: undefined, current: false }), [])).toBe('/train/session')
})

test('another not-yet-done day pins the template via ?day=', () => {
  expect(gymDayTarget(day({ id: 'd4', current: false }), [])).toBe('/train/session?day=d4')
})
