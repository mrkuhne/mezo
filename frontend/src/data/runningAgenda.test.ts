import { expect, test } from 'vitest'
import { currentWeekOf, runSessionsForDay, todayIdx } from './runningAgenda'
import { runningBlocksMock } from './running'

const active = runningBlocksMock.find((b) => b.status === 'active')!

test('currentWeekOf returns the active block current week (week 3)', () => {
  expect(currentWeekOf(active)?.weekNumber).toBe(3)
})

test('currentWeekOf returns null for a null block', () => {
  expect(currentWeekOf(null)).toBeNull()
})

test('runSessionsForDay returns the Tuesday sprint (dayIdx 1)', () => {
  const sessions = runSessionsForDay(active, 1)
  expect(sessions).toHaveLength(1)
  expect(sessions[0].kind).toBe('sprint')
})

test('runSessionsForDay returns the Friday pyramid (dayIdx 4)', () => {
  const sessions = runSessionsForDay(active, 4)
  expect(sessions).toHaveLength(1)
  expect(sessions[0].kind).toBe('pyramid')
})

test('runSessionsForDay returns [] for a rest day (dayIdx 0 = Monday)', () => {
  expect(runSessionsForDay(active, 0)).toEqual([])
})

test('runSessionsForDay returns [] for a null block', () => {
  expect(runSessionsForDay(null, 1)).toEqual([])
})

test('todayIdx maps a Tuesday to Monday-based index 1', () => {
  // 2026-06-16 is a Tuesday (getDay() === 2) -> (2 + 6) % 7 === 1.
  expect(todayIdx(new Date('2026-06-16T12:00:00'))).toBe(1)
})
