import { expect, test } from 'vitest'
import { goalResponseToUpsert, type GoalResponse } from '@/data/me/goalApi'

// A persisted goal carrying the day-planner settings (P5). `goalResponseToUpsert`
// is the toRequest mapper the EditGoalSheet uses to PUT a planner-only edit
// without dropping the window/weights it must round-trip.
const res: GoalResponse = {
  id: 'g1',
  title: 'Nyári cut',
  trajectory: 'cut',
  guards: ['strength', 'muscle'],
  status: 'active',
  startDate: '2026-06-01',
  targetDate: '2026-07-27',
  startWeightKg: 84.2,
  targetWeightKg: 80,
  rateTargetPctPerWeek: 0.7,
  identityFrame: 'Erő megtartva.',
  mealsPerDay: 4,
  wakeTime: '06:00',
  bedTime: '23:00',
}

test('goalResponseToUpsert carries every required contract field through', () => {
  const req = goalResponseToUpsert(res)
  expect(req.title).toBe('Nyári cut')
  expect(req.trajectory).toBe('cut')
  expect(req.guards).toEqual(['strength', 'muscle'])
  expect(req.startDate).toBe('2026-06-01')
  expect(req.targetDate).toBe('2026-07-27')
  expect(req.startWeightKg).toBe(84.2)
  expect(req.targetWeightKg).toBe(80)
  expect(req.identityFrame).toBe('Erő megtartva.')
})

test('goalResponseToUpsert round-trips the day-planner settings (mealsPerDay/wakeTime/bedTime)', () => {
  const req = goalResponseToUpsert(res)
  expect(req.mealsPerDay).toBe(4)
  expect(req.wakeTime).toBe('06:00')
  expect(req.bedTime).toBe('23:00')
})

test('goalResponseToUpsert applies the mealsPerDay override, passing wake/bed through from res', () => {
  const req = goalResponseToUpsert(res, { mealsPerDay: 5 })
  expect(req.mealsPerDay).toBe(5)
  // wake/bed are no longer editable via the planner (they live on the sleep goal,
  // mezo-dbsr) — they stay on the wire and pass straight through from res (spec §6).
  expect(req.wakeTime).toBe('06:00')
  expect(req.bedTime).toBe('23:00')
  // untouched window/weights still ride along
  expect(req.startDate).toBe('2026-06-01')
  expect(req.startWeightKg).toBe(84.2)
})
