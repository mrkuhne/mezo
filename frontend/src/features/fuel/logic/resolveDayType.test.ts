import { resolveDayType } from '@/features/fuel/logic/resolveDayType'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'

const block = (over: Partial<PlannerBlock> = {}): PlannerBlock => ({
  kind: 'gym', time: '07:00', durationMin: 60, label: 'Gym', ...over,
})

test('no blocks → rest day', () => {
  expect(resolveDayType([])).toBe('rest')
})

test('a morning gym block → training_am', () => {
  expect(resolveDayType([block({ time: '07:00' })])).toBe('training_am')
})

test('an evening sport block → training_pm', () => {
  expect(resolveDayType([block({ kind: 'sport', time: '18:00' })])).toBe('training_pm')
})

test('with two unsorted blocks the EARLIEST start wins', () => {
  const gym = block({ kind: 'gym', time: '18:00' })
  const run = block({ kind: 'run', time: '09:00' })
  expect(resolveDayType([gym, run])).toBe('training_am')
})

test('exactly noon is training_pm — the training_am boundary is exclusive', () => {
  expect(resolveDayType([block({ time: '12:00' })])).toBe('training_pm')
})
