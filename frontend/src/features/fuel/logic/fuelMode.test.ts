import { expect, test } from 'vitest'
import { fuelModeOf, recoveryFuelFields, skippedKcalOn } from '@/features/fuel/logic/fuelMode'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import type { RecoveryState } from '@/data/train/recoveryApi'

test('maps the category to the mode', () => {
  expect(fuelModeOf('ILLNESS')).toBe('GUIDANCE')
  expect(fuelModeOf('STOMACH')).toBe('GUIDANCE')
  expect(fuelModeOf('INJURY')).toBe('MAINTENANCE')
  expect(fuelModeOf('TRAVEL')).toBe('ESTIMATE')
  expect(fuelModeOf('TIRED')).toBeNull()
})

const state = (over: object): RecoveryState => ({
  period: { id: 'p', category: 'INJURY', estimate: 'WEEK', startDate: '2026-09-28', dayIndex: 1, estimateExpired: false,
    checkedInToday: false, releasedDates: ['2026-09-29'], releasedUnlightened: [], ...over },
  protectedDates: [], comeback: null,
}) as RecoveryState

test('follows the period days, ignoring releases, ending before endedOn', () => {
  const s = state({ endedOn: '2026-10-01' })
  expect(recoveryFuelFields(s, '2026-09-27').fuelMode).toBeNull()
  expect(recoveryFuelFields(s, '2026-09-29')).toEqual({ fuelMode: 'MAINTENANCE', recoveryCategory: 'INJURY', recoveryDay: 2 })
  expect(recoveryFuelFields(s, '2026-09-30').recoveryDay).toBe(3)
  expect(recoveryFuelFields(s, '2026-10-01').fuelMode).toBeNull()
  expect(recoveryFuelFields(state({}), '2026-10-20').fuelMode).toBe('MAINTENANCE')
})

test('skippedKcal sums meal skips, clamps to target, 0 in GUIDANCE', () => {
  const meal = (kcal: number): PlannedSkip => ({ id: String(kcal), kind: 'MEAL', date: '2026-09-28', sessionKey: 'x#1',
    reasonCategory: 'NONE', source: 'USER', serious: false, freePass: false, excused: true, plannedKcal: kcal })
  const skips = [meal(500), meal(700)]
  expect(skippedKcalOn(skips, '2026-09-28', null, 3000)).toBe(1200)
  expect(skippedKcalOn(skips, '2026-09-28', 'ESTIMATE', 1000)).toBe(1000)
  expect(skippedKcalOn(skips, '2026-09-28', 'GUIDANCE', 3000)).toBe(0)
  expect(skippedKcalOn(skips, '2026-09-29', null, 3000)).toBe(0)
})
